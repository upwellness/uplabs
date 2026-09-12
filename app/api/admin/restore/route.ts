import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireBackupAdmin } from "@/lib/backup/guard";
import { readSnapshot, restoreSnapshot } from "@/lib/backup/engine";
import { parseSnapshot, type RestoreMode } from "@/lib/backup/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST — restore from an uploaded snapshot file or a stored one.
 *   multipart: file=<snapshot.json>  +  fields mode, only (comma list), dry_run, confirm
 *   json:      { snapshot_name, mode, only?, dry_run, confirm }
 * `mode` upsert (add/update, never delete) | replace (clear the chosen tables first).
 * A real run needs confirm === "RESTORE" (and "REPLACE" for replace mode).
 */
export async function POST(req: Request) {
  const g = await requireBackupAdmin(); if (g.res) return g.res;
  const ct = req.headers.get("content-type") ?? "";
  let snapshot; let mode: RestoreMode = "upsert"; let only: string[] | null = null; let dryRun = true; let confirm = "";

  try {
    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      const f = fd.get("file");
      if (!(f instanceof File)) return NextResponse.json({ error: "ต้องแนบไฟล์ snapshot" }, { status: 400 });
      if (f.size > 150 * 1024 * 1024) return NextResponse.json({ error: "ไฟล์เกิน 150 MB" }, { status: 400 });
      const p = parseSnapshot(JSON.parse(await f.text()));
      if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
      snapshot = p.snapshot;
      mode = fd.get("mode") === "replace" ? "replace" : "upsert";
      only = String(fd.get("only") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      dryRun = fd.get("dry_run") !== "false";
      confirm = String(fd.get("confirm") ?? "");
    } else {
      const b = await req.json();
      if (typeof b.snapshot_name !== "string") return NextResponse.json({ error: "ต้องมี snapshot_name หรือแนบไฟล์" }, { status: 400 });
      snapshot = await readSnapshot(b.snapshot_name);
      mode = b.mode === "replace" ? "replace" : "upsert";
      only = Array.isArray(b.only) ? b.only.map(String) : null;
      dryRun = b.dry_run !== false;
      confirm = String(b.confirm ?? "");
    }
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "อ่าน snapshot ไม่ได้" }, { status: 400 }); }

  if (!dryRun) {
    if (confirm !== (mode === "replace" ? "REPLACE" : "RESTORE")) {
      return NextResponse.json({ error: `ต้องพิมพ์ ${mode === "replace" ? "REPLACE" : "RESTORE"} เพื่อยืนยัน` }, { status: 400 });
    }
  }
  try {
    const report = await restoreSnapshot(snapshot, { mode, only: only?.length ? only : null, dryRun });
    if (!dryRun) { revalidateTag("dashboard"); console.warn(`[restore] ${g.session!.profile.email} mode=${mode} tables=${report.plan.totals.tables} rows=${report.plan.totals.rows} ok=${report.ok}`); }
    return NextResponse.json({ dry_run: dryRun, mode, snapshot: { created_at: snapshot.created_at, created_by: snapshot.created_by, version: snapshot.version, totals: snapshot.totals }, ...report });
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "restore failed" }, { status: 500 }); }
}
