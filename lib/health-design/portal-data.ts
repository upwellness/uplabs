/**
 * Everything the customer portal (/my/<token> — SPEC-Mobile-Portal.md) needs, loaded
 * once on the server and handed to the client as one JSON object. The client never
 * talks to Supabase; it renders this and calls the two token routes (food, explain).
 *
 * Nothing here decides a health verdict — levels come from the assessment engine and
 * the lab row's own status, both already computed by lib/. This file only gathers and
 * shapes. Sizes are capped so the payload stays small on a phone (§7: ≤150 KB).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { latestAssessment, runAssessment, type StoredAssessment } from "./load";
import { currentPlan, planProgress, type StoredPlan } from "./plan-store";
import type { HealthAssessment, Level } from "./assess";
import { fromStatus } from "./assess";
import type { HealthPlan } from "./plan";
import type { PlanProgress } from "./progress";
import { wearableWindow, type WearableDay } from "./wearable";
import { foodWindow } from "@/lib/food/store";
import type { StoredFoodEntry } from "@/lib/food/store";
import type { FoodWindowSummary } from "@/lib/food/entries";
import { getProfileNames, getReadings, latestDate, shiftDate, todayBangkok, toPoints } from "@/lib/api/cgm-data";
import { computeMetrics, type CgmMetrics } from "@/lib/api/cgm-metrics";
import { ageFrom } from "@/lib/api/data";
import { PORTAL_EXPLAIN_CAP, explainUsedToday } from "./portal";
import type { PortalCustomer } from "./portal";
import { panelOf, PANEL_LABEL_TH, type LabPanel } from "./glossary";

/* ── shapes the client renders ───────────────────────────────────────────────── */

export interface LabItem {
  metric: string; label_th: string; value: number | null; value_text: string | null; unit: string | null;
  level: Level | null; recorded_at: string;
  /** previous value for the arrow; null when this is the first result */
  prev: number | null; prev_at: string | null;
  history: { at: string; value: number }[];
}
export interface LabPanelGroup { panel: LabPanel; label_th: string; items: LabItem[] }

export interface BcaPoint { at: string; weight: number | null; fat_pct: number | null; muscle_pct: number | null; visceral: number | null; body_age: number | null; bmr: number | null }

export interface CgmData {
  metrics: CgmMetrics; window: { from: string; to: string };
  /** the last civil day with readings, downsampled — minutes since local midnight → mg/dL */
  last_day: { date: string; points: { m: number; v: number }[]; meals: { m: number; label: string }[] } | null;
}

export interface WearableData {
  source: string | null; days: WearableDay[];
  hr: { date: string; avg: number | null; min: number | null; max: number | null }[];
  connection: { provider: string; status: string; last_sync_at: string | null; last_sync_error: string | null } | null;
}

export interface FoodData {
  window: { from: string; to: string }; summary: FoodWindowSummary;
  entries: StoredFoodEntry[];
  targets: { kcal: number; carb_g: number; protein_g: number; fat_g: number } | null;
  ai_used_today: number; ai_cap: number;
}

export interface PlanData {
  status: StoredPlan["status"]; plan: HealthPlan; confirmed_at: string | null; sent_at: string | null; coach_note: string | null;
  progress: PlanProgress | null;
}

export interface PortalData {
  today: string;
  customer: { first_name: string; initial: string; gender: string | null; age: number | null; height_cm: number | null; coach_name: string | null; has_line_group: boolean };
  assessment: { computed_at: string; a: HealthAssessment } | null;
  labs: { latest_at: string | null; panels: LabPanelGroup[] };
  bca: BcaPoint[];                 // newest first, ≤ 8
  cgm: CgmData | null;
  wearable: WearableData;
  food: FoodData;
  plan: PlanData | null;
  explain: { used_today: number; cap: number };
}

/* ── helpers ────────────────────────────────────────────────────────────────── */

const num = (v: unknown): number | null => { const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN; return Number.isFinite(n) ? n : null; };
const labLevel = (status: unknown): Level | null =>
  status === "optimal" || status === "good" || status === "caution" || status === "warning" || status === "danger" ? fromStatus(status) : null;

