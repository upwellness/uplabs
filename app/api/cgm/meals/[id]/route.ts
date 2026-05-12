import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json();
    const update: Record<string, unknown> = {};
    if (body.meal_timestamp !== undefined) {
      update.meal_timestamp = Number(body.meal_timestamp);
      update.date_str       = new Date(Number(body.meal_timestamp)).toISOString().slice(0, 10);
    }
    if (body.description !== undefined) update.description = body.description;
    if (body.carbs       !== undefined) update.carbs       = body.carbs;
    if (body.protein     !== undefined) update.protein     = body.protein;
    if (body.fat         !== undefined) update.fat         = body.fat;

    const supa = createClient();
    const { data, error } = await supa.from("cgm_meals").update(update).eq("id", params.id).select().single();
    if (error) throw error;
    return NextResponse.json({ meal: { ...data, meal_timestamp: Number(data.meal_timestamp) } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const { error } = await supa.from("cgm_meals").delete().eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
