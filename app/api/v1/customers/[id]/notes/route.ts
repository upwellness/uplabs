import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk, apiError } from "@/lib/api/respond";
import { getCustomer, getNotes } from "@/lib/api/data";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "notes:read");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    const limit = Number(new URL(req.url).searchParams.get("limit") ?? 20);
    const [customer, rows] = await Promise.all([getCustomer(params.id), getNotes(params.id, limit)]);
    return apiOk({ customer, notes: rows }, { meta: { token: ctx.token.name, row_count: rows.length } });
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "notes:write");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    let body: any;
    try { body = await req.json(); } catch { return apiError("bad_request", "body ต้องเป็น JSON"); }
    const text = typeof body?.body === "string" ? body.body.trim() : "";
    if (!text) return apiError("bad_request", 'ต้องมี "body" (เนื้อความโน้ต)');

    const { data, error } = await createAdminClient().from("coach_notes")
      .insert({ customer_id: params.id, body: text.slice(0, 8000), pinned: body?.pinned === true })
      .select("id, body, pinned, created_at").single();
    if (error) return apiError("internal_error", "บันทึกโน้ตไม่สำเร็จ");
    return apiOk(data, { meta: { token: ctx.token.name, row_count: 1 } });
  });
}
