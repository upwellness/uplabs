import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

/** Coach creates an intake link for a customer */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { customer_id } = await req.json();
    if (!customer_id) return NextResponse.json({ error: "customer_id required" }, { status: 400 });

    const supa = createClient();
    const { data: customer } = await supa.from("customers").select("id, coach_id").eq("id", customer_id).single();
    if (!customer) return NextResponse.json({ error: "customer not found" }, { status: 404 });

    const isAdmin = session.profile.role === "admin";
    if (!isAdmin && customer.coach_id !== session.user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const token = randomBytes(24).toString("base64url");

    const { error } = await supa.from("pulse_intakes").insert({
      customer_id,
      coach_id: session.user.id,
      token,
    });
    if (error) throw error;

    return NextResponse.json({
      token,
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/intake/${token}`,
      expires_in_days: 14,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