function groupLabs(rows: any[], assessment: HealthAssessment | null): { latest_at: string | null; panels: LabPanelGroup[] } {
  // newest first per metric_key
  const byKey = new Map<string, any[]>();
  for (const r of [...rows].sort((a, b) => String(b.recorded_at).localeCompare(String(a.recorded_at)))) {
    const k = String(r.metric_key ?? "").trim(); if (!k) continue;
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(r);
  }
  // levels the engine graded take precedence over the row's stored status
  const engineLevel = new Map<string, Level | null>();
  if (assessment) for (const d of Object.values(assessment.domains)) if ("drivers" in d) for (const drv of d.drivers) if (drv.source === "labs") engineLevel.set(drv.metric, drv.level);

  const items: LabItem[] = [];
  for (const [metric, hist] of byKey) {
    const latest = hist[0];
    const numeric = hist.filter((h) => num(h.value_num) != null);
    items.push({
      metric, label_th: latest.metric_label_th ?? metric, value: num(latest.value_num), value_text: latest.value ?? null, unit: latest.unit ?? null,
      level: engineLevel.has(metric) ? engineLevel.get(metric)! : labLevel(latest.status), recorded_at: String(latest.recorded_at),
      prev: numeric.length > 1 && numeric[0] === latest ? num(numeric[1].value_num) : null, prev_at: numeric.length > 1 && numeric[0] === latest ? String(numeric[1].recorded_at) : null,
      history: numeric.slice(0, 6).reverse().map((h) => ({ at: String(h.recorded_at), value: num(h.value_num)! })),
    });
  }
  const groups = new Map<LabPanel, LabItem[]>();
  for (const it of items) { const p = panelOf(it.metric); (groups.get(p) ?? groups.set(p, []).get(p)!).push(it); }
  const order: LabPanel[] = ["metabolic", "lipid", "liver", "kidney", "inflammation", "thyroid", "blood", "vitamins", "other"];
  const panels = order.filter((p) => groups.has(p)).map((p) => ({ panel: p, label_th: PANEL_LABEL_TH[p], items: groups.get(p)!.sort((a, b) => a.label_th.localeCompare(b.label_th, "th")) }));
  const latest_at = items.length ? items.map((i) => i.recorded_at).sort().at(-1)! : null;
  return { latest_at, panels };
}

const BKK = 7 * 3_600_000;
/** minutes since Bangkok midnight of the reading's own day */
const minuteOfDay = (ms: number) => Math.floor(((ms + BKK) % 864e5) / 60_000);

async function loadCgm(customerId: string, food: StoredFoodEntry[]): Promise<CgmData | null> {
  const prof = await getProfileNames(customerId);
  if (!prof || !prof.profiles.length) return null;
  const last = await latestDate(prof.profiles);
  if (!last) return null;
  const from = shiftDate(last, -13);
  const rows = await getReadings(prof.profiles, from, last);
  if (!rows.length) return null;
  const metrics = computeMetrics(toPoints(rows));
  const dayRows = rows.filter((r) => r.date_str === last);
  const step = Math.max(1, Math.ceil(dayRows.length / 288));
  const points = dayRows.filter((_, i) => i % step === 0).map((r) => ({ m: minuteOfDay(r.reading_timestamp), v: Math.round(r.glucose) }));
  const meals = food.filter((e) => e.time_known && new Date(Date.parse(e.eaten_at) + BKK).toISOString().slice(0, 10) === last)
    .map((e) => ({ m: minuteOfDay(Date.parse(e.eaten_at)), label: e.description.slice(0, 24) }));
  return { metrics, window: { from, to: last }, last_day: { date: last, points, meals } };
}

/* ── main ────────────────────────────────────────────────────────────────────── */

