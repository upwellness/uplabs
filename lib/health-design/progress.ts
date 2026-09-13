/**
 * Progress against a 90-day plan — closes the loop assessment → plan → follow-up.
 *
 * Compares the assessment the plan was drafted from (baseline) with the latest one.
 * Only measured values move the needle: a goal with no newer reading is
 * "no_new_data", never "no change". Direction per metric is a fact about the number
 * (lower fat%, higher HDL); "improving" is a fact about the band (watch → good).
 */
import type { HealthAssessment, Driver, Level, DomainKey } from "./assess";
import type { HealthPlan } from "./plan";

export type GoalStatus = "achieved" | "improving" | "no_change" | "worsening" | "no_new_data";

export interface MetricChange { metric: string; label_th: string; unit: string | null; from: number; to: number; delta: number; better: boolean | null; from_level: Level | null; to_level: Level | null; measured_at: string | null }
export interface GoalProgress { domain: DomainKey; target: string; status: GoalStatus; changes: MetricChange[]; note: string }
export interface PlanProgress {
  baseline_at: string; current_at: string; day: number; days_left: number;
  goals: GoalProgress[];
  due_now: { what: string; when_days: number; overdue_days: number }[];
  summary_th: string;
}

const RANK: Record<Level, number> = { good: 0, watch: 1, attention: 2 };
/** Metrics where a higher number is the good direction. */
const HIGHER_IS_BETTER = new Set(["hdl", "muscle_pct", "egfr", "cgm_tir", "sleep", "steps", "recovery", "protein_per_kg", "food_coverage"]);
/** Informational metrics: never judged. */
const NO_DIRECTION = new Set(["cgm_gmi", "hrv", "rhr", "calories", "food_glucose_impact", "food_health_score", "weight", "creatinine", "protein_g"]);


const driversOf = (a: HealthAssessment, d: Exclude<DomainKey, "health_age">) => new Map(a.domains[d].drivers.map((x) => [x.metric, x]));
const numeric = (d: Driver | undefined) => (d && typeof d.value === "number" ? d.value : d && typeof d.value === "string" && /^\d+(\.\d+)?$/.test(d.value) ? Number(d.value) : null);

function compareDomain(base: HealthAssessment, cur: HealthAssessment, domain: Exclude<DomainKey, "health_age">): MetricChange[] {
  const b = driversOf(base, domain), c = driversOf(cur, domain);
  const out: MetricChange[] = [];
  for (const [metric, curD] of c) {
    const baseD = b.get(metric); if (!baseD) continue;
    const from = numeric(baseD), to = numeric(curD);
    if (from == null || to == null) continue;
    // a reading that is not newer than the baseline's is the same reading — no news
    if (curD.recorded_at && baseD.recorded_at && curD.recorded_at <= baseD.recorded_at) continue;
    const delta = Math.round((to - from) * 10) / 10;
    let better: boolean | null = null;
    if (!NO_DIRECTION.has(metric) && delta !== 0) better = HIGHER_IS_BETTER.has(metric) ? delta > 0 : delta < 0;
    out.push({ metric, label_th: curD.label_th, unit: curD.unit ?? null, from, to, delta, better, from_level: baseD.level, to_level: curD.level, measured_at: curD.recorded_at ?? null });
  }
  return out;
}

function goalStatus(changes: MetricChange[], curLevel: Level | null): GoalStatus {
  if (changes.length === 0) return "no_new_data";
  const judged = changes.filter((c) => c.better !== null);
  const levelMoves = changes.filter((c) => c.from_level && c.to_level && c.from_level !== c.to_level);
  if (curLevel === "good" && levelMoves.some((c) => RANK[c.to_level!] < RANK[c.from_level!])) return "achieved";
  if (levelMoves.some((c) => RANK[c.to_level!] > RANK[c.from_level!])) return "worsening";
  if (judged.length === 0) return "no_change";
  const good = judged.filter((c) => c.better).length, bad = judged.length - good;
  if (good > bad) return "improving";
  if (bad > good) return "worsening";
  return "no_change";
}

const STATUS_TH: Record<GoalStatus, string> = { achieved: "ถึงเป้าแล้ว", improving: "ดีขึ้น", no_change: "ยังไม่เปลี่ยน", worsening: "แย่ลง", no_new_data: "ยังไม่มีข้อมูลใหม่" };

export function computeProgress(opts: { baseline: HealthAssessment; baseline_at: string; current: HealthAssessment; current_at: string; plan: HealthPlan; plan_confirmed_at: string | null; today: string }): PlanProgress {
  const start = opts.plan_confirmed_at ?? opts.baseline_at;
  const day = Math.max(0, Math.floor((Date.parse(opts.today) - Date.parse(start)) / 864e5));
  const goals: GoalProgress[] = opts.plan.goals_90d.map((g) => {
    if (g.domain === "health_age") return { domain: g.domain, target: g.target, status: "no_new_data" as GoalStatus, changes: [], note: "" };
    const changes = compareDomain(opts.baseline, opts.current, g.domain);
    const status = goalStatus(changes, opts.current.domains[g.domain].level);
    const note = status === "no_new_data"
      ? "ยังไม่มีค่าใหม่หลังเริ่มแผน — วัด/ตรวจตามกำหนดแล้วระบบจะเทียบให้"
      : changes.filter((c) => c.better !== null).map((c) => `${c.label_th} ${c.from}→${c.to}${c.unit ? ` ${c.unit}` : ""} (${c.delta > 0 ? "+" : ""}${c.delta})`).join(" · ");
    return { domain: g.domain, target: g.target, status, changes, note };
  });
  const due_now = opts.plan.retest.filter((r) => day >= r.when_days).map((r) => ({ what: r.what, when_days: r.when_days, overdue_days: day - r.when_days }));
  const counts = goals.reduce<Record<string, number>>((m, g) => ((m[g.status] = (m[g.status] ?? 0) + 1), m), {});
  const parts = (Object.keys(STATUS_TH) as GoalStatus[]).filter((k) => counts[k]).map((k) => `${STATUS_TH[k]} ${counts[k]}`);
  return {
    baseline_at: opts.baseline_at, current_at: opts.current_at, day, days_left: Math.max(0, 90 - day), goals, due_now,
    summary_th: `วันที่ ${day}/90 · เป้า ${goals.length} ข้อ: ${parts.join(" · ") || "—"}${due_now.length ? ` · ถึงกำหนดตรวจ ${due_now.length} รายการ` : ""}`,
  };
}
export { STATUS_TH as GOAL_STATUS_TH };
