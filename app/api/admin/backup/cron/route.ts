import { NextResponse } from "next/server";
import { buildSnapshot, storeSnapshot, pruneSnapshots } from "@/lib/backup/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Nightly full snapshot → Storage (vercel.json cron, 03:00 Bangkok). Protected by
 * CRON_SECRET exactly like /api/line/push-tomorrow; refuses to run without it.
 */
function authorized(req: Request): boolean {
  const s = process.env.CRON_SECRET; if (!s) return false;
  const h = req.headers.get("authorization") ?? "";
  return h === `Bearer ${s}` || req.headers.get("x-cron-secret") === s || new URL(req.url).searchParams.get("secret") === s;
}

async function run(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const snap = await buildSnapshot({ createdBy: "cron", includeAuthUsers: true });
    const stored = await storeSnapshot(snap, "auto");
    const pruned = await pruneSnapshots();
    return NextResponse.json({ ok: true, stored, totals: snap.totals, pruned });
  } catch (e: any) {
    console.error("[backup cron]", e?.message ?? e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
export const GET = run;
export const POST = run;
