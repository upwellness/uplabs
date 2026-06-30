import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

/** kcal from macro grams · Carb·Protein = 4, Fat = 9 (fiber not counted). */
function kcalFromMacros(carb: number, protein: number, fat: number): number {
  return Math.round(carb * 4 + protein * 4 + fat * 9);
}
/** Coerce to a finite, non-negative number or null. */
function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
const MEAL_TYPES = new Set(["breakfast", "lunch", "dinner", "snack"]);

/** GET /api/nutriscan/[id] — single scan detail */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const supa = createClient();
  const { data, error } = await supa
    .from("nutriscan_scans")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ scan: data });
}

/** DELETE /api/nutriscan/[id] */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const supa = createClient();
  const { error } = await supa.from("nutriscan_scans").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/nutriscan/[id] — edit a logged meal.
 * Editable: meal_type, notes, eaten_on, and macro grams (carb/protein/fat/fiber).
 * Calories are recomputed from the macro grams (kept consistent with the day totals).
 * Ownership is enforced by RLS via the session client (user_id = auth.uid() or admin),
 * exactly like GET/DELETE above.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid body" }, { status: 400 }); }

  const supa = createClient();

  // Load current row (RLS-scoped) so we can merge macros + refresh raw_analysis.
  const { data: existing, error: getErr } = await supa
    .from("nutriscan_scans")
    .select("id, raw_analysis, carb_g, protein_g, fat_g, fiber_g")
    .eq("id", params.id)
    .maybeSingle();
  if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const update: Record<string, any> = {};

  if ("meal_type" in body) {
    const mt = body.meal_type;
    if (mt !== null && (typeof mt !== "string" || !MEAL_TYPES.has(mt))) {
      return NextResponse.json({ error: "invalid meal_type" }, { status: 400 });
    }
    update.meal_type = mt ?? null;
  }

  if ("notes" in body) {
    update.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  }

  if ("eaten_on" in body) {
    const e = body.eaten_on;
    if (e !== null && !(typeof e === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e))) {
      return NextResponse.json({ error: "invalid eaten_on" }, { status: 400 });
    }
    update.eaten_on = e ?? null;
  }

  // Macro grams — merge each provided field over the current value, then recompute calories.
  const touchesMacro = ["carb_g", "protein_g", "fat_g", "fiber_g"].some((k) => k in body);
  if (touchesMacro) {
    const carb    = "carb_g"    in body ? num(body.carb_g)    : num(existing.carb_g);
    const protein = "protein_g" in body ? num(body.protein_g) : num(existing.protein_g);
    const fat     = "fat_g"     in body ? num(body.fat_g)     : num(existing.fat_g);
    const fiber   = "fiber_g"   in body ? num(body.fiber_g)   : num(existing.fiber_g);

    update.carb_g    = carb;
    update.protein_g = protein;
    update.fat_g     = fat;
    update.fiber_g   = fiber;
    update.calories_estimate = kcalFromMacros(carb ?? 0, protein ?? 0, fat ?? 0);

    // Keep raw_analysis.macros + calories_estimate in sync so the detail view stays truthful.
    const raw = (existing.raw_analysis && typeof existing.raw_analysis === "object") ? existing.raw_analysis : {};
    update.raw_analysis = {
      ...raw,
      calories_estimate: update.calories_estimate,
      macros: { ...((raw as any).macros ?? {}), carb_g: carb ?? 0, protein_g: protein ?? 0, fat_g: fat ?? 0, fiber_g: fiber ?? 0 },
    };
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no editable fields provided" }, { status: 400 });
  }

  const { data: row, error: updErr } = await supa
    .from("nutriscan_scans")
    .update(update)
    .eq("id", params.id)
    .select("id, food_identified, meal_type, calories_estimate, carb_g, protein_g, fat_g, fiber_g, glucose_impact_score, health_score, created_at, eaten_on, customer_id, notes")
    .maybeSingle();

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  if (!row)   return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ scan: row });
}
