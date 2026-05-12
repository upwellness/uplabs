import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

function epochToDateStr(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export async function POST(req: Request, { params }: { params: { name: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const profile = decodeURIComponent(params.name);
    const body = await req.json();
    const { meal_timestamp, description, carbs, protein, fat } = body;
    if (!meal_timestamp) return NextResponse.json({ error: "meal_timestamp required" }, { status: 400 });

    const supa = createClient();
    const { data, error } = await supa.from("cgm_meals").insert({
      profile_name:   profile,
      meal_timestamp: Number(meal_timestamp),
      date_str:       epochToDateStr(Number(meal_timestamp)),
      description:    description ?? "มื้ออาหาร",
      carbs:   carbs   ?? null,
      protein: protein ?? null,
      fat:     fat     ?? null,
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ meal: { ...data, meal_timestamp: Number(data.meal_timestamp) } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
