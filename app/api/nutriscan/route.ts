import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer } from "@/lib/customers/access";
import { analyzeFood, type NutriScanResult } from "@/lib/nutriscan/gemini-vision";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST /api/nutriscan — analyze food image · save to DB · return result */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json();
    const { image_base64, mime_type, text_description, customer_id, meal_type, notes, eaten_on, save, apiKey } = body;
    if (!image_base64 && !text_description) {
      return NextResponse.json({ error: "image_base64 หรือ text_description (อย่างน้อย 1)" }, { status: 400 });
    }
    // Save to history? default true (only an explicit false skips the insert — "temp" scan).
    const shouldSave = save !== false;
    // Validate optional eaten_on (yyyy-mm-dd) — ignore anything malformed.
    const eatenOn: string | null =
      typeof eaten_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(eaten_on) ? eaten_on : null;
    // BYO key เท่านั้น — ไม่มี fallback คีย์ระบบ
    const userKey: string = typeof apiKey === "string" ? apiKey.trim() : "";
    if (!userKey) {
      return NextResponse.json({ error: "กรุณาใส่ API Key ก่อน" }, { status: 400 });
    }

    // Optional: verify customer belongs to this coach (or admin)
    if (customer_id) {
      const supa = createClient();
      const { data: c } = await supa.from("customers").select("coach_id").eq("id", customer_id).maybeSingle();
      if (!c) return NextResponse.json({ error: "customer not found" }, { status: 404 });
      const isAdmin = session.profile.role === "admin";
      if (!isAdmin && c.coach_id !== session.user.id && !(await isAssignedToCustomer(session.user.id, customer_id))) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }

    // Call Gemini Vision (or text-only)
    let result: NutriScanResult;
    try {
      const args: Parameters<typeof analyzeFood>[0] = {
        context: {
          meal_time: meal_type,
          // The user's "หมายเหตุ/hint" — helps the AI when the photo's proportions aren't exact.
          customer_note: typeof notes === "string" ? notes : undefined,
        },
      };
      if (image_base64) {
        args.imageBase64 = image_base64.replace(/^data:image\/\w+;base64,/, "");
        args.mimeType    = mime_type;
      }
      if (text_description) {
        args.textDescription = text_description;
      }
      result = await analyzeFood(args, userKey);
    } catch (e: any) {
      const msg = e?.message ?? "analysis failed";
      const status = msg === "กรุณาใส่ API Key" ? 400 : 500;
      return NextResponse.json({ error: msg }, { status });
    }

    if (result.error || result.food_identified === "ไม่สามารถระบุได้") {
      return NextResponse.json({ result, saved: false }, { status: 200 });
    }

    // "บันทึกเข้าประวัติ" toggle OFF → analyze only, never touch the DB.
    if (!shouldSave) {
      return NextResponse.json({ result, saved: false });
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
        eaten_on: eatenOn,
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
    .select("id, food_identified, meal_type, calories_estimate, carb_g, protein_g, fat_g, fiber_g, glucose_impact_score, health_score, created_at, eaten_on, customer_id, notes")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (customer_id) q = q.eq("customer_id", customer_id);

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Effective eaten date = eaten_on ?? created_at (Bangkok day). Match rows where EITHER
    //  • eaten_on = <date> (explicit), OR
    //  • eaten_on is null AND created_at falls within the Bangkok day window.
    const start = new Date(`${date}T00:00:00+07:00`).toISOString();
    const end   = new Date(`${date}T23:59:59.999+07:00`).toISOString();
    q = q.or(`eaten_on.eq.${date},and(eaten_on.is.null,created_at.gte.${start},created_at.lte.${end})`);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scans: data ?? [] });
}
