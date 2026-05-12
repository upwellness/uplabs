/**
 * UP Pulse rule engine — deterministic mapping from biomarker pattern → nutrient categories.
 *
 * Each rule has:
 *  - id, name (display)
 *  - condition (function over aggregated biomarkers)
 *  - nutrient category recommended
 *  - Nutrilite SKU candidates + dose hint
 *  - evidence grade A/B/C (A = systematic review/meta · B = RCT · C = observational/expert)
 *  - citation
 *
 * Pharmacist (จิ้น) can review + extend this list. Seed = 15 rules to start.
 */

export interface BiomarkerAggregates {
  days_with_data:        number;
  hr_avg:                number | null;
  rhr_avg:               number | null;     // resting HR averaged
  hr_max:                number | null;
  hr_variability:        number | null;     // (max - avg) avg over days
  steps_avg:             number | null;
  steps_min:             number | null;
  active_minutes_avg:    number | null;
  heart_minutes_avg:     number | null;
  calories_expended_avg: number | null;
  weight:                number | null;
  body_fat_pct:          number | null;
  sleep_hours_avg:       number | null;
  sleep_deep_avg:        number | null;
  sleep_rem_avg:         number | null;
}

export type Grade = "A" | "B" | "C";
export interface SkuRec {
  sku: string;
  dose: string;
  timing?: string;
}
export interface Rule {
  id: string;
  name: string;
  condition: (b: BiomarkerAggregates) => boolean;
  nutrient_category: string;
  why_th: string;
  evidence_grade: Grade;
  citation: string;
  skus: SkuRec[];
}

