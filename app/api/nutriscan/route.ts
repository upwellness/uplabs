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
    const { image_base64, mime_type, text_description, customer_id, meal_type, notes } = body;
    if (!image_base64 && !text_description) {
      return NextResponse.json({ error: "image_base64 หรือ text_description (อย่างน้อย 1)" }, { status: 400 });
    }

    // Optional: verify customer belongs to this coach (or admin)
    if (customer_id) {
      const supa = createClient();
      const { data: c } = await supa.from("customers").select("coach_id").eq("id", customer_id).maybeSingle();
      if (!c) return NextResponse.json({ error: "customer not found" }, { status: 404 });
      const isAdmin = session.profile.role === "admin";
      if (!isAdmin && c.coach_id !== session.user.id) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }

    // Call Gemini Vision (or text-only)
    let result: NutriScanResult;
    try {
      const args: Parameters<typeof analyzeFood>[0] = {
        context: { meal_time: meal_type },
      };
      if (image_base64) {
        args.imageBase64 = image_base64.replace(/^data:image\/\w+;base64,/, "");
        args.mimeType    = mime_type;
      }
      if (text_description) {
        args.textDescription = text_description;
      }
      result = await analyzeFood(args);
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

/**
 * GET /api/nutriscan
 *   ?customer_id=xxx  filter to a customer
 *   ?date=YYYY-MM-DD  filter to a day (uses created_at in UTC+7)
 *   ?limit=50         default 50
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(req.url);
  const customer_id = url.searchParams.get("customer_id");
  const date        = url.searchParams.get("date");
  const limit       = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const supa = createClient();
  let q = supa
    .from("nutriscan_scans")
    .select("id, food_identified, meal_type, calories_estimate, carb_g, protein_g, fat_g, fiber_g, glucose_impact_score, health_score, created_at, customer_id, notes")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (customer_id) q = q.eq("customer_id", customer_id);

  if (date) {
    // Bangkok TZ window
    const start = new Date(`${date}T00:00:00+07:00`).toISOString();
    const end   = new Date(`${date}T23:59:59.999+07:00`).toISOString();
    q = q.gte("created_at", start).lte("created_at", end);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scans: data ?? [] });
}
