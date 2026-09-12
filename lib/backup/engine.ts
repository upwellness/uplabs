/**
 * Backup / restore I/O. Decisions live in snapshot.ts (pure, tested).
 *
 *   catalog  → backup_catalog() RPC (every public table, real PKs) + exact counts
 *   dump     → paged select * per table (PostgREST caps a page at 1,000 rows)
 *   store    → private Storage bucket `db-backups`, gzip, 14 most recent kept (UP Labs tables only)
 *   restore  → parents-first, upsert on the real PK (replace mode clears first),
 *              sequences reset afterwards
 */
import { gzipSync, gunzipSync } from "node:zlib";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  orderTables, parseSnapshot, planRestore, projectRow, snapshotFilename, isForeignTable, SNAPSHOT_FORMAT, SNAPSHOT_VERSION,
  type CatalogEntry, type Snapshot, type RestoreMode, type RestorePlan,
} from "./snapshot";

export const BUCKET = "db-backups";
export const KEEP_SNAPSHOTS = 14; // 31 MB/snapshot gz (driver_logs alone is 45 MB raw) — 30 would eat the 1 GB Storage tier
const PAGE = 1000;
const CHUNK = 500;

export async function getCatalog(withCounts = true): Promise<CatalogEntry[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("backup_catalog");
  if (error) throw new Error(`backup_catalog: ${error.message}`);
  const rows = (data ?? []) as CatalogEntry[];
  if (withCounts) {
    await Promise.all(rows.map(async (r) => {
      const { count } = await admin.from(r.table_name).select("*", { count: "exact", head: true });
      r.exact_rows = count ?? null;
    }));
  }
  return rows;
}

export async function dumpTable(name: string): Promise<{ rows: Record<string, unknown>[]; error?: string }> {
  const admin = createAdminClient();
  const all: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from(name).select("*").range(from, from + PAGE - 1);
    if (error) return { rows: all, error: error.message };
    all.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < PAGE) break;
  }
  return { rows: all };
}

/** `tables` omitted = every UP Labs table; other projects' tables only when `includeForeign` (or named explicitly). */
export async function buildSnapshot(opts: { tables?: string[] | null; createdBy: string; includeAuthUsers?: boolean; includeForeign?: boolean }): Promise<Snapshot> {
  const catalog = await getCatalog(false);
  const order = orderTables(catalog);
  const wanted = new Set(opts.tables?.length ? opts.tables : order.filter((t) => opts.includeForeign || !isForeignTable(t)));
  const tables: Snapshot["tables"] = {};
  let rows = 0;
  for (const t of order) {
    if (!wanted.has(t)) continue;
    const c = catalog.find((x) => x.table_name === t)!;
    const d = await dumpTable(t);
    tables[t] = { pk: c.pk_columns, row_count: d.rows.length, rows: d.rows, ...(d.error ? { error: d.error } : {}) };
    rows += d.rows.length;
  }
  let auth_users: unknown[] | undefined;
  if (opts.includeAuthUsers) {
    const { data } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 });
    auth_users = data?.users?.map((u) => ({ id: u.id, email: u.email, phone: u.phone, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, user_metadata: u.user_metadata, app_metadata: u.app_metadata }));
  }
  return {
    format: SNAPSHOT_FORMAT, version: SNAPSHOT_VERSION, created_at: new Date().toISOString(), created_by: opts.createdBy,
    project_ref: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https?:\/\/([a-z0-9]+)\./)?.[1] ?? null,
    order: order.filter((t) => wanted.has(t)), tables, ...(auth_users ? { auth_users } : {}), totals: { tables: Object.keys(tables).length, rows },
  };
}

/* ── storage ─────────────────────────────────────────────────────────────── */

export interface StoredSnapshot { name: string; created_at: string; bytes: number }

export async function storeSnapshot(snapshot: Snapshot, label: string): Promise<StoredSnapshot> {
  const admin = createAdminClient();
  const name = `${snapshotFilename(snapshot.created_at, label)}.gz`;
  const body = gzipSync(Buffer.from(JSON.stringify(snapshot)), { level: 6 });
  const { error } = await admin.storage.from(BUCKET).upload(name, body, { contentType: "application/gzip", upsert: false });
  if (error) throw new Error(`upload: ${error.message}`);
  return { name, created_at: snapshot.created_at, bytes: body.byteLength };
}

