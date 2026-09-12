import { NextResponse } from "next/server";
import { requireBackupAdmin } from "@/lib/backup/guard";
import { readSnapshot, deleteSnapshot } from "@/lib/backup/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET — download one stored snapshot as plain JSON (decompressed server-side). */
export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const g = await requireBackupAdmin(); if (g.res) return g.res;
  try {
    const snap = await readSnapshot(params.name);
    return new NextResponse(JSON.stringify(snap), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${params.name.replace(/\.gz$/, "")}"`, "cache-control": "no-store" } });
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "read failed" }, { status: 404 }); }
}

export async function DELETE(_req: Request, { params }: { params: { name: string } }) {
  const g = await requireBackupAdmin(); if (g.res) return g.res;
  try { await deleteSnapshot(params.name); return NextResponse.json({ ok: true }); }
  catch (e: any) { return NextResponse.json({ error: e?.message ?? "delete failed" }, { status: 400 }); }
}
