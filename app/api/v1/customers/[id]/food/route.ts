import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk, apiError } from "@/lib/api/respond";
import { getCustomer } from "@/lib/api/data";
import { validateEntry } from "@/lib/food/entries";
import { insertEntry, foodWindow } from "@/lib/food/store";
import { recomputeQuietly } from "@/lib/health-design/load";

export const dynamic = "force-dynamic";

/** GET …/food?days=14 — entries eaten in the window + per-day summary (averages over logged days only). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "food:read");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;
    const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 14) || 14));
    const w = await foodWindow(params.id, days);
    return apiOk({ customer: await getCustomer(params.id), window: { from: w.from, to: w.to, days }, summary: w.summary, entries: w.entries,
      caveats: ["ตัวเลขมาจากมื้อที่บันทึกเท่านั้น มื้อที่ไม่ได้บันทึกไม่ถูกนับ", "ค่าแคลอรี/มาโครเป็นการประมาณที่คนยืนยันแล้ว ไม่ใช่ค่าที่วัด"] },
      { clinical: true, meta: { token: ctx.token.name, row_count: w.entries.length } });
  });
}

/**
 * POST …/food — log one or more meals the person has already confirmed.
 * Body: { entries: [{ eaten_at, description, items?, calories?, carb_g?, protein_g?, fat_g?, meal_type?, notes?, confirmed: true }, …] }
 * The AI on the other end estimated the numbers and showed them; `confirmed: true` is
 * its assertion that the person accepted. Time is never inferred here — see
 * readFoodPhotoDate for old photos.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "food:write");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    let body: any;
    try { body = await req.json(); } catch { return apiError("bad_request", "body ต้องเป็น JSON"); }
    const list = Array.isArray(body?.entries) ? body.entries : body && typeof body === "object" && "description" in body ? [body] : [];
    if (list.length === 0 || list.length > 50) return apiError("bad_request", '"entries" ต้องเป็น array 1–50 รายการ');

    const now = new Date().toISOString();
    const validated = list.map((e: unknown, i: number) => ({ i, r: validateEntry(e, now, { source: "api", estimated_by: "client_ai" }) }));
    const bad = validated.filter((v: any) => !v.r.ok);
    if (bad.length) return apiError("bad_request", "บางรายการไม่ผ่าน — ไม่บันทึกเลยสักรายการ", { rejected: bad.map((v: any) => ({ index: v.i, error: v.r.error })) });

    const saved = [];
    for (const v of validated) saved.push(await insertEntry({ customerId: params.id, userId: ctx.token.owner_user_id!, entry: (v.r as any).value }));
    await recomputeQuietly(params.id, "food_log");
    return apiOk({ inserted: saved.length, entries: saved, next: `GET /api/v1/customers/${params.id}/food?days=14` },
      { meta: { token: ctx.token.name, row_count: saved.length } });
  });
}
