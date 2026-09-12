import { NextResponse } from "next/server";
import { requireBackupAdmin } from "@/lib/backup/guard";
import { buildSnapshot, listSnapshots, storeSnapshot } from "@/lib/backup/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET — snapshots kept in Storage (automatic nightly + manual). */
export async function GET() {
  const g = await requireBackupAdmin(); if (g.res) return g.res;
  try { return NextResponse.json({ snapshots: await listSnapshots() }, { headers: { "cache-control": "no-store" } }); }
  catch (e: any) { return NextResponse.json({ error: e?.message ?? "list failed" }, { status: 500 }); }
}

/** POST — take a full snapshot now and keep it in Storage (label "manual" — never pruned). */
export async function POST() {
  const g = await requireBackupAdmin(); if (g.res) return g.res;
  try {
    const snap = await buildSnapshot({ createdBy: g.session!.profile.email ?? g.session!.user.id, includeAuthUsers: true });
    const stored = await storeSnapshot(snap, "manual");
    return NextResponse.json({ stored, totals: snap.totals });
  } catch (e: any) { return NextResponse.json({ error: e?.message ?? "snapshot failed" }, { status: 500 }); }
}
