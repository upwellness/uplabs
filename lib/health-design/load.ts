/**
 * Gather one customer's five sources and hand them to the pure engine. Also owns the
 * `health_assessments` table: every computation is stored (never overwritten) so a
 * customer can see how their picture moved as data arrived.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomer, ageFrom } from "@/lib/api/data";
import { getProfileNames, getReadings, latestDate, shiftDate, todayBangkok, toPoints } from "@/lib/api/cgm-data";
import { computeMetrics } from "@/lib/api/cgm-metrics";
import { foodWindow } from "@/lib/food/store";
import { wearableWindow } from "./wearable";
import { assess, ENGINE_VERSION, type AssessInput, type HealthAssessment, type LabPoint, type WearableSummary, type FoodSummary } from "./assess";

export type Trigger = "manual" | "lab_import" | "lab_review" | "bca" | "cgm_import" | "wearable_sync" | "food_log" | "api";

const WINDOW_DAYS = 14;

export async function loadInput(customerId: string): Promise<AssessInput | null> {
  const admin = createAdminClient();
  const cust = await getCustomer(customerId);
  if (!cust) return null;
  const today = todayBangkok();
  const since = shiftDate(today, -WINDOW_DAYS);

  const [{ data: labRows }, { data: ms }] = await Promise.all([
    admin.from("customer_lab_values")
      .select("metric_key, metric_label_th, value, value_num, unit, status, recorded_at")
      .eq("customer_id", customerId).order("recorded_at", { ascending: false }).limit(1000),
    admin.from("measurements").select("recorded_at, weight, fat_pct, muscle_pct, visceral, body_age")
      .eq("customer_id", customerId).order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const labs: LabPoint[] = (labRows ?? []).map((r: any) => ({
    metric_key: r.metric_key, label_th: r.metric_label_th, value: r.value,
    value_num: r.value_num == null ? null : Number(r.value_num), unit: r.unit, status: r.status, recorded_at: String(r.recorded_at),
  }));

  // CGM — last 14 days that actually have data (same window rule as getCgmMetrics)
  let cgm: AssessInput["cgm"] = null;
  const prof = await getProfileNames(customerId);
  if (prof && prof.profiles.length) {
    const last = await latestDate(prof.profiles);
    if (last) {
      const from = shiftDate(last, -(WINDOW_DAYS - 1));
      const rows = await getReadings(prof.profiles, from, last);
      if (rows.length) cgm = { ...computeMetrics(toPoints(rows)), window: { from, to: last } };
    }
  }

  const wearable = (await wearableWindow(customerId, WINDOW_DAYS, since)).summary;

  // Food — the food log (nutriscan_scans by eaten_at), summarised over logged days only
  let food: FoodSummary | null = null;
  const fw = await foodWindow(customerId, WINDOW_DAYS);
  if (fw.summary.entries > 0) {
    const s = fw.summary;
    food = {
      window_days: s.window_days, days_logged: s.days_logged, entries: s.entries,
      avg_calories: s.avg_calories, avg_protein_g: s.avg_protein_g, avg_carb_g: s.avg_carb_g, avg_fat_g: s.avg_fat_g,
      avg_health_score: s.avg_health_score, avg_glucose_impact: s.avg_glucose_impact,
    };
  }

  return {
    customer: {
      gender: cust.gender === "male" || cust.gender === "female" ? cust.gender : null,
      age: ageFrom(cust.birth_date), height_cm: cust.height ? Number(cust.height) || null : null,
    },
    labs, measurement: ms ? { ...(ms as any), recorded_at: String((ms as any).recorded_at) } : null,
    cgm, wearable, food, today,
  };
}

export interface StoredAssessment { id: string; customer_id: string; computed_at: string; trigger: Trigger; assessment: HealthAssessment }

/** Compute and persist. Returns null when the customer does not exist. */
export async function runAssessment(customerId: string, trigger: Trigger): Promise<StoredAssessment | null> {
  const input = await loadInput(customerId);
  if (!input) return null;
  const assessment = assess(input);
  const admin = createAdminClient();
  const { data, error } = await admin.from("health_assessments").insert({
    customer_id: customerId, trigger, engine_version: ENGINE_VERSION,
    confidence: assessment.confidence, sources_used: assessment.sources_used, payload: assessment,
  }).select("id, computed_at").single();
  if (error || !data) throw new Error(error?.message ?? "insert failed");
  return { id: (data as any).id, customer_id: customerId, computed_at: (data as any).computed_at, trigger, assessment };
}

export async function latestAssessment(customerId: string): Promise<StoredAssessment | null> {
  const { data } = await createAdminClient().from("health_assessments")
    .select("id, customer_id, computed_at, trigger, payload").eq("customer_id", customerId)
    .order("computed_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const d = data as any;
  return { id: d.id, customer_id: d.customer_id, computed_at: d.computed_at, trigger: d.trigger, assessment: d.payload };
}

export async function assessmentHistory(customerId: string, limit = 10) {
  const { data } = await createAdminClient().from("health_assessments")
    .select("id, computed_at, trigger, confidence, sources_used").eq("customer_id", customerId)
    .order("computed_at", { ascending: false }).limit(limit);
  return (data ?? []) as { id: string; computed_at: string; trigger: Trigger; confidence: string; sources_used: string[] }[];
}

/**
 * Fire after any write that changes the picture (lab import, BCA, CGM import, …).
 * Never lets an assessment failure break the write that triggered it.
 */
export async function recomputeQuietly(customerId: string, trigger: Trigger): Promise<void> {
  try { await runAssessment(customerId, trigger); }
  catch (e: any) { console.error(`[health-design] recompute after ${trigger} failed:`, e?.message ?? e); }
}