export const PULSE_RULES: Rule[] = [
  /* ── Cardiovascular / Heart ───────────────────────────── */
  {
    id: "rhr_elevated",
    name: "RHR สูงคงที่",
    condition: (b) => b.rhr_avg != null && b.rhr_avg > 70,
    nutrient_category: "Cardiovascular Support",
    why_th: "Resting HR สูงต่อเนื่อง associated with sub-optimal cardiac efficiency · CoQ10 + Omega-3 ช่วย mitochondrial function ของ heart muscle",
    evidence_grade: "B",
    citation: "Mortensen et al. JACC Heart Fail 2014 · Mozaffarian Circulation 2008",
    skus: [
      { sku: "Heart Q10",      dose: "1 เม็ด/วัน", timing: "หลังอาหารเช้า" },
      { sku: "Salmon Omega-3", dose: "2 เม็ด/วัน", timing: "กับอาหาร" },
    ],
  },
  {
    id: "hr_variability_high",
    name: "HR variability สูง",
    condition: (b) => b.hr_variability != null && b.hr_variability > 50,
    nutrient_category: "Stress / Adaptive Support",
    why_th: "ความแปรปรวน HR สูง บ่งชี้ autonomic stress · Magnesium + B-complex support nervous system",
    evidence_grade: "B",
    citation: "Boyle et al. Nutrients 2017 (Mg + stress) · Kennedy Nutrients 2016 (B-vit)",
    skus: [
      { sku: "Cal Mag D",       dose: "2 เม็ดก่อนนอน" },
      { sku: "B-Complex",       dose: "1 เม็ด/วัน",  timing: "หลังอาหารเช้า" },
    ],
  },

  /* ── Activity / Energy ─────────────────────────────────── */
  {
    id: "low_active_minutes",
    name: "Active minutes ต่ำ",
    condition: (b) => b.active_minutes_avg != null && b.active_minutes_avg < 20,
    nutrient_category: "Energy Support",
    why_th: "Activity ต่อวันต่ำกว่าเกณฑ์ WHO (30+ min) · associated with iron/B12 insufficiency, mitochondrial CoQ10 demand",
    evidence_grade: "B",
    citation: "WHO Physical Activity Guidelines 2020 · NHANES B12 + energy correlation",
    skus: [
      { sku: "Iron Folate",     dose: "1 เม็ด/วัน",  timing: "ระหว่างมื้อ · ห้ามกับชา/กาแฟ" },
      { sku: "B-Complex",       dose: "1 เม็ด/วัน",  timing: "หลังอาหารเช้า" },
    ],
  },
  {
    id: "low_steps",
    name: "Steps ต่ำ (sedentary)",
    condition: (b) => b.steps_avg != null && b.steps_avg < 5000,
    nutrient_category: "Muscle Preservation",
    why_th: "Steps ต่ำเรื้อรัง → sarcopenia risk · ต้อง protein intake สูงขึ้น (1.2 g/kg) · Vitamin D + Calcium ช่วย bone-muscle integrity",
    evidence_grade: "A",
    citation: "PROT-AGE Study 2013 · Bauer et al. JAMDA",
    skus: [
      { sku: "All Plant Protein", dose: "1 scoop/วัน" },
      { sku: "Cal Mag D",         dose: "2 เม็ด/วัน", timing: "กับอาหารเย็น" },
    ],
  },
  {
    id: "low_heart_minutes",
    name: "Heart minutes ต่ำ (low cardio intensity)",
    condition: (b) => b.heart_minutes_avg != null && b.heart_minutes_avg < 10,
    nutrient_category: "Cardio Foundation",
    why_th: "Heart minutes ต่ำ + ageing → reduced VO2max · CoQ10 + Omega-3 support cardiac mitochondria",
    evidence_grade: "B",
    citation: "Mortensen JACC 2014 · GISSI-Prevenzione trial",
    skus: [
      { sku: "Heart Q10",      dose: "1 เม็ด/วัน" },
      { sku: "Salmon Omega-3", dose: "2 เม็ด/วัน", timing: "กับอาหาร" },
    ],
  },

  /* ── Sleep ─────────────────────────────────────────────── */
  {
    id: "short_sleep",
    name: "Sleep < 6 ชม.",
    condition: (b) => b.sleep_hours_avg != null && b.sleep_hours_avg < 6,
    nutrient_category: "Sleep Quality",
    why_th: "Sleep < 6 hr ต่อเนื่อง associated with magnesium depletion · cortisol dysregulation · tryptophan-melatonin pathway support",
    evidence_grade: "A",
    citation: "Boyle Nutrients 2017 · Abbasi J Res Med Sci 2012",
    skus: [
      { sku: "Cal Mag D",   dose: "2 เม็ดก่อนนอน 30 นาที" },
    ],
  },
  {
    id: "low_deep_sleep",
    name: "Deep sleep ต่ำ",
    condition: (b) => b.sleep_deep_avg != null && b.sleep_deep_avg < 0.8 && b.sleep_hours_avg != null && b.sleep_hours_avg > 6,
    nutrient_category: "Deep Sleep Support",
    why_th: "Deep sleep <15% ของ total · Mg + Zn ช่วย slow-wave sleep · Omega-3 modulate cortisol",
    evidence_grade: "B",
    citation: "Cherasse Nutrients 2017 · Hansen Sleep Med 2014",
    skus: [
      { sku: "Cal Mag D",         dose: "2 เม็ดก่อนนอน" },
      { sku: "Salmon Omega-3",    dose: "2 เม็ด/วัน" },
    ],
  },

  /* ── Body Composition ─────────────────────────────────── */
  {
    id: "high_body_fat",
    name: "Body fat สูงกว่า normal",
    condition: (b) => b.body_fat_pct != null && b.body_fat_pct > 28,
    nutrient_category: "Metabolic Support",
    why_th: "Body fat >28% (M) / >32% (F) → metabolic dysfunction risk · Protein satiety + Omega-3 anti-inflammatory + fiber gut health",
    evidence_grade: "A",
    citation: "Calder Nutrients 2017 · Leidy AJCN 2015 (protein satiety)",
    skus: [
      { sku: "All Plant Protein", dose: "1-2 scoop/วัน" },
      { sku: "Salmon Omega-3",    dose: "2 เม็ด/วัน" },
      { sku: "Bodykey shake",     dose: "1 มื้อ/วัน แทนอาหาร" },
    ],
  },

  /* ── Foundational / Default ───────────────────────────── */
  {
    id: "default_multivit",
    name: "Foundational support",
    condition: (b) => b.days_with_data >= 3, // anyone with data
    nutrient_category: "Daily Foundation",
    why_th: "Phytonutrient + multi-vitamin baseline แนะนำสำหรับทุกผู้ใหญ่ — Double X เป็น signature ของ Nutrilite",
    evidence_grade: "A",
    citation: "ANDI 2015 phytonutrient gap study · Linus Pauling Institute",
    skus: [
      { sku: "Double X", dose: "3 เม็ดเช้า + 3 เม็ดเย็น · กับอาหาร" },
    ],
  },

  /* ── Gut / Inflammation ───────────────────────────────── */
  {
    id: "metabolic_inflammation",
    name: "Metabolic inflammation pattern",
    condition: (b) => b.rhr_avg != null && b.rhr_avg > 68 && b.body_fat_pct != null && b.body_fat_pct > 25,
    nutrient_category: "Gut + Anti-inflammatory",
    why_th: "RHR slightly elevated + body fat > 25% suggest low-grade systemic inflammation · prebiotic fiber + omega-3 EPA/DHA modulate",
    evidence_grade: "B",
    citation: "Calder Br J Nutr 2018 · Sonnenburg Cell 2019 (fiber-microbiome)",
    skus: [
      { sku: "CMS / Synbiotic",  dose: "1 ซอง/วัน" },
      { sku: "Salmon Omega-3",   dose: "2-3 เม็ด/วัน" },
    ],
  },
];

