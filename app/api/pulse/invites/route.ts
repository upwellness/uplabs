import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

/**
 * Coach creates an invite for a customer.
 * Returns the public URL the coach sends via LINE.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { customer_id, provider } = await req.json();
    if (!customer_id) return NextResponse.json({ error: "customer_id required" }, { status: 400 });
    const inviteProvider = provider === "whoop" ? "whoop" : "google_fit";

    const supa = createClient();

    // Verify coach owns customer (or is admin) — RLS will enforce too
    const { data: customer, error: cErr } = await supa
      .from("customers").select("id, name, coach_id").eq("id", customer_id).single();
    if (cErr || !customer) return NextResponse.json({ error: "customer not found" }, { status: 404 });

    const isAdmin = session.profile.role === "admin";
    if (!isAdmin && customer.coach_id !== session.user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const token = randomBytes(24).toString("base64url");

    const { error } = await supa.from("pulse_invites").insert({
      token,
      customer_id,
      coach_id: session.user.id,
      provider: inviteProvider,
    });
    if (error) throw error;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    return NextResponse.json({
      token,
      provider: inviteProvider,
      url: `${siteUrl}/connect/${token}`,
      expires_in_days: 7,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
