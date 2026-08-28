import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk, apiError } from "@/lib/api/respond";
import { getCustomer, getLabRounds, ageFrom } from "@/lib/api/data";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "customers:read");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    const customer = await getCustomer(params.id);
    if (!customer) return apiError("not_found", "ไม่พบลูกค้ารายนี้");

    const admin = createAdminClient();
    const [{ count: labCount }, { count: measureCount }, { count: noteCount }] = await Promise.all([
      admin.from("customer_lab_values").select("id", { count: "exact", head: true }).eq("customer_id", params.id),
      admin.from("measurements").select("id", { count: "exact", head: true }).eq("customer_id", params.id),
      admin.from("coach_notes").select("id", { count: "exact", head: true }).eq("customer_id", params.id),
    ]);
    const latest = await getLabRounds(params.id, 1);

    return apiOk({
      ...customer,
      age: ageFrom(customer.birth_date),
      data_available: {
        lab_values: labCount ?? 0,
        measurements: measureCount ?? 0,
        notes: noteCount ?? 0,
        latest_lab_date: latest[0]?.recorded_at ?? null,
      },
    }, { meta: { token: ctx.token.name, row_count: 1 } });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "customers:write");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    let body: any;
    try { body = await req.json(); } catch { return apiError("bad_request", "body ต้องเป็น JSON"); }

    // allow-list — never spread the request body straight into an update
    const patch: Record<string, unknown> = {};
    for (const k of ["name", "gender", "birth_date", "height"]) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (Object.keys(patch).length === 0) {
      return apiError("bad_request", "ไม่มีฟิลด์ที่แก้ได้ — รองรับ name, gender, birth_date, height");
    }

    const admin = createAdminClient();
    const { data, error } = await admin.from("customers").update(patch).eq("id", params.id)
      .select("id, name, gender, birth_date, height, coach_id").single();
    if (error) return apiError("bad_request", "แก้ไขไม่สำเร็จ — ตรวจรูปแบบข้อมูลที่ส่งมา");
    return apiOk(data, { meta: { token: ctx.token.name, row_count: 1 } });
  });
}