/** Compute aggregates from a list of readings */
export function aggregateBiomarkers(readings: Array<{ metric_type: string; value: number; recorded_at: string }>): BiomarkerAggregates {
  const daysSet = new Set<string>();
  const groups: Record<string, number[]> = {};
  for (const r of readings) {
    daysSet.add(r.recorded_at.slice(0, 10));
    (groups[r.metric_type] ??= []).push(r.value);
  }
  const avg = (arr?: number[]) => arr && arr.length > 0
    ? arr.reduce((a, b) => a + b, 0) / arr.length
    : null;

  const minVal = (arr?: number[]) => arr && arr.length > 0 ? Math.min(...arr) : null;

  // HR variability = (max - avg) per day, averaged
  const hr_max_arr = groups.hr_max ?? [];
  const hr_avg_arr = groups.hr_bpm ?? [];
  let hr_var: number | null = null;
  if (hr_max_arr.length > 0 && hr_avg_arr.length > 0) {
    const pairs = Math.min(hr_max_arr.length, hr_avg_arr.length);
    let sum = 0;
    for (let i = 0; i < pairs; i++) sum += hr_max_arr[i] - hr_avg_arr[i];
    hr_var = sum / pairs;
  }

  return {
    days_with_data:        daysSet.size,
    hr_avg:                avg(groups.hr_bpm),
    rhr_avg:               avg(groups.rhr),
    hr_max:                avg(groups.hr_max),
    hr_variability:        hr_var,
    steps_avg:             avg(groups.steps),
    steps_min:             minVal(groups.steps),
    active_minutes_avg:    avg(groups.active_minutes),
    heart_minutes_avg:     avg(groups.heart_minutes),
    calories_expended_avg: avg(groups.calories_expended),
    weight:                avg(groups.weight),
    body_fat_pct:          avg(groups.body_fat_pct),
    sleep_hours_avg:       avg((groups.sleep_total ?? groups.sleep_minutes ?? []).map((v) => v / 60)),
    sleep_deep_avg:        avg((groups.sleep_deep ?? []).map((v) => v / 60)),
    sleep_rem_avg:         avg((groups.sleep_rem ?? []).map((v) => v / 60)),
  };
}

/** Evaluate all rules against biomarkers → return matching */
export function evaluateRules(b: BiomarkerAggregates): Rule[] {
  return PULSE_RULES.filter((r) => {
    try { return r.condition(b); }
    catch { return false; }
  });
}
