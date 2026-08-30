import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk, apiError } from "@/lib/api/respond";
import { getCustomer, getLabRounds, ageFrom } from "@/lib/api/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateProfileEdit } from "@/lib/v2/identity";

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
      // Spelled out rather than left to a raw timestamp: an assistant reading this
      // must not summarise a retired profile as if it were the person's live record.
      retired: !!customer.disabled_at,
      ...(customer.disabled_at ? {
        retired_note: "โปรไฟล์นี้ถูกปิดใช้งานแล้ว — ข้อมูลยังอยู่ครบ แต่เจ้าของอาจไม่ได้ใช้บริการแล้ว หรือเป็นโปรไฟล์ซ้ำ · ควรยืนยันกับผู้ใช้ก่อนนำไปสรุป",
      } : {}),
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
    const FIELDS = ["name", "gender", "birth_date", "height"] as const;
    if (!FIELDS.some((k) => body[k] !== undefined)) {
      return apiError("bad_request", "ไม่มีฟิลด์ที่แก้ได้ — รองรับ name, gender, birth_date, height");
    }

    const admin = createAdminClient();

    // Same validator the web UI uses, and only over what was sent. An automation
    // writing a พ.ศ. year here would skew age, every reference range and PhenoAge
    // with nothing on screen looking wrong — and unlike the web form, there is no
    // human watching the field.
    const supplied = Object.fromEntries(
      FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]),
    ) as any;
    const check = validateProfileEdit(supplied);
    if (!check.ok) return apiError("bad_request", check.error!);

    const patch: Record<string, unknown> = {};
    for (const k of FIELDS) if (body[k] !== undefined) patch[k] = (check.value as any)[k];
    const { data, error } = await admin.from("customers").update(patch).eq("id", params.id)
      .select("id, name, gender, birth_date, height, coach_id").single();
    if (error) return apiError("bad_request", "แก้ไขไม่สำเร็จ — ตรวจรูปแบบข้อมูลที่ส่งมา");
    return apiOk(data, { meta: { token: ctx.token.name, row_count: 1 } });
  });
}
