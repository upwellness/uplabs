import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supa = getSupabase();
    const { data, error } = await supa.from("customers").select("*").order("name");
    if (error) throw error;
    return NextResponse.json({ customers: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, gender, birth_year, height, coach_id } = body;
    if (!name || !gender) {
      return NextResponse.json({ error: "name and gender are required" }, { status: 400 });
    }
    const supa = getSupabase();
    const { data, error } = await supa
      .from("customers")
      .insert({ name, gender, birth_year, height, coach_id })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ customer: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
