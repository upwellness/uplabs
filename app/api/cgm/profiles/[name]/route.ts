import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

/**
 * Fetch readings + meals for a profile. Supports `?from=epochMs&to=epochMs`.
 */
export async function GET(req: Request, { params }: { params: { name: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const profile = decodeURIComponent(params.name);
    const url = new URL(req.url);
    const fromQs = url.searchParams.get("from");
    const toQs   = url.searchParams.get("to");

    const supa = createClient();

    let readingsQ = supa.from("cgm_readings")
      .select("id, profile_name, reading_timestamp, date_str, glucose")
      .eq("profile_name", profile)
      .order("reading_timestamp", { ascending: true })
      .limit(20000);
    if (fromQs) readingsQ = readingsQ.gte("reading_timestamp", Number(fromQs));
    if (toQs)   readingsQ = readingsQ.lte("reading_timestamp", Number(toQs));

    let mealsQ = supa.from("cgm_meals")
      .select("id, profile_name, meal_timestamp, date_str, description, carbs, protein, fat")
      .eq("profile_name", profile)
      .order("meal_timestamp", { ascending: true });
    if (fromQs) mealsQ = mealsQ.gte("meal_timestamp", Number(fromQs));
    if (toQs)   mealsQ = mealsQ.lte("meal_timestamp", Number(toQs));

    const [{ data: readings, error: rErr }, { data: meals, error: mErr }] = await Promise.all([
      readingsQ, mealsQ,
    ]);
    if (rErr) throw rErr;
    if (mErr) throw mErr;

    return NextResponse.json({
      readings: (readings ?? []).map((r: any) => ({ ...r, reading_timestamp: Number(r.reading_timestamp) })),
      meals:    (meals    ?? []).map((m: any) => ({ ...m, meal_timestamp:    Number(m.meal_timestamp) })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
