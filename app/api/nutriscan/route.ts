import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { analyzeFood, type NutriScanResult } from "@/lib/nutriscan/gemini-vision";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST /api/nutriscan — analyze food image · save to DB · return result */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json();
    const { image_base64, mime_type, customer_id, meal_type, notes } = body;
    if (!image_base64 || !mime_type) {
      return NextResponse.json({ error: "image_base64 + mime_type required" }, { status: 400 });
    }

    // Strip data URL prefix if present
    const cleanBase64 = image_base64.replace(/^data:image\/\w+;base64,/, "");

    // Call Gemini Vision
    let result: NutriScanResult;
    try {
      result = await analyzeFood({
        imageBase64: cleanBase64,
        mimeType: mime_type,
        context: { meal_time: meal_type },
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message ?? "analysis failed" }, { status: 500 });
    }

    if (result.error || result.food_identified === "ไม่สามารถระบุได้") {
      return NextResponse.json({ result, saved: false }, { status: 200 });
    }

    // Save to DB
    const supa = createClient();
    const { data: row, error: insErr } = await supa
      .from("nutriscan_scans")
      .insert({
        user_id: session.user.id,
        customer_id: customer_id ?? null,
        food_identified: result.food_identified,
        meal_type: meal_type ?? null,
        notes: notes ?? null,
        raw_analysis: result,
        calories_estimate:    result.calories_estimate ?? null,
        carb_g:               result.macros?.carb_g ?? null,
        protein_g:            result.macros?.protein_g ?? null,
        fat_g:                result.macros?.fat_g ?? null,
        fiber_g:              result.macros?.fiber_g ?? null,
        glucose_impact_score: result.glucose_impact?.score ?? null,
        health_score:         result.health_score?.score ?? null,
      })
      .select("id, created_at")
      .single();

    if (insErr) {
      // Still return result even if save failed (don't lose AI work)
      return NextResponse.json({ result, saved: false, save_error: insErr.message });
    }

    return NextResponse.json({ result, saved: true, scan: row });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "internal error" }, { status: 500 });
  }
}

/** GET /api/nutriscan — list current user's recent scans */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const supa = createClient();
  const { data, error } = await supa
    .from("nutriscan_scans")
    .select("id, food_identified, meal_type, calories_estimate, glucose_impact_score, health_score, created_at, customer_id")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scans: data ?? [] });
}