export async function loadPortalData(c: PortalCustomer): Promise<PortalData> {
  const admin = createAdminClient();
  const today = todayBangkok();
  const since14 = shiftDate(today, -14);

  const [stored, plan, pp, labRes, bcaRes, fw, ww, hrRes, connRes, coachRes, lineRes, cust, explainUsed] = await Promise.all([
    (async (): Promise<StoredAssessment | null> => (await latestAssessment(c.id)) ?? (await runAssessment(c.id, "manual").catch(() => null)))(),
    currentPlan(c.id),
    planProgress(c.id).catch(() => null),
    admin.from("customer_lab_values").select("metric_key, metric_label_th, value, value_num, unit, status, recorded_at").eq("customer_id", c.id).order("recorded_at", { ascending: false }).limit(600),
    admin.from("measurements").select("recorded_at, weight, fat_pct, muscle_pct, visceral, body_age, bmr").eq("customer_id", c.id).order("recorded_at", { ascending: false }).limit(8),
    foodWindow(c.id, 7),
    wearableWindow(c.id, 14),
    admin.from("pulse_readings").select("recorded_at, metric_type, value").eq("customer_id", c.id).in("metric_type", ["hr_bpm", "hr_min", "hr_max"]).gte("recorded_at", `${since14}T00:00:00Z`).order("recorded_at", { ascending: true }).limit(200),
    admin.from("pulse_connections").select("provider, status, last_sync_at, last_sync_error, connected_at").eq("customer_id", c.id).order("connected_at", { ascending: false }).limit(1).maybeSingle(),
    c.coach_id ? admin.from("profiles").select("display_name").eq("id", c.coach_id).maybeSingle() : Promise.resolve({ data: null } as any),
    admin.from("line_bot_groups").select("line_group_id").eq("customer_id", c.id).eq("push_enabled", true).limit(1).maybeSingle(),
    admin.from("customers").select("height, birth_date").eq("id", c.id).maybeSingle(),
    explainUsedToday(c.id),
  ]);

  const a = stored?.assessment ?? null;
  const cgm = await loadCgm(c.id, fw.entries);

  // heart-rate rows → per day
  const hrBy = new Map<string, { avg: number | null; min: number | null; max: number | null }>();
  for (const r of (hrRes.data ?? []) as any[]) {
    const d = String(r.recorded_at).slice(0, 10); const rec = hrBy.get(d) ?? hrBy.set(d, { avg: null, min: null, max: null }).get(d)!;
    const v = num(r.value); if (v == null) continue;
    if (r.metric_type === "hr_bpm") rec.avg = v; else if (r.metric_type === "hr_min") rec.min = v; else rec.max = v;
  }

  const final = plan?.final ?? null;
  const targets = final?.nutrition.targets ? { kcal: final.nutrition.targets.kcal, carb_g: final.nutrition.targets.c, protein_g: final.nutrition.targets.p, fat_g: final.nutrition.targets.f } : null;
  const aiUsed = fw.entries.filter((e) => Date.parse(e.created_at) > Date.now() - 864e5 && e.source !== "api").length;

  const first = c.name.trim().split(/\s+/)[0] || "คุณ";
  return {
    today,
    customer: {
      first_name: first, initial: first.replace(/^(คุณ|พี่|น้อง)/, "").slice(0, 1) || first.slice(0, 1),
      gender: c.gender, age: ageFrom((cust.data as any)?.birth_date ?? c.birth_date), height_cm: num((cust.data as any)?.height),
      coach_name: (() => { const n = String((coachRes.data as any)?.display_name ?? "").trim(); return /\p{L}/u.test(n) ? n : null; })(), has_line_group: !!lineRes.data, // an ID-only display name is not a name to greet with
    },
    assessment: stored && a ? { computed_at: stored.computed_at, a } : null,
    labs: groupLabs((labRes.data ?? []) as any[], a),
    bca: ((bcaRes.data ?? []) as any[]).map((r) => ({ at: String(r.recorded_at), weight: num(r.weight), fat_pct: num(r.fat_pct), muscle_pct: num(r.muscle_pct), visceral: num(r.visceral), body_age: num(r.body_age), bmr: num(r.bmr) })),
    cgm,
    wearable: {
      source: ww.source, days: ww.days,
      hr: [...hrBy.entries()].map(([date, v]) => ({ date, ...v })),
      connection: connRes.data ? { provider: (connRes.data as any).provider, status: (connRes.data as any).status, last_sync_at: (connRes.data as any).last_sync_at, last_sync_error: (connRes.data as any).last_sync_error ?? null } : null,
    },
    food: { window: { from: fw.from, to: fw.to }, summary: fw.summary, entries: fw.entries.slice(-40).reverse(), targets, ai_used_today: aiUsed, ai_cap: 40 },
    plan: plan && (plan.status === "sent" || plan.status === "confirmed") && final
      ? { status: plan.status, plan: final, confirmed_at: plan.confirmed_at, sent_at: plan.sent_at, coach_note: plan.coach_note, progress: pp?.progress ?? null }
      : null,
    explain: { used_today: explainUsed, cap: PORTAL_EXPLAIN_CAP },
  };
}
