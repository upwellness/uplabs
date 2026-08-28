import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk } from "@/lib/api/respond";
import { getCustomer, getLabRounds, buildCompare, ageFrom } from "@/lib/api/data";

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

    const rounds = Number(new URL(req.url).searchParams.get("rounds") ?? 3);
    const customer = await getCustomer(params.id);
    const list = await getLabRounds(params.id, rounds);

    if (list.length === 0) {
      return apiOk({ customer, rounds: [], metrics: [], message: "ยังไม่มีผลแล็บในระบบ" },
        { meta: { token: ctx.token.name, row_count: 0 } });
    }

    const cmp = buildCompare(list);
    return apiOk({ customer: { ...customer, age: ageFrom(customer?.birth_date ?? null) }, ...cmp },
      { clinical: true, meta: { token: ctx.token.name, row_count: cmp.metrics.length } });
  });
}
