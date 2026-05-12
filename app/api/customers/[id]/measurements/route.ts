import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-server";
import { enrichMeasurement } from "@/lib/bca-derive";
import type { Customer, Measurement } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const supa = getSupabase();
    const [{ data: customer, error: cErr }, { data: measurements, error: mErr }] = await Promise.all([
      supa.from("customers").select("*").eq("id", params.id).single(),
      supa.from("measurements").select("*").eq("customer_id", params.id).order("recorded_at", { ascending: false }),
    ]);
    if (cErr) throw cErr;
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
    const supa = getSupabase();
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
    return NextResponse.json({ measurement: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
