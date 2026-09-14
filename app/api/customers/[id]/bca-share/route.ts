import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { canManageCustomer } from "@/lib/customers/access";
import { issueBcaShare } from "@/lib/bca-reveal/store";

export const dynamic = "force-dynamic";
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/** POST { measurement_id?: string } — link to the customer-facing result page for a scan (latest when omitted). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { data: c } = await createAdminClient().from("customers").select("id, coach_id").eq("id", params.id).maybeSingle();
  if (!c) return NextResponse.json({ error: "customer not found" }, { status: 404 });
  const ok = session.profile.role === "admin" || (c as any).coach_id === session.user.id || (await canManageCustomer(session.user.id, params.id));
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: any = {};
  try { body = await req.json(); } catch { /* optional */ }
  const r = await issueBcaShare(params.id, typeof body?.measurement_id === "string" ? body.measurement_id : null);
  if (!r) return NextResponse.json({ error: "ยังไม่มีค่า BCA ของลูกค้ารายนี้" }, { status: 404 });
  return NextResponse.json({ url: `${siteUrl()}/r/bca/${r.token}`, measurement_id: r.measurement_id });
}
