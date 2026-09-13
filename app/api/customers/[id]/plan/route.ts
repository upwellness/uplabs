import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { canManageCustomer } from "@/lib/customers/access";
import { currentPlan, planHistory, createDraft, confirmPlan, markSent, planProgress } from "@/lib/health-design/plan-store";
import { pushMessage } from "@/lib/line/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

async function allowed(customerId: string) {
  const session = await getSession();
  if (!session) return { status: 401 as const, error: "unauthenticated", session: null };
  const { data: c } = await createAdminClient().from("customers").select("id, coach_id").eq("id", customerId).maybeSingle();
  if (!c) return { status: 404 as const, error: "customer not found", session };
  if (session.profile.role === "admin" || (c as any).coach_id === session.user.id || (await canManageCustomer(session.user.id, customerId))) return { status: 200 as const, session };
  return { status: 403 as const, error: "forbidden", session };
}

/** GET — the live plan (draft/confirmed/sent) + history. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const a = await allowed(params.id);
  if (a.status !== 200) return NextResponse.json({ error: a.error }, { status: a.status });
  const [plan, history, pp] = await Promise.all([currentPlan(params.id), planHistory(params.id), planProgress(params.id).catch(() => null)]);
  return NextResponse.json({ plan, history, progress: pp?.progress ?? null, share_base: `${siteUrl()}/r/plan/` }, { headers: { "cache-control": "no-store" } });
}

/**
 * POST — { action: "draft", goal? } · { action: "confirm", plan_id, goals_90d?, lifestyle?, retest?, coach_note? }
 *        · { action: "send", plan_id, via: "link" | "line" }
 * Confirm and send are coach-only steps by design (SPEC-Health-Design §3.3): the
 * External API can draft but never confirm or send.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await allowed(params.id);
  if (a.status !== 200) return NextResponse.json({ error: a.error }, { status: a.status });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "body ต้องเป็น JSON" }, { status: 400 }); }
  const uid = a.session!.user.id;

  try {
    if (body.action === "draft") {
      const goal = ["loss", "longevity", "muscle"].includes(body.goal) ? body.goal : null;
      const plan = await createDraft(params.id, uid, goal);
      if (!plan) return NextResponse.json({ error: "ยังประเมินไม่ได้ — ต้องมีข้อมูลลูกค้าก่อน" }, { status: 400 });
      return NextResponse.json({ plan });
    }
    if (body.action === "confirm") {
      if (typeof body.plan_id !== "string") return NextResponse.json({ error: "ต้องมี plan_id" }, { status: 400 });
      const plan = await confirmPlan(body.plan_id, uid, { goals_90d: body.goals_90d, lifestyle: body.lifestyle, retest: body.retest, coach_note: body.coach_note });
      if (!plan || plan.customer_id !== params.id) return NextResponse.json({ error: "ไม่พบแผน" }, { status: 404 });
      return NextResponse.json({ plan });
    }
    if (body.action === "send") {
      if (typeof body.plan_id !== "string") return NextResponse.json({ error: "ต้องมี plan_id" }, { status: 400 });
      const via = body.via === "line" ? "line" : "link";
      const cur = await currentPlan(params.id);
      if (!cur || cur.id !== body.plan_id || cur.status === "draft") return NextResponse.json({ error: "ต้องยืนยันแผนก่อนส่ง" }, { status: 400 });
      const url = `${siteUrl()}/r/plan/${cur.share_token}`;
      if (via === "line") {
        const { data: g } = await createAdminClient().from("line_bot_groups").select("line_group_id").eq("customer_id", params.id).eq("push_enabled", true).limit(1).maybeSingle();
        if (!g) return NextResponse.json({ error: "ลูกค้ายังไม่ได้ผูกกลุ่ม LINE — ส่งเป็นลิงก์แทน", url }, { status: 400 });
        // mark first so the link is live when the message lands
        await markSent(cur.id, "line");
        await pushMessage((g as any).line_group_id, [{ type: "text", text: `แผนดูแลสุขภาพ 90 วันของคุณพร้อมแล้วค่ะ 🌿\nเปิดดูได้ที่ ${url}\n\nโค้ชตรวจและยืนยันแผนนี้แล้ว หากมีข้อสงสัยทักถามได้เลยค่ะ` }]);
        return NextResponse.json({ plan: await currentPlan(params.id), url, via });
      }
      const plan = await markSent(cur.id, "link");
      return NextResponse.json({ plan, url, via });
    }
    return NextResponse.json({ error: 'action ต้องเป็น "draft" | "confirm" | "send"' }, { status: 400 });
  } catch (e: any) {
    console.error("[plan]", e?.message ?? e);
    return NextResponse.json({ error: "ทำรายการไม่สำเร็จ" }, { status: 500 });
  }
}