export async function listSnapshots(): Promise<StoredSnapshot[]> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).list("", { limit: 200, sortBy: { column: "name", order: "desc" } });
  if (error) throw new Error(`list: ${error.message}`);
  return (data ?? []).filter((f) => f.name.endsWith(".json.gz")).map((f) => ({ name: f.name, created_at: f.created_at ?? "", bytes: (f.metadata as any)?.size ?? 0 }));
}

export async function readSnapshot(name: string): Promise<Snapshot> {
  if (!/^[A-Za-z0-9_.-]+\.json\.gz$/.test(name)) throw new Error("bad snapshot name");
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(name);
  if (error || !data) throw new Error(`download: ${error?.message ?? "missing"}`);
  const json = JSON.parse(gunzipSync(Buffer.from(await data.arrayBuffer())).toString("utf8"));
  const p = parseSnapshot(json);
  if (!p.ok) throw new Error(p.error);
  return p.snapshot;
}

export async function deleteSnapshot(name: string): Promise<void> {
  if (!/^[A-Za-z0-9_.-]+\.json\.gz$/.test(name)) throw new Error("bad snapshot name");
  const { error } = await createAdminClient().storage.from(BUCKET).remove([name]);
  if (error) throw new Error(error.message);
}

/** Keep the newest N automatic snapshots (manual ones — prefix "manual" — are never pruned). */
export async function pruneSnapshots(keep = KEEP_SNAPSHOTS): Promise<string[]> {
  const all = (await listSnapshots()).filter((s) => s.name.startsWith("auto_")).sort((a, b) => b.name.localeCompare(a.name));
  const stale = all.slice(keep).map((s) => s.name);
  if (stale.length) await createAdminClient().storage.from(BUCKET).remove(stale);
  return stale;
}

/* ── restore ─────────────────────────────────────────────────────────────── */

export interface RestoreReport { plan: RestorePlan; results: { table: string; cleared?: number; written: number; errors: string[] }[]; sequences_reset: number; ok: boolean }

export async function restoreSnapshot(snapshot: Snapshot, opts: { mode: RestoreMode; only?: string[] | null; dryRun: boolean }): Promise<RestoreReport> {
  const catalog = await getCatalog(false);
  const plan = planRestore(snapshot, catalog, { mode: opts.mode, only: opts.only });
  const results: RestoreReport["results"] = [];
  if (opts.dryRun) return { plan, results, sequences_reset: 0, ok: true };

  const admin = createAdminClient();
  const cols = new Map(catalog.map((c) => [c.table_name, c.columns]));
  let ok = true;

  // Replace mode: clear children first (reverse order) so FKs never block the delete.
  if (opts.mode === "replace") {
    for (const step of [...plan.steps].reverse()) {
      if (step.action === "skip" && !step.reason?.includes("โหมดแทนที่")) continue;
      const { data, error } = await admin.rpc("backup_clear_table", { t: step.table });
      results.push({ table: step.table, cleared: error ? undefined : Number(data ?? 0), written: 0, errors: error ? [`clear: ${error.message}`] : [] });
      if (error) ok = false;
    }
  }

  for (const step of plan.steps) {
    if (step.action === "skip") continue;
    const rows = snapshot.tables[step.table].rows.map((r) => projectRow(r, cols.get(step.table) ?? Object.keys(r)));
    const rec = results.find((r) => r.table === step.table) ?? (results.push({ table: step.table, written: 0, errors: [] }), results[results.length - 1]);
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = step.action === "upsert"
        ? await admin.from(step.table).upsert(chunk, { onConflict: step.pk.join(","), ignoreDuplicates: false })
        : await admin.from(step.table).insert(chunk);
      if (error) { rec.errors.push(`rows ${i}–${i + chunk.length}: ${error.message}`); ok = false; if (rec.errors.length >= 5) break; }
      else rec.written += chunk.length;
    }
  }

  const { data: seq } = await admin.rpc("backup_reset_sequences");
  return { plan, results, sequences_reset: Number(seq ?? 0), ok };
}
