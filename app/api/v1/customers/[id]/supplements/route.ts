import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk } from "@/lib/api/respond";
import { getCustomer, getSupplements } from "@/lib/api/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "supplements:read");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    const [customer, s] = await Promise.all([getCustomer(params.id), getSupplements(params.id)]);
    return apiOk({
      customer, ...s,
      note: "ความปลอดภัยคู่ยาเป็นบันทึกของเภสัชกร ไม่ใช่คำสั่งแพทย์ — การเริ่มอาหารเสริมต้องผ่านแพทย์และเภสัชกรก่อนเสมอ",
    }, { clinical: true, meta: { token: ctx.token.name, row_count: s.schedule.length + s.safety.length } });
  });
}
