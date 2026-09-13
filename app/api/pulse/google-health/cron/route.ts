import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncGoogleHealth } from "@/lib/pulse/google-health-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Nightly: re-sync every active Google Health connection (vercel cron · CRON_SECRET like the other crons). */
function authorized(req: Request): boolean {
  const s = process.env.CRON_SECRET; if (!s) return false;
  return req.headers.get("authorization") === `Bearer ${s}` || req.headers.get("x-cron-secret") === s || new URL(req.url).searchParams.get("secret") === s;
}
async function run(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: conns } = await admin.from("pulse_connections").select("id, customer_id, access_token_enc, refresh_token_enc, expires_at").eq("provider", "google_health").eq("status", "active").limit(50);
  const report: { id: string; count?: number; errors?: string[]; failed?: string }[] = [];
  for (const c of (conns ?? []) as any[]) {
    try { const r = await syncGoogleHealth(c); report.push({ id: c.id, count: r.count, glucose: r.glucose, errors: r.errors }); }
    catch (e: any) {
      report.push({ id: c.id, failed: e?.message ?? String(e) });
      // a dead refresh token (Testing-mode 7-day expiry) → flag so the coach re-links
      if (/invalid_grant|refresh token|เชื่อมต่อใหม่/i.test(String(e?.message))) await admin.from("pulse_connections").update({ status: "reauth_required" }).eq("id", c.id);
    }
  }
  return NextResponse.json({ ok: true, synced: report.length, report });
}
export const GET = run; export const POST = run;
