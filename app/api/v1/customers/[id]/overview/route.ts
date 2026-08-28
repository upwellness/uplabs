import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk } from "@/lib/api/respond";
import { getCustomer, getOverview, ageFrom } from "@/lib/api/data";

export const dynamic = "force-dynamic";

/**
 * GET …/overview — every factor at once, plus what is missing.
 * `never_tested` and `caveats` matter as much as the values: a caller summarising
 * this payload without them would report untested as fine.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "labs:read");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    const customer = await getCustomer(params.id);
    const ov = await getOverview(params.id);
    return apiOk({ customer: { ...customer, age: ageFrom(customer?.birth_date ?? null) }, ...ov },
      { clinical: true, meta: { token: ctx.token.name, row_count: ov.abnormal.length } });
  });
}
