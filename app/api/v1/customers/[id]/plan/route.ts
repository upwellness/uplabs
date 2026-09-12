import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk, apiError } from "@/lib/api/respond";
import { currentPlan, createDraft } from "@/lib/health-design/plan-store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET …/plan — the live plan. `final` when confirmed/sent; a draft is returned flagged `is_draft: true`. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "plan:read");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;
    const p = await currentPlan(params.id);
    if (!p) return apiOk({ plan: null, message: "ยังไม่มีแผน — ใช้ draftPlan เพื่อร่าง แล้วให้โค้ชยืนยันในแอป" }, { meta: { token: ctx.token.name, row_count: 0 } });
    return apiOk({
      plan_id: p.id, status: p.status, is_draft: p.status === "draft", goal: p.goal, created_at: p.created_at, confirmed_at: p.confirmed_at, sent_at: p.sent_at,
      plan: p.final ?? p.draft, coach_note: p.coach_note,
      note: p.status === "draft" ? "นี่คือร่างที่โค้ชยังไม่ยืนยัน — ห้ามส่งให้ลูกค้าเป็นแผนจริง" : "แผนที่โค้ชยืนยันแล้ว",
    }, { clinical: true, meta: { token: ctx.token.name, row_count: 1 } });
  });
}

/** POST …/plan — draft a new plan from the latest assessment. Confirm/send stay in the app. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "plan:write");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;
    let body: any = {};
    try { body = await req.json(); } catch { /* optional */ }
    const goal = ["loss", "longevity", "muscle"].includes(body?.goal) ? body.goal : null;
    const p = await createDraft(params.id, ctx.token.owner_user_id, goal);
    if (!p) return apiError("not_found", "ไม่พบลูกค้ารายนี้");
    return apiOk({ plan_id: p.id, status: p.status, is_draft: true, goal: p.goal, plan: p.draft,
      next: "โค้ชเปิด Customer 360 → การ์ดแผนดูแล → ตรวจ/แก้ → ยืนยัน → ส่งลูกค้า" }, { clinical: true, meta: { token: ctx.token.name, row_count: 1 } });
  });
}
