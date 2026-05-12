import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supa = createClient();
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { data, error } = await supa.from("customers").select("*").eq("coach_id", user.id).order("name");
    if (error) throw error;
    return NextResponse.json({ customers: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supa = createClient();
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json();
    const { name, gender, birth_year, height } = body;
    if (!name || !gender) {
      return NextResponse.json({ error: "name and gender are required" }, { status: 400 });
    }
    const { data, error } = await supa
      .from("customers")
      .insert({ name, gender, birth_year, height, coach_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ customer: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
