/**
 * Backup / restore — the decisions, no I/O (tested in tests/backup.test.mts).
 *
 * A snapshot is one JSON document holding every public table's rows plus the
 * catalog the rows were read with (primary keys, FK parents). Restore replays
 * tables parents-first so foreign keys hold, upserts on the real primary key (not
 * an assumed `id`), and never touches a table the snapshot does not contain.
 */

export const SNAPSHOT_FORMAT = "uplabs-snapshot";

/**
 * Tables that live in the same Supabase project but belong to OTHER apps (an old
 * CRM, a driver-log tool, a warm-lead pipeline …). None is referenced anywhere in this
 * repo, none has a foreign key to `customers`. They are skipped by the nightly snapshot
 * and by default in the admin page — `driver_logs` alone is 45 MB of embedded files —
 * but can be included on demand. Restore never touches a table that is not in the file.
 */
export const FOREIGN_TABLES: readonly string[] = [
  "aw_prospects", "budgets", "call_logs", "categories", "contact_status", "contacts", "driver_logs", "leads",
  "link_hub", "losmtd", "metabolic_leads", "symbols", "transactions", "user_profiles",
  "warm_content_touchpoints", "warm_lead_interactions", "warm_lead_segments", "warm_lead_tags", "warm_lead_tasks", "warm_leads",
];
export const isForeignTable = (name: string) => FOREIGN_TABLES.includes(name);
export const SNAPSHOT_VERSION = 2;

export interface CatalogEntry { table_name: string; est_rows: number; pk_columns: string[]; fk_parents: string[]; columns: string[]; exact_rows?: number | null }

export interface SnapshotTable { pk: string[]; row_count: number; rows: Record<string, unknown>[]; error?: string }
export interface Snapshot {
  format: typeof SNAPSHOT_FORMAT; version: number; created_at: string; created_by: string; project_ref: string | null;
  order: string[];                          // restore order at the time of the dump
  tables: Record<string, SnapshotTable>;
  auth_users?: unknown[];                   // export only — never restored (passwords cannot be moved)
  totals: { tables: number; rows: number };
}

/** Parents before children. Cycles/unknown parents fall back to alphabetical after their known parents. */
export function orderTables(catalog: CatalogEntry[]): string[] {
  const names = new Set(catalog.map((c) => c.table_name));
  const parents = new Map(catalog.map((c) => [c.table_name, c.fk_parents.filter((p) => names.has(p) && p !== c.table_name)]));
  const out: string[] = []; const done = new Set<string>(); const visiting = new Set<string>();
  const visit = (t: string) => {
    if (done.has(t)) return;
    if (visiting.has(t)) return;               // cycle — emit in the order we reach it
    visiting.add(t);
    for (const p of [...(parents.get(t) ?? [])].sort()) visit(p);
    visiting.delete(t); done.add(t); out.push(t);
  };
  for (const t of [...names].sort()) visit(t);
  return out;
}

/** Accept a v2 snapshot or the older `{ _meta, tables: { name: { rows } } }` file. */
export function parseSnapshot(input: unknown): { ok: true; snapshot: Snapshot; legacy: boolean } | { ok: false; error: string } {
  const b = input as any;
  if (!b || typeof b !== "object" || !b.tables || typeof b.tables !== "object") return { ok: false, error: "ไฟล์ไม่ใช่ snapshot — ต้องมี tables" };
  const legacy = b.format !== SNAPSHOT_FORMAT;
  const tables: Record<string, SnapshotTable> = {};
  let rows = 0;
  for (const [name, entry] of Object.entries<any>(b.tables)) {
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) return { ok: false, error: `ชื่อตาราง "${name}" ไม่ถูกต้อง` };
    const list = Array.isArray(entry?.rows) ? entry.rows : [];
    if (list.some((r: unknown) => !r || typeof r !== "object" || Array.isArray(r))) return { ok: false, error: `ตาราง ${name}: rows ต้องเป็น object ทุกแถว` };
    tables[name] = { pk: Array.isArray(entry?.pk) ? entry.pk.map(String) : [], row_count: list.length, rows: list, ...(entry?.error ? { error: String(entry.error) } : {}) };
    rows += list.length;
  }
  return { ok: true, legacy, snapshot: {
    format: SNAPSHOT_FORMAT, version: legacy ? 1 : Number(b.version) || 2,
    created_at: String(b.created_at ?? b._meta?.created_at ?? ""), created_by: String(b.created_by ?? b._meta?.created_by ?? "unknown"),
    project_ref: b.project_ref ?? null, order: Array.isArray(b.order) ? b.order.map(String) : [], tables, auth_users: Array.isArray(b.auth_users) ? b.auth_users : undefined,
    totals: { tables: Object.keys(tables).length, rows },
  } };
}

