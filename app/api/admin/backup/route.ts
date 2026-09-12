import { NextResponse } from "next/server";
import { requireBackupAdmin } from "@/lib/backup/guard";
import { buildSnapshot } from "@/lib/backup/engine";
import { snapshotFilename } from "@/lib/backup/snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST { tables?: string[], includeAuthUsers?: boolean } — build a snapshot of the
 * whole database (or the chosen tables) and stream it back as a download.
 * Nothing is stored server-side by this route; use /snapshots for that.
 */
export async function POST(req: Request) {
  const g = await requireBackupAdmin(); if (g.res) return g.res;
  const body = await req.json().catch(() => ({}));
  try {
    const snap = await buildSnapshot({ tables: Array.isArray(body.tables) ? body.tables.map(String) : null, createdBy: g.session!.profile.email ?? g.session!.user.id, includeAuthUsers: body.includeAuthUsers === true });
    return new NextResponse(JSON.stringify(snap), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${snapshotFilename(snap.created_at)}"`, "cache-control": "no-store" },
    });
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "backup failed" }, { status: 500 }); }
}
