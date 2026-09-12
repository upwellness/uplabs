import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { canManageCustomer } from "@/lib/customers/access";
import { issuePortalToken } from "@/lib/health-design/portal";

export const dynamic = "force-dynamic";
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/** POST { rotate?: boolean } — the coach gets (or rotates) the customer's /my/<token> link. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { data: c } = await createAdminClient().from("customers").select("id, coach_id").eq("id", params.id).maybeSingle();
  if (!c) return NextResponse.json({ error: "customer not found" }, { status: 404 });
  const ok = session.profile.role === "admin" || (c as any).coach_id === session.user.id || (await canManageCustomer(session.user.id, params.id));
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: any = {};
  try { body = await req.json(); } catch { /* optional */ }
  const token = await issuePortalToken(params.id, body?.rotate === true);
  return NextResponse.json({ url: `${siteUrl()}/my/${token}`, rotated: body?.rotate === true });
}
