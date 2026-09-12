/**
 * Food log I/O. Decisions live in entries.ts (pure, tested). The log IS
 * `nutriscan_scans` — extended on 12 Sep 2026 with eaten_at / source / confirmation.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { summariseFood, type FoodEntryInput, type FoodRow, type FoodWindowSummary } from "./entries";

export interface StoredFoodEntry extends FoodRow {
  id: string; customer_id: string | null; description: string; meal_type: string | null; items: string[];
  time_known: boolean; source: string; estimated_by: string; confirmed_at: string | null; notes: string | null; created_at: string;
}

const COLS = "id, customer_id, food_identified, meal_type, items, eaten_at, time_known, source, estimated_by, confirmed_at, notes, calories_estimate, carb_g, protein_g, fat_g, fiber_g, glucose_impact_score, health_score, created_at";

const toEntry = (r: any): StoredFoodEntry => ({
  id: r.id, customer_id: r.customer_id, description: r.food_identified ?? "", meal_type: r.meal_type, items: r.items ?? [],
  eaten_at: r.eaten_at, time_known: r.time_known ?? true, source: r.source, estimated_by: r.estimated_by, confirmed_at: r.confirmed_at, notes: r.notes,
  calories: r.calories_estimate == null ? null : Number(r.calories_estimate), carb_g: r.carb_g == null ? null : Number(r.carb_g),
  protein_g: r.protein_g == null ? null : Number(r.protein_g), fat_g: r.fat_g == null ? null : Number(r.fat_g), fiber_g: r.fiber_g == null ? null : Number(r.fiber_g),
  glucose_impact_score: r.glucose_impact_score, health_score: r.health_score, created_at: r.created_at,
});

export async function insertEntry(opts: {
  customerId: string | null; userId: string; entry: FoodEntryInput; raw?: unknown; edited?: Record<string, unknown> | null;
}): Promise<StoredFoodEntry> {
  const e = opts.entry;
  const { data, error } = await createAdminClient().from("nutriscan_scans").insert({
    user_id: opts.userId, customer_id: opts.customerId,
    food_identified: e.description, meal_type: e.meal_type, notes: e.notes, items: e.items.length ? e.items : null,
    eaten_at: e.eaten_at.iso, eaten_on: e.eaten_at.date_bkk, time_known: e.eaten_at.time_known,
    source: e.source, estimated_by: e.estimated_by, confirmed_at: new Date().toISOString(), confirmed_by: opts.userId,
    edited: opts.edited ?? null,
    raw_analysis: opts.raw ?? { source: e.source, description: e.description, items: e.items },
    calories_estimate: e.calories == null ? null : Math.round(e.calories), carb_g: e.carb_g, protein_g: e.protein_g, fat_g: e.fat_g, fiber_g: e.fiber_g,
    glucose_impact_score: e.glucose_impact_score == null ? null : Math.round(e.glucose_impact_score),
    health_score: e.health_score == null ? null : Math.round(e.health_score),
  }).select(COLS).single();
  if (error || !data) throw new Error(error?.message ?? "insert failed");
  return toEntry(data);
}

/** Entries eaten between two instants (inclusive), oldest first. */
export async function listEntries(customerId: string, fromIso: string, toIso: string, limit = 500): Promise<StoredFoodEntry[]> {
  const { data } = await createAdminClient().from("nutriscan_scans").select(COLS)
    .eq("customer_id", customerId).gte("eaten_at", fromIso).lte("eaten_at", toIso)
    .order("eaten_at", { ascending: true }).limit(limit);
  return (data ?? []).map(toEntry);
}

/** Last N Bangkok days ending today, with the summary the assessment engine consumes. */
export async function foodWindow(customerId: string, days: number, nowMs = Date.now()): Promise<{ from: string; to: string; entries: StoredFoodEntry[]; summary: FoodWindowSummary }> {
  const BKK = 7 * 3_600_000;
  const todayBkk = new Date(nowMs + BKK).toISOString().slice(0, 10);
  const startBkk = new Date(nowMs + BKK - (days - 1) * 864e5).toISOString().slice(0, 10);
  const fromIso = new Date(Date.parse(`${startBkk}T00:00:00Z`) - BKK).toISOString();
  const toIso = new Date(Date.parse(`${todayBkk}T23:59:59.999Z`) - BKK).toISOString();
  const entries = await listEntries(customerId, fromIso, toIso);
  return { from: startBkk, to: todayBkk, entries, summary: summariseFood(entries, days) };
}
