import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk, apiError } from "@/lib/api/respond";
import { getCustomer, getMeasurements } from "@/lib/api/data";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "measurements:read");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    const limit = Number(new URL(req.url).searchParams.get("limit") ?? 12);
    const [customer, rows] = await Promise.all([getCustomer(params.id), getMeasurements(params.id, limit)]);
    return apiOk({ customer, measurements: rows },
      { clinical: true, meta: { token: ctx.token.name, row_count: rows.length } });
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "measurements:write");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    let body: any;
    try { body = await req.json(); } catch { return apiError("bad_request", "body ต้องเป็น JSON"); }
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(body?.recorded_at ?? ""))) {
      return apiError("bad_request", 'ต้องมี "recorded_at" รูปแบบ YYYY-MM-DD');
    }

    const row: Record<string, unknown> = { customer_id: params.id, recorded_at: body.recorded_at };
    for (const k of ["weight", "fat_pct", "muscle_pct", "visceral", "body_age", "bmr", "bmi"]) {
      if (body[k] !== undefined) row[k] = body[k];
    }

    const { data, error } = await createAdminClient().from("measurements").insert(row).select("*").single();
    if (error) return apiError("bad_request", "บันทึกค่า BCA ไม่สำเร็จ — ตรวจชื่อฟิลด์ที่ส่งมา");
    return apiOk(data, { meta: { token: ctx.token.name, row_count: 1 } });
  });
}
