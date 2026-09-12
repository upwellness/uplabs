import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk, apiError } from "@/lib/api/respond";
import { latestAssessment, runAssessment, assessmentHistory } from "@/lib/health-design/load";
import { DOMAIN_LABEL_TH } from "@/lib/health-design/assess";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET …/assessment — the customer's latest UP Health Design assessment.
 * Computes one on first call if none is stored yet, so a reader never gets an
 * empty answer for a customer who has data. `?history=1` adds the last 10 runs.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "assessment:read");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    let stored = await latestAssessment(params.id);
    if (!stored) stored = await runAssessment(params.id, "api");
    if (!stored) return apiError("not_found", "ไม่พบลูกค้ารายนี้");

    const url = new URL(req.url);
    const history = url.searchParams.get("history") ? await assessmentHistory(params.id) : undefined;
    return apiOk(
      { ...stored, domain_labels: DOMAIN_LABEL_TH, ...(history ? { history } : {}) },
      { clinical: true, meta: { token: ctx.token.name, row_count: 1 } },
    );
  });
}

/** POST …/assessment — recompute now (e.g. right after importing a file). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "assessment:write");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    const stored = await runAssessment(params.id, "api");
    if (!stored) return apiError("not_found", "ไม่พบลูกค้ารายนี้");
    return apiOk({ ...stored, domain_labels: DOMAIN_LABEL_TH }, { clinical: true, meta: { token: ctx.token.name, row_count: 1 } });
  });
}
