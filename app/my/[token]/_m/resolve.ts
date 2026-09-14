/**
 * Turn "the customer tapped <metric>" into one view model for the detail sheet:
 * the engine's driver (value, level, note, percentile), the glossary line, the bands,
 * and a history series from whichever table the metric lives in. Client-side, pure.
 */
import type { PortalData } from "@/lib/health-design/portal-data";
import type { Driver, DomainKey, Level } from "@/lib/health-design/assess";
import { DOMAIN_LABEL_TH } from "@/lib/health-design/assess";
import { bandsFor, explain, type Band, type GlossaryEntry } from "@/lib/health-design/glossary";

export interface MetricView {
  metric: string; domain: DomainKey | null; label_th: string;
  value: number | string | null; unit: string | null; level: Level | null; note: string | null;
  recorded_at: string | null;
  reference: Driver["reference"] | null;
  glossary: GlossaryEntry | null; bands: Band[] | null;
  history: { at: string; value: number }[];
  /** where the history comes from — tells the user which page shows more */
  source_page: "src-labs" | "src-bca" | "src-cgm" | "src-wearable" | "food" | null;
}

const DOMAIN_OF_METRIC: Record<string, DomainKey> = {
  hba1c: "metabolic", fbs: "metabolic", glucose: "metabolic", cgm_tir: "metabolic", cgm_tbr: "metabolic", cgm_cv: "metabolic", cgm_gmi: "metabolic", food_glucose_impact: "metabolic",
  fat_pct: "body_comp", muscle_pct: "body_comp", visceral: "body_comp", bmi: "body_comp", weight: "body_comp", body_age: "body_comp",
  ldl: "cardio_lipid", hdl: "cardio_lipid", triglyceride: "cardio_lipid", tg: "cardio_lipid", cholesterol: "cardio_lipid", total_cholesterol: "cardio_lipid", hs_crp: "cardio_lipid", crp: "cardio_lipid", rhr: "cardio_lipid",
  alt_sgpt: "liver_kidney", alt: "liver_kidney", ast_sgot: "liver_kidney", ast: "liver_kidney", egfr: "liver_kidney", creatinine: "liver_kidney", uric_acid: "liver_kidney",
  sleep: "recovery", recovery: "recovery", hrv: "recovery", steps: "recovery",
  food_coverage: "nutrition", protein_per_kg: "nutrition", protein_g: "nutrition", calories: "nutrition", food_health_score: "nutrition",
};
export const domainOfMetric = (m: string): DomainKey | null => DOMAIN_OF_METRIC[m] ?? null;

const BCA_FIELD: Record<string, keyof PortalData["bca"][number]> = { fat_pct: "fat_pct", muscle_pct: "muscle_pct", visceral: "visceral", weight: "weight", body_age: "body_age", bmr: "bmr" };
const WEAR_FIELD: Record<string, "steps" | "sleep_min" | "hrv" | "rhr" | "recovery_pct"> = { steps: "steps", sleep: "sleep_min", hrv: "hrv", rhr: "rhr", recovery: "recovery_pct" };

export function resolveMetric(data: PortalData, metric: string, domainHint: DomainKey | null): MetricView | null {
  const a = data.assessment?.a ?? null;
  const domain = domainHint ?? domainOfMetric(metric);
  let driver: Driver | null = null;
  if (a && domain && domain !== "health_age") driver = a.domains[domain].drivers.find((d) => d.metric === metric) ?? null;
  if (!driver && a) for (const k of Object.keys(a.domains) as DomainKey[]) { if (k === "health_age") continue; const d = a.domains[k].drivers.find((x) => x.metric === metric); if (d) { driver = d; break; } }

  const labItem = data.labs.panels.flatMap((p) => p.items).find((i) => i.metric === metric) ?? null;
  const g = explain(metric);
  const bands = bandsFor(metric, data.customer.gender === "male" || data.customer.gender === "female" ? data.customer.gender : null);

  let history: { at: string; value: number }[] = [];
  let source_page: MetricView["source_page"] = null;
  if (labItem) { history = labItem.history; source_page = "src-labs"; }
  else if (BCA_FIELD[metric]) { const f = BCA_FIELD[metric]; history = [...data.bca].reverse().filter((b) => b[f] != null).map((b) => ({ at: b.at, value: b[f] as number })); source_page = "src-bca"; }
  else if (metric === "bmi" && data.customer.height_cm) { const h = data.customer.height_cm / 100; history = [...data.bca].reverse().filter((b) => b.weight != null).map((b) => ({ at: b.at, value: Math.round((b.weight! / (h * h)) * 10) / 10 })); source_page = "src-bca"; }
  else if (WEAR_FIELD[metric]) { const f = WEAR_FIELD[metric]; history = data.wearable.days.filter((d) => d[f] != null).map((d) => ({ at: d.date, value: metric === "sleep" ? Math.round((d[f] as number) / 6) / 10 : (d[f] as number) })); source_page = "src-wearable"; }
  else if (metric.startsWith("cgm_") && data.cgm) { source_page = "src-cgm"; }
  else if (metric.startsWith("food_") || metric === "calories" || metric.startsWith("protein")) { source_page = "food"; }

  if (!driver && !labItem) return null;
  return {
    metric, domain, label_th: driver?.label_th ?? labItem?.label_th ?? metric,
    value: driver?.value ?? labItem?.value ?? labItem?.value_text ?? null, unit: driver?.unit ?? labItem?.unit ?? null,
    level: driver ? driver.level : (labItem?.level ?? null), note: driver?.note ?? null,
    recorded_at: driver?.recorded_at ?? labItem?.recorded_at ?? null, reference: driver?.reference ?? null,
    glossary: g, bands, history, source_page,
  };
}

/** One plain line per domain from what the engine graded — no new judgement, just counting. */
export function domainSummary(data: PortalData, k: Exclude<DomainKey, "health_age">): string {
  const a = data.assessment?.a; if (!a) return "ยังไม่มีข้อมูล";
  const d = a.domains[k];
  if (!d.drivers.length) return "ยังไม่มีข้อมูลด้านนี้";
  const bad = d.drivers.filter((x) => x.level === "attention"), watch = d.drivers.filter((x) => x.level === "watch"), good = d.drivers.filter((x) => x.level === "good");
  const parts: string[] = [];
  if (bad.length) parts.push(`${bad.map((x) => x.label_th).join(", ")} อยู่ในช่วงที่ต้องใส่ใจ`);
  if (watch.length) parts.push(`${watch.map((x) => x.label_th).join(", ")} ควรติดตาม`);
  if (good.length) parts.push(bad.length || watch.length ? `ที่เหลือ ${good.length} ค่าอยู่ในเกณฑ์ดี` : `ทั้ง ${good.length} ค่าอยู่ในเกณฑ์ดี`);
  if (!parts.length) parts.push("มีแต่ค่าที่ใช้ดูแนวโน้ม ยังไม่มีเกณฑ์ตัดสิน");
  return parts.join(" · ");
}

export const DOMAIN_ORDER: DomainKey[] = ["metabolic", "body_comp", "cardio_lipid", "liver_kidney", "recovery", "nutrition", "health_age"];
export const domainLabel = (k: DomainKey) => DOMAIN_LABEL_TH[k];
export const DOMAIN_SOURCE_PAGE: Record<DomainKey, MetricView["source_page"][]> = {
  metabolic: ["src-labs", "src-cgm"], body_comp: ["src-bca"], cardio_lipid: ["src-labs"], liver_kidney: ["src-labs"], recovery: ["src-wearable"], nutrition: ["food"], health_age: ["src-labs"],
};
