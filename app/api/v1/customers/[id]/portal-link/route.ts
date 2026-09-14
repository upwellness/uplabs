import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk, apiError } from "@/lib/api/respond";
import { getCustomer } from "@/lib/api/data";
import { issuePortalToken } from "@/lib/health-design/portal";

export const dynamic = "force-dynamic";

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

/**
 * POST …/portal-link { rotate?: boolean } — the customer's own page (/my/<token>).
 * Same behaviour as the coach button: first call creates, later calls return the same
 * link, `rotate: true` invalidates the old one immediately. Needs `links:write`.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "links:write");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;
    if (!siteUrl()) return apiError("internal_error", "ระบบยังไม่ได้ตั้งค่า NEXT_PUBLIC_SITE_URL");
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body is fine */ }
    const rotate = body?.rotate === true;
    const token = await issuePortalToken(params.id, rotate);
    if (!token) return apiError("not_found", "ไม่พบลูกค้ารายนี้");
    return apiOk({
      customer: await getCustomer(params.id), url: `${siteUrl()}/my/${token}`, rotated: rotate,
      note: rotate ? "ลิงก์เดิมใช้ไม่ได้แล้ว — ส่งลิงก์ใหม่ให้ลูกค้า" : "ลิงก์นี้เป็นของลูกค้าคนเดียว ใครมีลิงก์ก็เปิดได้ — ส่งให้ลูกค้าโดยตรง อย่าโพสต์ที่สาธารณะ",
    }, { meta: { token: ctx.token.name, row_count: 1 } });
  });
}