export type RestoreMode = "upsert" | "replace";
export interface RestoreStep { table: string; rows: number; pk: string[]; action: "upsert" | "insert" | "skip"; reason?: string }
export interface RestorePlan { mode: RestoreMode; steps: RestoreStep[]; warnings: string[]; totals: { tables: number; rows: number; skipped: number } }

/**
 * Decide, per table, what restore will do. The live catalog wins over the snapshot for
 * primary keys and order; a table missing from the live database is skipped (the schema
 * comes from migrations, never from a data file).
 */
export function planRestore(snapshot: Snapshot, catalog: CatalogEntry[], opts: { mode: RestoreMode; only?: string[] | null }): RestorePlan {
  const live = new Map(catalog.map((c) => [c.table_name, c]));
  const order = orderTables(catalog);
  const wanted = new Set(opts.only?.length ? opts.only : Object.keys(snapshot.tables));
  const steps: RestoreStep[] = []; const warnings: string[] = [];
  for (const t of order) {
    if (!wanted.has(t) || !snapshot.tables[t]) continue;
    const s = snapshot.tables[t]; const c = live.get(t)!;
    if (s.error) { steps.push({ table: t, rows: 0, pk: c.pk_columns, action: "skip", reason: `snapshot มี error: ${s.error}` }); continue; }
    if (s.rows.length === 0) { steps.push({ table: t, rows: 0, pk: c.pk_columns, action: "skip", reason: opts.mode === "replace" ? "ไม่มีแถวใน snapshot — โหมดแทนที่จะล้างตารางนี้" : "ไม่มีแถวใน snapshot" }); continue; }
    const cols = new Set(c.columns);
    const unknown = Object.keys(s.rows[0]).filter((k) => !cols.has(k));
    if (unknown.length) warnings.push(`${t}: คอลัมน์ ${unknown.join(", ")} ไม่มีในฐานปัจจุบัน — จะถูกตัดออก`);
    if (c.pk_columns.length === 0) { steps.push({ table: t, rows: s.rows.length, pk: [], action: "insert", reason: "ไม่มี primary key — insert อย่างเดียว (แถวซ้ำได้)" }); continue; }
    steps.push({ table: t, rows: s.rows.length, pk: c.pk_columns, action: "upsert" });
  }
  for (const t of wanted) if (!live.has(t) && snapshot.tables[t]) { steps.push({ table: t, rows: snapshot.tables[t].rows.length, pk: [], action: "skip", reason: "ไม่มีตารางนี้ในฐานปัจจุบัน — รัน migration ก่อน" }); }
  const rows = steps.filter((s) => s.action !== "skip").reduce((a, s) => a + s.rows, 0);
  return { mode: opts.mode, steps, warnings, totals: { tables: steps.filter((s) => s.action !== "skip").length, rows, skipped: steps.filter((s) => s.action === "skip").length } };
}

/** Drop columns the live table no longer has (a snapshot from before a column was removed). */
export function projectRow(row: Record<string, unknown>, columns: string[]): Record<string, unknown> {
  const keep = new Set(columns); const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (keep.has(k)) out[k] = v;
  return out;
}

export const snapshotFilename = (createdAt: string, prefix = "uplabs") =>
  `${prefix}_${createdAt.replace(/[-:]/g, "").replace("T", "_").slice(0, 15)}.json`;

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
