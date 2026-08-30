import { withApi, visibleCustomerIds } from "@/lib/api/auth";
import { apiOk } from "@/lib/api/respond";
import { intentCatalogue } from "@/lib/api/resolver";
import { SCOPE_LABEL_TH } from "@/lib/api/scopes";
import { describeReach } from "@/lib/api/reach";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/meta — "what can this token actually do?"
 *
 * The first call any client should make. Returning the scope list, the customer
 * reach, and the full intent catalogue means an assistant on the other end never
 * has to discover its own permissions by trying things and reading 403s.
 */
export async function GET(req: Request) {
  return withApi(req, async (ctx) => {
    const visible = await visibleCustomerIds(ctx);

    let customerCount: number | null = null;
    if (visible.all) {
      const { count } = await createAdminClient()
        .from("customers").select("id", { count: "exact", head: true }).is("disabled_at", null);
      customerCount = count ?? null;
    } else {
      customerCount = visible.ids.length;
    }

    const admin = createAdminClient();
    const { count: used } = await admin
      .from("api_token_logs").select("id", { count: "exact", head: true })
      .eq("token_id", ctx.token.id)
      .gte("ts", new Date(Date.now() - 60_000).toISOString());

    return apiOk({
      token: {
        name: ctx.token.name,
        prefix: ctx.token.token_prefix,
        scopes: ctx.token.scopes ?? [],
        scope_labels: (ctx.token.scopes ?? []).map((s) => SCOPE_LABEL_TH[s as keyof typeof SCOPE_LABEL_TH] ?? s),
        customer_scope: ctx.token.customer_scope,
        customers_visible: customerCount,
        expires_at: ctx.token.expires_at,
        owner: { id: ctx.token.owner_user_id, role: ctx.ownerRole },
        reach: {
          kind: ctx.reach.kind,
          description: describeReach(ctx.reach, customerCount),
          // set when the stored scope asked for more than the owner may currently have
          downgraded: ctx.reach.kind === "all" ? false : ctx.reach.downgraded,
          ...(ctx.reach.kind !== "all" && ctx.reach.downgraded ? { downgrade_reason: ctx.reach.reason } : {}),
        },
      },
      rate_limit: {
        per_minute: ctx.token.rate_limit_per_min ?? 60,
        used_last_minute: used ?? 0,
      },
      intents: intentCatalogue(),
      endpoints: {
        query: "POST /api/v1/query",
        openapi: "GET /api/v1/openapi.json",
        customers: "GET /api/v1/customers?q=",
        labs_compare: "GET /api/v1/customers/{id}/labs/compare?rounds=3",
        overview: "GET /api/v1/customers/{id}/overview",
      },
      how_to_use:
        "ส่งคำสั่งภาษาไทย/อังกฤษไปที่ POST /api/v1/query หรือเรียก endpoint ตรง ๆ ก็ได้ · ระบบคืนข้อมูลดิบให้ไปเรียบเรียงเอง ไม่มี LLM ฝั่งนี้",
      access_note:
        "token นี้เห็นลูกค้าได้ไม่เกินกว่าที่เจ้าของ token เห็นเองในระบบ ณ ตอนนี้ — ถ้าเจ้าของถูกย้ายสายงานหรือเปลี่ยนบทบาท ขอบเขตของ token จะเปลี่ยนตามทันที",
    }, { meta: { token: ctx.token.name } });
  });
}
