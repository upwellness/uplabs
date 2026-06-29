import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer } from "@/lib/customers/access";
import { enrichMeasurement } from "@/lib/bca-derive";
import type { Customer, Measurement } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const { data: customer, error: cErr } = await supa
      .from("customers").select("*").eq("id", params.id).single();
    if (cErr) throw cErr;

    // Non-admin can only access their own customers
    const isAdmin = session.profile.role === "admin";
    if (!isAdmin && customer.coach_id !== session.user.id && !(await isAssignedToCustomer(session.user.id, params.id))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { data: measurements, error: mErr } = await supa
      .from("measurements").select("*")
      .eq("customer_id", params.id)
      .order("recorded_at", { ascending: false });
    if (mErr) throw mErr;

    const enriched = (measurements ?? []).map((m: Measurement) => enrichMeasurement(m, customer as Customer));
    return NextResponse.json({ customer, measurements: enriched });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { weight, fat_pct, visceral, muscle_pct, body_age, bmr, recorded_at } = body;
    if (!weight) {
      return NextResponse.json({ error: "weight is required" }, { status: 400 });
    }
    const supa = createClient();
    const { data, error } = await supa
      .from("measurements")
      .insert({
        customer_id: params.id,
        weight, fat_pct, visceral, muscle_pct, body_age, bmr,
        recorded_at: recorded_at ?? new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    revalidateTag("dashboard");
    return NextResponse.json({ measurement: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
