import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk } from "@/lib/api/respond";
import { getCustomer } from "@/lib/api/data";
import { wearableWindow } from "@/lib/health-design/wearable";

export const dynamic = "force-dynamic";

/** GET …/wearable?days=14 — daily sleep / HRV / resting HR / steps / recovery + averages. Position only; no grading. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "wearable:read");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;
    const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 14) || 14));
    const w = await wearableWindow(params.id, days);
    return apiOk({ customer: await getCustomer(params.id), window: { from: w.from, to: w.to, days }, source: w.source, summary: w.summary, daily: w.days,
      caveats: w.source ? ["ค่าเฉลี่ยจากวันที่มีข้อมูลเท่านั้น", "HRV และชีพจรขณะพักไม่มีเกณฑ์กลาง — เทียบกับตัวเองย้อนหลัง"] : ["ยังไม่ได้เชื่อมนาฬิกา/อุปกรณ์สวมใส่ — ใช้ UP Pulse (/v2/pulse) เชื่อม Whoop หรืออัปโหลด Apple Health"] },
      { clinical: true, meta: { token: ctx.token.name, row_count: w.days.length } });
  });
}
