import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

/**
 * PATCH/DELETE a single measurement.
 * Admin can access any; coach can only modify measurements of their own customers.
 */
async function authorize(measurementId: string) {
  const session = await getSession();
  if (!session) return { error: "unauthenticated", status: 401 as const };

  const supa = createClient();
  const { data: m, error } = await supa
    .from("measurements")
    .select("id, customer_id, customers!inner(coach_id)")
    .eq("id", measurementId)
    .single();
  if (error || !m) return { error: "not found", status: 404 as const };

  const isAdmin = session.profile.role === "admin";
  const coachId = (m.customers as any).coach_id;
  if (!isAdmin && coachId !== session.user.id) {
    return { error: "forbidden", status: 403 as const };
  }
  return { supa };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await authorize(params.id);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const { weight, fat_pct, visceral, muscle_pct, body_age, bmr, recorded_at } = body;

    const update: Record<string, unknown> = {};
    if (weight     !== undefined) update.weight     = weight;
    if (fat_pct    !== undefined) update.fat_pct    = fat_pct;
    if (visceral   !== undefined) update.visceral   = visceral;
    if (muscle_pct !== undefined) update.muscle_pct = muscle_pct;
    if (body_age   !== undefined) update.body_age   = body_age;
    if (bmr        !== undefined) update.bmr        = bmr;
    if (recorded_at!== undefined) update.recorded_at= recorded_at;

    const { data, error } = await auth.supa
      .from("measurements").update(update).eq("id", params.id).select().single();
    if (error) throw error;
    revalidateTag("dashboard");
    return NextResponse.json({ measurement: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await authorize(params.id);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { error } = await auth.supa.from("measurements").delete().eq("id", params.id);
    if (error) throw error;
    revalidateTag("dashboard");
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
