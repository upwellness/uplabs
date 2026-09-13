import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncGoogleHealth } from "@/lib/pulse/google-health-sync";
import { buildSnapshot, storeSnapshot, pruneSnapshots } from "@/lib/backup/engine";
import { sendWeeklyNudges, bangkokWeekday } from "@/lib/health-design/weekly-nudge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One nightly cron (03:00 Bangkok) — Vercel's Hobby plan allows two cron jobs per
 * project, and the LINE menu push already takes one. Order matters: wearables sync
 * first so the snapshot that follows contains tonight's readings.
 *   1. Google Health re-sync for every active connection
 *   2. Mondays only: LINE progress nudge to customers with a sent plan
 *   3. full database snapshot → Storage, prune to the newest 14
 * /api/pulse/google-health/cron and /api/admin/backup/cron remain for manual runs.
 */
function authorized(req: Request): boolean {
  const s = process.env.CRON_SECRET; if (!s) return false;
  return req.headers.get("authorization") === `Bearer ${s}` || req.headers.get("x-cron-secret") === s || new URL(req.url).searchParams.get("secret") === s;
}

async function run(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const out: Record<string, unknown> = {};
  const admin = createAdminClient();

  const { data: conns } = await admin.from("pulse_connections").select("id, customer_id, access_token_enc, refresh_token_enc, expires_at").eq("provider", "google_health").eq("status", "active").limit(50);
  const wearable: unknown[] = [];
  for (const c of (conns ?? []) as any[]) {
    try { const r = await syncGoogleHealth(c); wearable.push({ id: c.id, count: r.count, glucose: r.glucose, errors: r.errors }); }
    catch (e: any) {
      wearable.push({ id: c.id, failed: e?.message ?? String(e) });
      if (/invalid_grant|refresh token|เชื่อมต่อใหม่/i.test(String(e?.message))) await admin.from("pulse_connections").update({ status: "reauth_required" }).eq("id", c.id);
    }
  }
  out.google_health = wearable;

  if (bangkokWeekday() === 1 || new URL(req.url).searchParams.get("nudge") === "1") {
    try { out.weekly_nudge = await sendWeeklyNudges(); }
    catch (e: any) { out.weekly_nudge = { failed: e?.message ?? String(e) }; }
  }

  try {
    const snap = await buildSnapshot({ createdBy: "cron", includeAuthUsers: true });
    const stored = await storeSnapshot(snap, "auto");
    out.backup = { stored, totals: snap.totals, pruned: await pruneSnapshots() };
  } catch (e: any) { console.error("[nightly] backup failed:", e?.message ?? e); out.backup = { failed: e?.message ?? String(e) }; }

  return NextResponse.json({ ok: true, ...out });
}
export const GET = run; export const POST = run;
