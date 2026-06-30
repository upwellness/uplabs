/**
 * UP Labs v2 · Pulse — extra report sections (BCA · CGM · Food).
 * ──────────────────────────────────────────────────────────────
 * Pure, server-safe summary builders for the THREE conditional sections that the
 * v2 Wearable report renders ONLY when the customer has that data:
 *
 *   1. buildBcaSummary    — body composition (measurements table)
 *   2. buildCgmSummary    — continuous glucose (cgm_readings, linked via cgm_profile_names)
 *   3. buildFoodSummary   — nutrition (nutriscan_scans)
 *   4. buildCombinedInsight — heuristic "ภาพรวมเชื่อมโยง" text tying wearable + labs + the above
 *
 * Every builder returns `null` when there is nothing to show, so the view can do
 * `summary && <Section …/>` and skip absent sections (TOC skips them too).
 *
 * No external AI — all analysis is deterministic text derived from the numbers.
 * DB numerics arrive as strings (Supabase) → coerce with num().
 */

import type { WearableReport, LabMetricTrend } from "./wearable-report";

/* ───────────────────────── shared helpers ───────────────────────── */

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** YYYY-MM-DD (local) from an ISO/date string or epoch-ms. */
const dayKey = (v: string | number | null | undefined): string => {
  if (v == null) return "";
  if (typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  return v.split("T")[0].split(" ")[0];
};

/* ═══════════════════════════ 1 · BCA ═══════════════════════════ */

export interface MeasurementRow {
  weight: number | string | null;
  fat_pct: number | string | null;
  muscle_pct: number | string | null;
  visceral: number | string | null;
  body_age: number | string | null;
  bmr: number | string | null;
  recorded_at: string;
}

export interface BcaPoint {
  date: string;          // YYYY-MM-DD
  weight: number | null;
  fat_pct: number | null;
  muscle_pct: number | null;
  visceral: number | null;
  body_age: number | null;
  bmr: number | null;
}

export interface BcaDelta {
  key: "weight" | "fat_pct" | "muscle_pct" | "visceral";
  label: string;
  unit: string;
  first: number | null;
  latest: number | null;
  delta: number | null;     // latest − first
  goodDown: boolean;        // lower is better?
}

export interface BcaSummary {
  points: BcaPoint[];        // chronological, ≥1
  count: number;
  spanDays: number;
  latest: BcaPoint;
  first: BcaPoint;
  deltas: BcaDelta[];
  analysis: string[];        // 1–4 Thai sentences
}

export function buildBcaSummary(rows: MeasurementRow[]): BcaSummary | null {
  if (!rows || rows.length === 0) return null;
  const points: BcaPoint[] = rows
    .map((r) => ({
      date: dayKey(r.recorded_at),
      weight: num(r.weight),
      fat_pct: num(r.fat_pct),
      muscle_pct: num(r.muscle_pct),
      visceral: num(r.visceral),
      body_age: num(r.body_age),
      bmr: num(r.bmr),
    }))
    .filter((p) => p.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (points.length === 0) return null;

  const first = points[0];
  const latest = points[points.length - 1];
  const spanDays = Math.max(
    0,
    Math.round((new Date(latest.date).getTime() - new Date(first.date).getTime()) / 86_400_000),
  );

  const mkDelta = (
    key: BcaDelta["key"], label: string, unit: string, goodDown: boolean,
  ): BcaDelta => {
    const f = first[key];
    const l = latest[key];
    return { key, label, unit, first: f, latest: l, delta: f != null && l != null ? round(l - f, 1) : null, goodDown };
  };
  const deltas: BcaDelta[] = [
    mkDelta("weight", "น้ำหนัก", "กก.", true),
    mkDelta("fat_pct", "ไขมัน", "%", true),
    mkDelta("muscle_pct", "กล้ามเนื้อ", "%", false),
    mkDelta("visceral", "ไขมันช่องท้อง", "", true),
  ];

  /* ── auto-analysis ── */
  const analysis: string[] = [];
  if (points.length >= 2 && spanDays > 0) {
    const wD = deltas[0].delta, fD = deltas[1].delta, mD = deltas[2].delta;
    if (wD != null && Math.abs(wD) >= 0.3) {
      analysis.push(
        wD < 0
          ? `น้ำหนักลดลง ${Math.abs(wD)} กก. ในช่วง ${spanDays} วัน — แนวโน้มที่ดี ควรคุมให้ค่อยเป็นค่อยไป (~0.5 กก./สัปดาห์) เพื่อรักษามวลกล้ามเนื้อ`
          : `น้ำหนักเพิ่มขึ้น ${wD} กก. ในช่วง ${spanDays} วัน — ถ้าเป็นเป้าหมายเพิ่มกล้ามให้ดูควบคู่กับ % กล้ามเนื้อ`,
      );
    } else if (wD != null) {
      analysis.push(`น้ำหนักค่อนข้างคงที่ (${wD >= 0 ? "+" : ""}${wD} กก.) ตลอด ${spanDays} วัน`);
    }
    if (fD != null && mD != null && fD < 0 && mD >= 0) {
      analysis.push("องค์ประกอบร่างกายดีขึ้นแบบในอุดมคติ — ไขมันลดพร้อมกล้ามเนื้อคงหรือเพิ่ม (recomposition)");
    } else if (fD != null && fD <= -0.5) {
      analysis.push(`สัดส่วนไขมันลดลง ${Math.abs(fD)}% — ทิศทางถูกต้องต่อสุขภาพเมแทบอลิก`);
    } else if (mD != null && mD <= -0.5) {
      analysis.push(`% กล้ามเนื้อลดลง ${Math.abs(mD)}% — ควรเพิ่มโปรตีนและฝึกแรงต้านเพื่อรักษามวลกล้ามเนื้อ`);
    }
  }
  // visceral standalone read (Tanita-style: <10 healthy)
  const vis = latest.visceral;
  if (vis != null) {
    if (vis >= 13) analysis.push(`ไขมันช่องท้อง (visceral) ระดับ ${vis} อยู่ในเกณฑ์ควรเฝ้าระวัง (สูง) — สัมพันธ์กับความเสี่ยงเมแทบอลิก ควรลดลงต่ำกว่า 10`);
    else if (vis >= 10) analysis.push(`ไขมันช่องท้อง (visceral) ระดับ ${vis} ค่อนไปทางสูงเล็กน้อย — เป้าหมายที่ดีคือต่ำกว่า 10`);
    else analysis.push(`ไขมันช่องท้อง (visceral) ระดับ ${vis} อยู่ในเกณฑ์ดี (ต่ำกว่า 10)`);
  }
  if (latest.body_age != null) {
    analysis.push(`Body Age (อายุร่างกาย) ล่าสุด ${latest.body_age} ปี — ยิ่งต่ำกว่าอายุจริงยิ่งดี สะท้อนองค์ประกอบร่างกายและเมแทบอลิซึม`);
  }
  if (analysis.length === 0) analysis.push("มีข้อมูลองค์ประกอบร่างกาย 1 ครั้ง — วัดซ้ำเป็นระยะเพื่อดูแนวโน้ม");

  return { points, count: points.length, spanDays, latest, first, deltas, analysis };
}

/* ═══════════════════════════ 2 · CGM ═══════════════════════════ */

export interface CgmReadingRow {
  profile_name: string;
  reading_timestamp: number | string; // epoch ms
  date_str: string | null;
  glucose: number | string | null;
}
export interface CgmMealRow {
  profile_name: string;
  meal_timestamp: number | string;
  date_str: string | null;
  description: string | null;
}

/** mg/dL targets — standard CGM "time in range" 70–140 for non-diabetic optimization. */
export const TIR_LOW = 70;
export const TIR_HIGH = 140;

export interface CgmDayPoint { date: string; avg: number; min: number; max: number; n: number }
export interface CgmHourPoint { hour: number; avg: number; n: number }

export interface CgmSummary {
  profiles: string[];
  readings: number;
  days: number;
  avg: number;
  min: number;
  max: number;
  estA1c: number;            // (avg + 46.7) / 28.7
  tir: { inPct: number; lowPct: number; highPct: number };
  byDay: CgmDayPoint[];      // chronological
  byHour: CgmHourPoint[];    // 0–23 day-pattern
  meals: { date: string; description: string }[];
  analysis: string[];
}

export function buildCgmSummary(
  rows: CgmReadingRow[],
  meals: CgmMealRow[] = [],
): CgmSummary | null {
  if (!rows || rows.length === 0) return null;
  const profiles = [...new Set(rows.map((r) => r.profile_name).filter(Boolean))];

  const vals: number[] = [];
  const dayBucket = new Map<string, number[]>();
  const hourBucket = new Map<number, number[]>();
  for (const r of rows) {
    const g = num(r.glucose);
    if (g == null || g <= 0) continue;
    vals.push(g);
    const ts = num(r.reading_timestamp);
    const d = r.date_str ? dayKey(r.date_str) : dayKey(ts);
    if (d) (dayBucket.get(d) ?? dayBucket.set(d, []).get(d)!).push(g);
    if (ts != null) {
      const h = new Date(ts).getHours();
      (hourBucket.get(h) ?? hourBucket.set(h, []).get(h)!).push(g);
    }
  }
  if (vals.length === 0) return null;

  const mean = avg(vals);
  const lo = vals.filter((v) => v < TIR_LOW).length;
  const hi = vals.filter((v) => v > TIR_HIGH).length;
  const inR = vals.length - lo - hi;

  const byDay: CgmDayPoint[] = [...dayBucket.entries()]
    .map(([date, a]) => ({ date, avg: round(avg(a), 0), min: Math.min(...a), max: Math.max(...a), n: a.length }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const byHour: CgmHourPoint[] = [...hourBucket.entries()]
    .map(([hour, a]) => ({ hour, avg: round(avg(a), 0), n: a.length }))
    .sort((a, b) => a.hour - b.hour);

  const mealList = (meals ?? [])
    .map((m) => ({ date: m.date_str ? dayKey(m.date_str) : dayKey(num(m.meal_timestamp)), description: m.description ?? "" }))
    .filter((m) => m.date && m.description)
    .slice(-12);

  const tirIn = round((inR / vals.length) * 100, 0);
  const tirLow = round((lo / vals.length) * 100, 0);
  const tirHigh = round((hi / vals.length) * 100, 0);
  const estA1c = round((mean + 46.7) / 28.7, 1);

  /* ── auto-analysis ── */
  const analysis: string[] = [];
  analysis.push(
    `น้ำตาลเฉลี่ย ${round(mean, 0)} mg/dL (เทียบ HbA1c ประมาณ ${estA1c}%) จาก ${vals.length.toLocaleString()} จุดวัด ${byDay.length} วัน`,
  );
  if (tirIn >= 70) analysis.push(`อยู่ในช่วงเป้าหมาย (${TIR_LOW}–${TIR_HIGH} mg/dL) ${tirIn}% ของเวลา — ดีมาก (เป้าหมายทั่วไป ≥70%)`);
  else analysis.push(`อยู่ในช่วงเป้าหมาย (${TIR_LOW}–${TIR_HIGH} mg/dL) เพียง ${tirIn}% — ยังมีช่องให้ปรับ (เป้าหมาย ≥70%)`);
  if (tirHigh >= 25) analysis.push(`มีช่วงน้ำตาลสูงเกิน ${TIR_HIGH} ${tirHigh}% ของเวลา — สังเกตมื้อ/ชนิดคาร์บที่ทำให้พุ่ง แล้วปรับลำดับการกิน (ผัก-โปรตีนก่อนคาร์บ)`);
  if (tirLow >= 4) analysis.push(`มีช่วงน้ำตาลต่ำกว่า ${TIR_LOW} ${tirLow}% — ระวังภาวะน้ำตาลต่ำ โดยเฉพาะหลังออกกำลังกายหรือมื้อห่าง`);
  // day-pattern peak hour
  if (byHour.length >= 6) {
    const peak = [...byHour].sort((a, b) => b.avg - a.avg)[0];
    if (peak && peak.avg > TIR_HIGH) {
      analysis.push(`ช่วงที่น้ำตาลสูงสุดคือประมาณ ${String(peak.hour).padStart(2, "0")}:00 น. (เฉลี่ย ${peak.avg} mg/dL) — มักตรงกับมื้อหลัก`);
    }
  }

  return {
    profiles, readings: vals.length, days: byDay.length,
    avg: round(mean, 0), min: Math.min(...vals), max: Math.max(...vals),
    estA1c, tir: { inPct: tirIn, lowPct: tirLow, highPct: tirHigh },
    byDay, byHour, meals: mealList, analysis,
  };
}

/* ═══════════════════════════ 3 · FOOD ═══════════════════════════ */

export interface NutriScanRow {
  food_identified: string | null;
  meal_type: string | null;
  eaten_on: string | null;
  calories_estimate: number | string | null;
  carb_g: number | string | null;
  protein_g: number | string | null;
  fat_g: number | string | null;
  fiber_g: number | string | null;
  glucose_impact_score: number | string | null;
  health_score: number | string | null;
  created_at: string;
}

export interface FoodDayPoint {
  date: string;
  calories: number;
  carb: number; protein: number; fat: number;
  meals: number;
}
export interface FoodMeal {
  date: string; meal_type: string; food: string;
  calories: number | null; health: number | null; glucoseImpact: number | null;
}

export interface FoodSummary {
  scans: number;
  days: number;
  avgCalories: number;       // per logged day
  macroAvgPct: { carb: number; protein: number; fat: number }; // by gram-energy
  avgHealth: number | null;  // 1–10
  avgGlucoseImpact: number | null; // 1–10
  byDay: FoodDayPoint[];
  recent: FoodMeal[];        // newest first, ≤8
  analysis: string[];
}

export function buildFoodSummary(rows: NutriScanRow[]): FoodSummary | null {
  if (!rows || rows.length === 0) return null;

  const dayBucket = new Map<string, FoodDayPoint>();
  const healths: number[] = [];
  const gis: number[] = [];
  let cAll = 0, pAll = 0, fAll = 0;

  for (const r of rows) {
    const date = r.eaten_on ? dayKey(r.eaten_on) : dayKey(r.created_at);
    if (!date) continue;
    const kcal = num(r.calories_estimate) ?? 0;
    const c = num(r.carb_g) ?? 0;
    const p = num(r.protein_g) ?? 0;
    const f = num(r.fat_g) ?? 0;
    cAll += c; pAll += p; fAll += f;
    const h = num(r.health_score); if (h != null) healths.push(h);
    const gi = num(r.glucose_impact_score); if (gi != null) gis.push(gi);

    const d = dayBucket.get(date) ?? { date, calories: 0, carb: 0, protein: 0, fat: 0, meals: 0 };
    d.calories += kcal; d.carb += c; d.protein += p; d.fat += f; d.meals += 1;
    dayBucket.set(date, d);
  }

  const byDay = [...dayBucket.values()]
    .map((d) => ({ ...d, calories: Math.round(d.calories), carb: round(d.carb, 0), protein: round(d.protein, 0), fat: round(d.fat, 0) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (byDay.length === 0) return null;

  const avgCalories = Math.round(avg(byDay.map((d) => d.calories)));
  // macro energy split (4/4/9 kcal per g)
  const cE = cAll * 4, pE = pAll * 4, fE = fAll * 9;
  const totE = cE + pE + fE;
  const macroAvgPct = totE > 0
    ? { carb: Math.round((cE / totE) * 100), protein: Math.round((pE / totE) * 100), fat: Math.round((fE / totE) * 100) }
    : { carb: 0, protein: 0, fat: 0 };

  const recent: FoodMeal[] = [...rows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8)
    .map((r) => ({
      date: r.eaten_on ? dayKey(r.eaten_on) : dayKey(r.created_at),
      meal_type: r.meal_type ?? "—",
      food: r.food_identified ?? "—",
      calories: num(r.calories_estimate),
      health: num(r.health_score),
      glucoseImpact: num(r.glucose_impact_score),
    }));

  const avgHealth = healths.length ? round(avg(healths), 1) : null;
  const avgGI = gis.length ? round(avg(gis), 1) : null;

  /* ── auto-analysis ── */
  const analysis: string[] = [];
  analysis.push(`บันทึกอาหาร ${rows.length} รายการ ${byDay.length} วัน — แคลอรีเฉลี่ย ${avgCalories.toLocaleString()} kcal/วัน`);
  if (totE > 0) {
    analysis.push(`สัดส่วนพลังงาน คาร์บ ${macroAvgPct.carb}% · โปรตีน ${macroAvgPct.protein}% · ไขมัน ${macroAvgPct.fat}%`);
    if (macroAvgPct.protein >= 30) analysis.push("โปรตีนสูง (≥30%) — ดีต่อการรักษามวลกล้ามเนื้อและความอิ่ม");
    else if (macroAvgPct.protein < 20) analysis.push("โปรตีนค่อนข้างต่ำ (<20%) — เพิ่มโปรตีนคุณภาพช่วยควบคุมน้ำหนักและกล้ามเนื้อ");
    if (macroAvgPct.carb >= 55) analysis.push("คาร์บค่อนข้างสูง — เลือกคาร์บเชิงซ้อน/ใยอาหารสูง และกินผัก-โปรตีนก่อนช่วยลดการพุ่งของน้ำตาล");
  }
  if (avgHealth != null) {
    if (avgHealth >= 7.5) analysis.push(`คะแนนสุขภาพอาหารเฉลี่ย ${avgHealth}/10 — อยู่ในเกณฑ์ดี`);
    else if (avgHealth >= 5) analysis.push(`คะแนนสุขภาพอาหารเฉลี่ย ${avgHealth}/10 — พอใช้ มีช่องปรับให้สะอาดขึ้น`);
    else analysis.push(`คะแนนสุขภาพอาหารเฉลี่ย ${avgHealth}/10 — ควรปรับคุณภาพอาหารโดยรวม`);
  }
  if (avgGI != null && avgGI >= 6) analysis.push(`คะแนนผลกระทบต่อน้ำตาลเฉลี่ย ${avgGI}/10 (สูง) — เลือกอาหารดัชนีน้ำตาลต่ำลงจะช่วยให้น้ำตาลนิ่งขึ้น`);

  return { scans: rows.length, days: byDay.length, avgCalories, macroAvgPct, avgHealth, avgGlucoseImpact: avgGI, byDay, recent, analysis };
}

/* ═══════════════════════ 4 · COMBINED INSIGHT ═══════════════════════ */

/** Heuristic cross-signal narrative. Returns [] when nothing connectable. */
export function buildCombinedInsight(opts: {
  report: WearableReport;
  labByCategory: Record<string, LabMetricTrend[]>;
  bca: BcaSummary | null;
  cgm: CgmSummary | null;
  food: FoodSummary | null;
}): string[] {
  const { report, labByCategory, bca, cgm, food } = opts;
  const out: string[] = [];
  const s = report.summaries;
  const rec = s.recovery?.avg ?? null;
  const hrv = s.hrv?.avg ?? null;
  const spo2 = s.spo2?.avg ?? null;
  const sleep = s.sleep_perf?.avg ?? null;
  const strain = s.strain?.avg ?? null;

  // recovery ↔ sleep ↔ strain balance
  if (rec != null && sleep != null) {
    if (rec < 50 && sleep < 75) out.push("การฟื้นตัวที่ยังไม่สูงสัมพันธ์กับคุณภาพการนอนที่ยังไม่ถึงเป้า — โฟกัสที่การนอนให้สม่ำเสมอจะดัน Recovery ขึ้นได้มากที่สุด");
    else if (rec >= 60 && sleep >= 80) out.push("การฟื้นตัวและการนอนสอดคล้องกันในเกณฑ์ดี — ร่างกายได้พักเพียงพอกับภาระที่ใช้ในแต่ละวัน");
  }
  if (strain != null && rec != null && strain >= 14 && rec < 50) {
    out.push("ภาระการออกแรง (strain) ค่อนข้างสูงเมื่อเทียบกับการฟื้นตัว — สลับวันหนัก/เบาเพื่อกันการสะสมความล้า");
  }

  // SpO2 ↔ recovery
  if (spo2 != null && spo2 < 94) {
    out.push("ค่าออกซิเจนขณะนอน (SpO₂) ที่ค่อนข้างต่ำอาจฉุดคุณภาพการนอนและการฟื้นตัว — หากต่ำซ้ำ ๆ ควรปรึกษาแพทย์เรื่องการหายใจขณะหลับ");
  }

  // CGM ↔ food
  if (cgm && food) {
    if (cgm.tir.highPct >= 25 && food.macroAvgPct.carb >= 50) {
      out.push("น้ำตาลที่พุ่งสูงบ่อย (CGM) สอดคล้องกับสัดส่วนคาร์บในอาหารที่ค่อนข้างสูง — ปรับลำดับการกิน (ผัก-โปรตีนก่อนคาร์บ) และเลือกคาร์บใยสูงน่าจะช่วยให้กราฟน้ำตาลนิ่งขึ้น");
    } else if (cgm.tir.inPct >= 70 && food.avgHealth != null && food.avgHealth >= 7) {
      out.push("คุมน้ำตาลอยู่ในช่วงเป้าหมายได้ดี (CGM) ไปในทางเดียวกับคุณภาพอาหารที่ดี — เป็นสัญญาณเมแทบอลิกที่แข็งแรง");
    }
  } else if (cgm) {
    // CGM ↔ lab glucose
    const glucoseLab = labByCategory.glucose?.find((m) => /hba1c|a1c/i.test(m.key) || /a1c/i.test(m.label));
    if (glucoseLab?.latest != null) {
      out.push(`ค่า HbA1c จากผลเลือด (${glucoseLab.latest}${glucoseLab.unit}) เทียบกับค่าประมาณจาก CGM (~${cgm.estA1c}%) ใช้ยืนยันแนวโน้มการคุมน้ำตาลร่วมกันได้`);
    }
  }

  // body fat ↔ lipids
  if (bca) {
    const lipid = labByCategory.lipid ?? [];
    const ldl = lipid.find((m) => /ldl/i.test(m.key) || /ldl/i.test(m.label));
    const tg = lipid.find((m) => /trig/i.test(m.key) || /ไตรกลี/i.test(m.label));
    const fat = bca.latest.fat_pct;
    if (fat != null && (ldl?.latestStatus === "high" || tg?.latestStatus === "high")) {
      out.push(`สัดส่วนไขมันในร่างกาย (${fat}%) ร่วมกับค่าไขมันในเลือดที่สูง — การลดไขมันลงต่อเนื่องมักช่วยให้ไขมันในเลือดดีขึ้นไปพร้อมกัน`);
    } else if (bca.deltas[1].delta != null && bca.deltas[1].delta < 0) {
      out.push("สัดส่วนไขมันที่ลดลงเป็นพื้นฐานที่ดีต่อทั้งสุขภาพหัวใจและการคุมน้ำตาล — ติดตามผลเลือด lipid/น้ำตาลซ้ำเพื่อยืนยันผล");
    }
  }

  // BCA ↔ CGM (visceral ↔ glucose control)
  if (bca && cgm && bca.latest.visceral != null && bca.latest.visceral >= 10 && cgm.tir.highPct >= 20) {
    out.push("ไขมันช่องท้องที่ค่อนข้างสูงมักสัมพันธ์กับภาวะดื้ออินซูลิน — สอดคล้องกับช่วงน้ำตาลสูงที่เห็นใน CGM การลดไขมันช่องท้องจะช่วยทั้งสองด้าน");
  }

  // wearable ↔ food energy balance
  if (food && strain != null) {
    if (food.avgCalories > 0 && strain >= 12 && food.macroAvgPct.protein < 20) {
      out.push("กิจกรรมรายวันค่อนข้างมากแต่โปรตีนในอาหารยังต่ำ — เพิ่มโปรตีนช่วยการฟื้นตัวของกล้ามเนื้อหลังออกแรง");
    }
  }

  return out;
}
