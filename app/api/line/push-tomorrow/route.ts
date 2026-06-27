/**
 * GET|POST /api/line/push-tomorrow — scheduled push of tomorrow's menu (SPEC R4).
 *
 * Loops every enabled line_bot_groups row, computes tomorrow's meals, pushes the
 * Flex card to the LINE group, and logs the result per group. Returns a summary.
 *
 * Protection: a shared secret in CRON_SECRET. Accepts either
 *   Authorization: Bearer <CRON_SECRET>      (Vercel Cron / manual)
 *   x-cron-secret: <CRON_SECRET>
 *   ?secret=<CRON_SECRET>                     (fallback for simple schedulers)
 * If CRON_SECRET is unset the route refuses to run (500) — never wide open.
 *
 * Scheduling itself (cron at 18:00 Asia/Bangkok) is configured separately
 * (Vercel cron / external scheduler) — NOT part of this file. Per-group push_time
 * is stored but a single daily cron is assumed for Phase 1; finer-grained per-group
 * timing is Phase 2.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushMessage } from "@/lib/line/client";
import { resolveGroup, getDayMeals, buildMealFlex } from "@/lib/line/meal-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // not configured → refuse (handled as 500 by caller)
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const headerSecret = req.headers.get("x-cron-secret") || "";
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret") || "";
  return bearer === secret || headerSecret === secret || querySecret === secret;
}

async function run(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: groups, error } = await admin
    .from("line_bot_groups")
    .select("id, line_group_id, customer_id, push_enabled")
    .eq("push_enabled", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = groups ?? [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const results: Array<{ groupId: string; status: string; reason?: string }> = [];

  for (const g of rows) {
    const lineGroupId = g.line_group_id as string;
    try {
      const group = await resolveGroup(lineGroupId);
      if (!group) {
        skipped++;
        results.push({ groupId: lineGroupId, status: "skip", reason: "unbound_or_incomplete" });
        await admin.from("line_bot_logs").insert({
          group_id: g.id, type: "push", status: "skip", payload: { reason: "unbound_or_incomplete" },
        });
        continue;
      }

      const result = await getDayMeals(group, "tomorrow");
      const r = await pushMessage(lineGroupId, [buildMealFlex(result, "tomorrow")]);

      if (r.ok) {
        sent++;
        results.push({ groupId: lineGroupId, status: "ok" });
      } else {
        failed++;
        results.push({ groupId: lineGroupId, status: "fail", reason: `line ${r.status}` });
      }
      await admin.from("line_bot_logs").insert({
        group_id: g.id,
        type: "push",
        status: r.ok ? "ok" : "fail",
        payload: { programDay: result.programDay, lineStatus: r.status, lineError: r.text || undefined },
      });
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message.slice(0, 300) : String(e);
      results.push({ groupId: lineGroupId, status: "fail", reason: msg });
      await admin.from("line_bot_logs").insert({
        group_id: g.id, type: "push", status: "fail", payload: { error: msg },
      });
    }
  }

  return NextResponse.json({ ok: true, total: rows.length, sent, skipped, failed, results });
}

export async function POST(req: Request) {
  return run(req);
}
export async function GET(req: Request) {
  return run(req);
}
