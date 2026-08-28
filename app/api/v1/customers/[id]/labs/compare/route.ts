import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk } from "@/lib/api/respond";
import { getCustomer, getLabRoundsDetailed, buildCompare, ageFrom } from "@/lib/api/data";

export const dynamic = "force-dynamic";

/**
 * GET …/labs/compare?rounds=3
 * The table already aligned and differenced — the caller should never have to work
 * out which value belongs to which visit, or subtract two numbers itself.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "labs:read");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    const url = new URL(req.url);
    const rounds = Number(url.searchParams.get("rounds") ?? 3);
    // A one-value visit is almost always a home-device reading, not a panel to compare
    // against. `?include_single=true` opts back in; whatever is skipped is reported.
    const minValues = url.searchParams.get("include_single") === "true" ? 1 : 2;

    const customer = await getCustomer(params.id);
    const { rounds: list, skipped, total_available } = await getLabRoundsDetailed(params.id, rounds, { minValues });

    if (list.length === 0) {
      return apiOk({ customer, rounds: [], metrics: [], message: "ยังไม่มีผลแล็บในระบบ" },
        { meta: { token: ctx.token.name, row_count: 0 } });
    }

    const cmp = buildCompare(list);
    return apiOk({
      customer: { ...customer, age: ageFrom(customer?.birth_date ?? null) },
      ...cmp,
      skipped_rounds: skipped,
      total_visits_on_record: total_available,
      ...(skipped.length ? { skipped_note: "รอบที่มีค่าเดียว (มักเป็นค่าที่วัดเองที่บ้าน) ไม่ถูกนับเป็นรอบเทียบ — ใส่ ?include_single=true ถ้าต้องการรวมด้วย" } : {}),
    },
      { clinical: true, meta: { token: ctx.token.name, row_count: cmp.metrics.length } });
  });
}
