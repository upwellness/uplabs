/**
 * UP Health Design — Assessment Engine (SPEC-Health-Design.md §3.1)
 *
 * One person's five data sources — labs, body composition, CGM, wearable, food —
 * folded into ONE object that says, per health domain, where they stand, which
 * measurement says so, and what is missing. Decided 12 Sep 2026: domains are never
 * collapsed into a single number, because one number hides the domain that needs
 * work first.
 *
 * Pure: readings in, assessment out. The loader (load.ts) does the I/O. Thresholds
 * are cited inline; anything not backed by a guideline is marked `level: null`
 * (informational) rather than given a colour it has not earned.
 *
 * Rules that must survive any refactor:
 *   • No data ≠ normal. A domain without data is `level: null` and named in data_gaps.
 *   • Existing lib decisions are reused, never re-derived (medical-status bands, CGM
 *     consensus metrics, PhenoAge).
 *   • Wellness, not diagnosis: `priorities[].why` never names a disease.
 */
import { bandBodyFat, bandMusclePct, bandVisceralFat, bandBMI, classifyBodyAge, type StatusLevel, type Gender } from "@/lib/medical-status";
import { computePhenoAge, estimatePhenoAge, phenoPrefillFromLabs, PHENO_DEFAULT_UNITS, type PhenoInput } from "@/lib/bio-age";
import { deriveBMI } from "@/lib/bca-derive";
import { TARGETS, type CgmMetrics } from "@/lib/api/cgm-metrics";
import { percentileOf, type Percentile } from "./reference";

export const ENGINE_VERSION = "1.0.0";

/* ── input ──────────────────────────────────────────────────────────────────── */

export type Source = "labs" | "bca" | "cgm" | "wearable" | "food";
export type Level = "good" | "watch" | "attention";
export type DomainKey = "metabolic" | "body_comp" | "cardio_lipid" | "liver_kidney" | "recovery" | "nutrition" | "health_age";

export interface LabPoint {
  metric_key: string; label_th: string | null; value_num: number | null; value: string | null;
  unit: string | null; recorded_at: string; status?: string | null;
}
export interface Measurement {
  recorded_at: string; weight: number | null; fat_pct: number | null; muscle_pct: number | null;
  visceral: number | null; body_age: number | null;
}
export interface WearableSummary {
  source: string; days: number; from: string; to: string;
  avg_sleep_min: number | null; avg_hrv: number | null; avg_rhr: number | null;
  avg_steps: number | null; avg_recovery_pct: number | null;
}
export interface FoodSummary {
  window_days: number; days_logged: number; entries: number;
  avg_calories: number | null; avg_protein_g: number | null; avg_carb_g: number | null; avg_fat_g: number | null;
  avg_health_score: number | null; avg_glucose_impact: number | null;
}
export interface AssessInput {
  customer: { gender: Gender | null; age: number | null; height_cm: number | null };
  /** newest-first; the engine keeps the latest row per metric_key */
  labs: LabPoint[];
  measurement: Measurement | null;
  cgm: (CgmMetrics & { window?: { from: string; to: string } }) | null;
  wearable: WearableSummary | null;
  food: FoodSummary | null;
  /** ISO date "YYYY-MM-DD" — for staleness; injected so tests are deterministic */
  today: string;
}

/* ── output ─────────────────────────────────────────────────────────────────── */

export interface Driver {
  metric: string; label_th: string; value: number | string; unit?: string | null;
  /** null = informational (no guideline threshold behind it) */
  level: Level | null; source: Source; recorded_at?: string | null; note?: string;
  /** position among people of the same sex and age band in the population reference (§3.4) — never a health verdict */
  reference?: Percentile | null;
}
export interface Domain {
  level: Level | null;          // worst driver level; null when nothing measured
  drivers: Driver[];
  sources: Source[];
  caveats: string[];
}
export interface HealthAge {
  phenoage: number | null; chrono_age: number | null; delta: number | null;
  mode: "measured" | "hybrid" | null; imputed: string[]; level: Level | null; caveats: string[];
}
export interface DataGap { source: Source | "labs_panel" | "health_age"; reason: string }
export interface Priority { rank: number; domain: DomainKey; level: Level; why: string; evidence: string[] }

export interface HealthAssessment {
  engine_version: string;
  sources_used: Source[];
  data_gaps: DataGap[];
  confidence: "high" | "medium" | "low";
  confidence_reason: string;
  domains: {
    metabolic: Domain; body_comp: Domain; cardio_lipid: Domain; liver_kidney: Domain;
    recovery: Domain; nutrition: Domain; health_age: HealthAge;
  };
  priorities: Priority[];
  caveats: string[];
  disclaimer: string;
}

export const DOMAIN_LABEL_TH: Record<DomainKey, string> = {
  metabolic: "น้ำตาลและเมตาบอลิซึม",
  body_comp: "องค์ประกอบร่างกาย",
  cardio_lipid: "ไขมันและหัวใจ",
  liver_kidney: "ตับและไต",
  recovery: "การนอนและการฟื้นตัว",
  nutrition: "โภชนาการที่บันทึก",
  health_age: "อายุสุขภาพ",
};

/** The panel every customer should have at least once — keys as stored in customer_lab_values. */
export const CORE_PANEL_TH: Record<string, string> = {
  hba1c: "HbA1c", fbs: "น้ำตาลอดอาหาร (FBS)", ldl: "LDL", hdl: "HDL", triglyceride: "ไตรกลีเซอไรด์",
  alt_sgpt: "ALT (ตับ)", creatinine: "ครีอะตินิน (ไต)", egfr: "eGFR (ไต)", hs_crp: "hs-CRP (การอักเสบ)",
};

export const DISCLAIMER =
  "ผลประเมินนี้ใช้เพื่อการดูแลเชิงป้องกันและชะลอวัย ไม่ใช่การวินิจฉัย · ค่าที่อยู่ในช่วง 'ควรปรึกษาแพทย์' ให้แพทย์เป็นผู้ตรวจเพิ่มและสรุป · สิ่งที่ไม่ได้วัดไม่ได้แปลว่าปกติ";

/* ── helpers ────────────────────────────────────────────────────────────────── */

const LEVEL_RANK: Record<Level, number> = { good: 0, watch: 1, attention: 2 };
const worst = (levels: (Level | null)[]): Level | null =>
  levels.reduce<Level | null>((w, l) => (l === null ? w : w === null || LEVEL_RANK[l] > LEVEL_RANK[w] ? l : w), null);

/** medical-status 5-band → 3-level. caution=watch; warning/danger=attention. */
export const fromStatus = (s: StatusLevel): Level => (s === "optimal" || s === "good" ? "good" : s === "caution" ? "watch" : "attention");

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 864e5);
const r1 = (x: number) => Math.round(x * 10) / 10;

/** three-band threshold helper: ascending cut-points (good below c1, watch below c2, attention at/after c2) */
const asc = (v: number, c1: number, c2: number): Level => (v < c1 ? "good" : v < c2 ? "watch" : "attention");
/** descending: attention below c1, watch below c2, good at/after c2 */
const desc = (v: number, c1: number, c2: number): Level => (v < c1 ? "attention" : v < c2 ? "watch" : "good");

const latestByKey = (labs: LabPoint[]): Map<string, LabPoint> => {
  const m = new Map<string, LabPoint>();
  for (const l of [...labs].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))) if (!m.has(l.metric_key)) m.set(l.metric_key, l);
  return m;
};
const pick = (m: Map<string, LabPoint>, ...keys: string[]): LabPoint | null => {
  for (const k of keys) { const v = m.get(k); if (v && v.value_num != null) return v; }
  return null;
};
const lab = (p: LabPoint, label: string, level: Level | null, note?: string): Driver => ({
  metric: p.metric_key, label_th: p.label_th ?? label, value: p.value_num ?? p.value ?? "", unit: p.unit,
  level, source: "labs", recorded_at: p.recorded_at, ...(note ? { note } : {}),
});

const emptyDomain = (): Domain => ({ level: null, drivers: [], sources: [], caveats: [] });
const finish = (d: Domain): Domain => {
  d.level = worst(d.drivers.map((x) => x.level));
  d.sources = [...new Set(d.drivers.map((x) => x.source))];
  return d;
};

/* ── domains ────────────────────────────────────────────────────────────────── */

function metabolic(m: Map<string, LabPoint>, cgm: AssessInput["cgm"], food: FoodSummary | null): Domain {
  const d = emptyDomain();
  const a1c = pick(m, "hba1c"); // ADA Standards of Care: <5.7 normal · 5.7–6.4 prediabetes range · ≥6.5
  if (a1c) d.drivers.push(lab(a1c, "HbA1c", asc(a1c.value_num!, 5.7, 6.5)));
  const fbs = pick(m, "fbs", "glucose"); // ADA: <100 · 100–125 · ≥126 mg/dL
  if (fbs) d.drivers.push(lab(fbs, "น้ำตาลอดอาหาร (FBS)", asc(fbs.value_num!, 100, 126)));

  if (cgm && cgm.n > 0) {
    const rel = cgm.reliable;
    const note = rel ? undefined : `ข้อมูล ${cgm.days} วัน · ครบ ${cgm.completeness_pct}% — ยังไม่ถึงเกณฑ์ 14 วัน/70% ใช้ดูแนวโน้มเท่านั้น`;
    // Battelino 2019 consensus targets (TARGETS); below the reliability rule we report but do not grade.
    const grade = (l: Level): Level | null => (rel ? l : null);
    if (cgm.tir_70_180 != null) d.drivers.push({ metric: "cgm_tir", label_th: "เวลาในเป้า 70–180 (TIR)", value: cgm.tir_70_180, unit: "%", level: grade(cgm.tir_70_180 >= TARGETS.tir_70_180.min ? "good" : "watch"), source: "cgm", recorded_at: cgm.to, note });
    if (cgm.tbr_below_70 != null) d.drivers.push({ metric: "cgm_tbr", label_th: "เวลาต่ำกว่า 70 (TBR)", value: cgm.tbr_below_70, unit: "%", level: grade(cgm.tbr_below_70 < TARGETS.tbr_below_70.max ? "good" : cgm.tbr_below_54! >= TARGETS.tbr_below_54.max ? "attention" : "watch"), source: "cgm", recorded_at: cgm.to, note });
    if (cgm.cv != null) d.drivers.push({ metric: "cgm_cv", label_th: "ความแกว่ง (CV)", value: cgm.cv, unit: "%", level: grade(cgm.cv <= TARGETS.cv.max ? "good" : "watch"), source: "cgm", recorded_at: cgm.to, note });
    if (cgm.gmi != null) d.drivers.push({ metric: "cgm_gmi", label_th: "GMI (ประมาณ HbA1c จาก CGM)", value: cgm.gmi, unit: "%", level: null, source: "cgm", recorded_at: cgm.to, note: "ค่าประมาณ ไม่ใช่ HbA1c จากการเจาะเลือด" });
    if (!rel) d.caveats.push(`CGM ${cgm.days} วัน · ครบ ${cgm.completeness_pct}% — เกณฑ์สากลให้เชื่อตัวเลขสรุปเมื่อ ≥14 วันและ ≥70% (ADA/Battelino 2019)`);
    d.caveats.push("เป้า TIR/TBR/CV เป็นเกณฑ์สำหรับผู้เป็นเบาหวาน ยังไม่มีเกณฑ์ทางการสำหรับคนทั่วไป");
  }
  if (food?.avg_glucose_impact != null) {
    d.drivers.push({ metric: "food_glucose_impact", label_th: "ผลต่อน้ำตาลของมื้อที่บันทึก (เฉลี่ย)", value: food.avg_glucose_impact, unit: "/10", level: null, source: "food", note: "คะแนนประมาณจาก AI ที่อ่านรูป ไม่ใช่ค่าที่วัด" });
  }
  return finish(d);
}

function bodyComp(ms: Measurement | null, c: AssessInput["customer"], today: string): Domain {
  const d = emptyDomain();
  if (!ms) return d;
  const g: Gender = c.gender ?? "female"; // bands are sex-split; unknown sex falls to the stricter female fat band and is flagged
  if (!c.gender) d.caveats.push("ไม่ทราบเพศ — ใช้เกณฑ์ไขมัน/กล้ามเนื้อของหญิงไปก่อน ควรระบุเพศในโปรไฟล์");
  const at = ms.recorded_at;
  if (ms.fat_pct != null) d.drivers.push({ metric: "fat_pct", label_th: "ไขมัน", value: ms.fat_pct, unit: "%", level: fromStatus(bandBodyFat(ms.fat_pct, g).level), source: "bca", recorded_at: at, note: bandBodyFat(ms.fat_pct, g).label });
  if (ms.muscle_pct != null) d.drivers.push({ metric: "muscle_pct", label_th: "กล้ามเนื้อ", value: ms.muscle_pct, unit: "%", level: fromStatus(bandMusclePct(ms.muscle_pct, g).level), source: "bca", recorded_at: at, note: bandMusclePct(ms.muscle_pct, g).label });
  if (ms.visceral != null) d.drivers.push({ metric: "visceral", label_th: "ไขมันช่องท้อง", value: ms.visceral, unit: "ระดับ", level: fromStatus(bandVisceralFat(ms.visceral).level), source: "bca", recorded_at: at, note: bandVisceralFat(ms.visceral).label });
  const bmi = deriveBMI(ms.weight, c.height_cm);
  if (bmi != null) d.drivers.push({ metric: "bmi", label_th: "BMI", value: bmi, unit: "kg/m²", level: fromStatus(bandBMI(bmi).level), source: "bca", recorded_at: at, note: `${bandBMI(bmi).label} (เกณฑ์เอเชีย-แปซิฟิก)` });
  else if (ms.weight != null) d.drivers.push({ metric: "weight", label_th: "น้ำหนัก", value: ms.weight, unit: "kg", level: null, source: "bca", recorded_at: at, note: "ไม่มีส่วนสูง จึงคำนวณ BMI ไม่ได้" });
  if (ms.body_age != null && c.age != null) d.drivers.push({ metric: "body_age", label_th: "อายุร่างกาย (เครื่องชั่ง)", value: ms.body_age, unit: "ปี", level: fromStatus(classifyBodyAge(ms.body_age, c.age)), source: "bca", recorded_at: at, note: `อายุจริง ${c.age}` });
  const age = daysBetween(at, today);
  if (age > 90) d.caveats.push(`ค่า BCA ล่าสุดอายุ ${age} วัน — ควรชั่งใหม่`);
  return finish(d);
}

function cardioLipid(m: Map<string, LabPoint>, w: WearableSummary | null): Domain {
  const d = emptyDomain();
  const ldl = pick(m, "ldl"); // ATP III / ESC: <130 near-optimal–borderline · 130–159 borderline-high · ≥160 high
  if (ldl) d.drivers.push(lab(ldl, "LDL", asc(ldl.value_num!, 130, 160)));
  const hdl = pick(m, "hdl"); // ATP III: <40 low (both sexes used here; <50 for women is the AHA note)
  if (hdl) d.drivers.push(lab(hdl, "HDL", hdl.value_num! < 40 ? "watch" : "good"));
  const tg = pick(m, "triglyceride", "tg"); // ATP III: <150 · 150–199 · ≥200
  if (tg) d.drivers.push(lab(tg, "ไตรกลีเซอไรด์", asc(tg.value_num!, 150, 200)));
  const chol = pick(m, "cholesterol", "total_cholesterol"); // ATP III: <200 · 200–239 · ≥240
  if (chol) d.drivers.push(lab(chol, "คอเลสเตอรอลรวม", asc(chol.value_num!, 200, 240)));
  const crp = pick(m, "hs_crp", "hscrp", "crp"); // AHA/CDC 2003: <1 low · 1–3 average · >3 high (mg/L)
  if (crp) d.drivers.push(lab(crp, "hs-CRP (การอักเสบ)", crp.value_num! < 1 ? "good" : crp.value_num! <= 3 ? "watch" : "attention", crp.value_num! > 10 ? "สูงมาก อาจมีการติดเชื้อ/อักเสบเฉียบพลัน ควรตรวจซ้ำ" : undefined));
  if (w?.avg_rhr != null) d.drivers.push({ metric: "rhr", label_th: "ชีพจรขณะพัก (เฉลี่ย)", value: r1(w.avg_rhr), unit: "bpm", level: null, source: "wearable", recorded_at: w.to, note: `${w.days} วัน จาก ${w.source} — ไม่มีเกณฑ์ตัดสินทางคลินิก ใช้ดูแนวโน้ม` });
  return finish(d);
}

function liverKidney(m: Map<string, LabPoint>, g: Gender | null): Domain {
  const d = emptyDomain();
  const alt = pick(m, "alt_sgpt", "alt"); // ULN 40 U/L (lab convention used across UP Labs); >2×ULN = attention
  if (alt) d.drivers.push(lab(alt, "ALT (SGPT)", asc(alt.value_num!, 41, 81)));
  const ast = pick(m, "ast_sgot", "ast");
  if (ast) d.drivers.push(lab(ast, "AST (SGOT)", asc(ast.value_num!, 41, 81)));
  const egfr = pick(m, "egfr"); // KDIGO 2012: G1 ≥90 · G2 60–89 · G3+ <60
  if (egfr) d.drivers.push(lab(egfr, "eGFR", desc(egfr.value_num!, 60, 90)));
  const cr = pick(m, "creatinine");
  if (cr) d.drivers.push(lab(cr, "ครีอะตินิน", null, egfr ? undefined : "ไม่มี eGFR — ใช้ตัวเลขนี้เทียบเกณฑ์ตรง ๆ ไม่ได้เพราะขึ้นกับมวลกล้ามเนื้อ"));
  const uric = pick(m, "uric_acid", "uric"); // hyperuricaemia: >7 mg/dL men · >6 women
  if (uric) d.drivers.push(lab(uric, "กรดยูริก", uric.value_num! > (g === "female" ? 6 : 7) ? "watch" : "good"));
  return finish(d);
}

function recovery(w: WearableSummary | null): Domain {
  const d = emptyDomain();
  if (!w || w.days === 0) return d;
  const at = w.to;
  const n = `${w.days} วัน จาก ${w.source}`;
  if (w.avg_sleep_min != null) d.drivers.push({ metric: "sleep", label_th: "นอนเฉลี่ย", value: r1(w.avg_sleep_min / 60), unit: "ชม./คืน", level: desc(w.avg_sleep_min, 360, 420), source: "wearable", recorded_at: at, note: `${n} · AASM แนะนำ ≥7 ชม.` });
  if (w.avg_recovery_pct != null) d.drivers.push({ metric: "recovery", label_th: "Recovery (Whoop)", value: r1(w.avg_recovery_pct), unit: "%", level: desc(w.avg_recovery_pct, 34, 67), source: "wearable", recorded_at: at, note: `${n} · แถบสีของ Whoop เอง (แดง <34 · เหลือง 34–66 · เขียว ≥67)` });
  if (w.avg_hrv != null) d.drivers.push({ metric: "hrv", label_th: "HRV (rMSSD)", value: r1(w.avg_hrv), unit: "ms", level: null, source: "wearable", recorded_at: at, note: `${n} · ค่าเฉพาะบุคคล เทียบกับตัวเองย้อนหลัง ไม่มีเกณฑ์กลาง` });
  if (w.avg_steps != null) d.drivers.push({ metric: "steps", label_th: "ก้าวเฉลี่ย", value: Math.round(w.avg_steps), unit: "ก้าว/วัน", level: desc(w.avg_steps, 5000, 7500), source: "wearable", recorded_at: at, note: `${n} · Tudor-Locke 2011: <5,000 = นั่งเยอะ · ≥7,500 = active` });
  if (w.days < 7) d.caveats.push(`ข้อมูลนาฬิกาเพียง ${w.days} วัน — ค่าเฉลี่ยยังแกว่งง่าย`);
  return finish(d);
}

function nutrition(f: FoodSummary | null, ms: Measurement | null): Domain {
  const d = emptyDomain();
  if (!f || f.entries === 0) return d;
  const cov = f.window_days ? Math.round((f.days_logged / f.window_days) * 100) : 0;
  d.drivers.push({ metric: "food_coverage", label_th: "วันที่บันทึกอาหาร", value: `${f.days_logged}/${f.window_days}`, unit: "วัน", level: cov >= 57 ? "good" : cov >= 30 ? "watch" : "attention", source: "food", note: "≥4 วัน/สัปดาห์ จึงพอสรุปนิสัยการกินได้" });
  if (f.avg_protein_g != null && ms?.weight) {
    const gkg = r1(f.avg_protein_g / ms.weight); // PROT-AGE / ESPEN: ≥1.0–1.2 g/kg for older adults; <0.8 below RDA
    d.drivers.push({ metric: "protein_per_kg", label_th: "โปรตีนต่อน้ำหนักตัว (เฉพาะวันที่บันทึก)", value: gkg, unit: "g/kg/วัน", level: desc(gkg, 0.8, 1.2), source: "food", note: "PROT-AGE/ESPEN แนะนำ 1.0–1.2 g/kg ในผู้ใหญ่สูงวัย · นับจากมื้อที่บันทึกเท่านั้น" });
  } else if (f.avg_protein_g != null) {
    d.drivers.push({ metric: "protein_g", label_th: "โปรตีนเฉลี่ย (เฉพาะวันที่บันทึก)", value: r1(f.avg_protein_g), unit: "g/วัน", level: null, source: "food", note: "ไม่มีน้ำหนักตัว จึงเทียบต่อกิโลกรัมไม่ได้" });
  }
  if (f.avg_calories != null) d.drivers.push({ metric: "calories", label_th: "พลังงานเฉลี่ย (เฉพาะวันที่บันทึก)", value: Math.round(f.avg_calories), unit: "kcal/วัน", level: null, source: "food", note: "ค่าประมาณจาก AI ที่อ่านรูป" });
  if (f.avg_health_score != null) d.drivers.push({ metric: "food_health_score", label_th: "คะแนนสุขภาพของมื้อ (เฉลี่ย)", value: r1(f.avg_health_score), unit: "/10", level: null, source: "food" });
  d.caveats.push("ตัวเลขโภชนาการมาจากมื้อที่ลูกค้าบันทึกเท่านั้น — มื้อที่ไม่ได้บันทึกไม่ถูกนับ และค่ามาโครเป็นการประมาณของ AI");
  return finish(d);
}

function healthAge(labs: LabPoint[], c: AssessInput["customer"]): HealthAge {
  const out: HealthAge = { phenoage: null, chrono_age: c.age, delta: null, mode: null, imputed: [], level: null, caveats: [] };
  if (c.age == null) { out.caveats.push("ไม่ทราบวันเกิด จึงคำนวณอายุสุขภาพไม่ได้"); return out; }
  const pre = phenoPrefillFromLabs(labs.map((l) => ({ metric_key: l.metric_key, value_num: l.value_num, unit: l.unit })), c.age);
  if (pre.complete) {
    const r = computePhenoAge({ ...PHENO_DEFAULT_UNITS, ...pre.input } as PhenoInput);
    Object.assign(out, { phenoage: r.phenoAge, delta: r.delta, mode: "measured", level: fromStatus(r.level) });
    if (r.acuteFlag) out.caveats.push("CRP หรือ WBC สูง — อาจมีการอักเสบเฉียบพลันทำให้อายุสุขภาพดูแก่กว่าจริงชั่วคราว");
    return out;
  }
  // Same gate as Customer 360: a number is shown only when CRP and RDW are real.
  const haveCrp = pre.input.crp != null, haveRdw = pre.input.rdw != null;
  if (!haveCrp || !haveRdw) {
    const miss = [!haveCrp && "hs-CRP", !haveRdw && "RDW"].filter(Boolean);
    out.caveats.push(`ยังไม่แสดงอายุสุขภาพ — ขาด ${miss.join(" และ ")} (${miss.length > 1 ? "สองค่านี้" : "ค่านี้"}ประมาณแทนไม่ได้)`);
    if (pre.missing.length) out.imputed = pre.missing;
    return out;
  }
  const est = estimatePhenoAge(pre.input, c.gender);
  if (!est.computable || !est.result) { out.caveats.push(est.reason ?? "คำนวณไม่ได้"); return out; }
  Object.assign(out, { phenoage: est.result.phenoAge, delta: est.result.delta, mode: "hybrid", imputed: est.imputedLabels, level: fromStatus(est.result.level) });
  out.caveats.push(`ค่าประมาณ — เติม ${est.imputedLabels.join(", ")} ด้วยค่าอ้างอิงคนสุขภาพดี`);
  return out;
}

/* ── priorities ─────────────────────────────────────────────────────────────── */

const domainWhy = (key: DomainKey, level: Level, drivers: Driver[]): string => {
  const named = drivers.filter((x) => x.level === level).map((x) => `${x.label_th} ${x.value}${x.unit ? ` ${x.unit}` : ""}`);
  const list = named.slice(0, 3).join(" · ") + (named.length > 3 ? ` และอีก ${named.length - 3} ค่า` : "");
  // Lab domains escalate to a doctor; body composition, sleep and food are lifestyle
  // work first — "see a doctor" for a fat% reading would be noise the coach ignores.
  const clinical = key === "metabolic" || key === "cardio_lipid" || key === "liver_kidney";
  return level === "attention"
    ? `${DOMAIN_LABEL_TH[key]}: ${list} ${clinical ? "อยู่ในช่วงที่ควรปรึกษาแพทย์" : "อยู่ในช่วงที่ต้องดูแลจริงจัง"}`
    : `${DOMAIN_LABEL_TH[key]}: ${list} เริ่มออกนอกช่วงที่ดี ควรติดตามและปรับพฤติกรรม`;
};

function prioritise(domains: HealthAssessment["domains"]): Priority[] {
  const scored: { key: DomainKey; level: Level; n: number; drivers: Driver[] }[] = [];
  for (const key of ["metabolic", "body_comp", "cardio_lipid", "liver_kidney", "recovery", "nutrition"] as const) {
    const d = domains[key];
    if (!d.level || d.level === "good") continue;
    scored.push({ key, level: d.level, n: d.drivers.filter((x) => x.level === d.level).length, drivers: d.drivers });
  }
  scored.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || b.n - a.n);
  return scored.slice(0, 3).map((s, i) => ({
    rank: i + 1, domain: s.key, level: s.level, why: domainWhy(s.key, s.level, s.drivers),
    evidence: s.drivers.filter((x) => x.level === s.level).map((x) => `${x.metric}=${x.value}${x.unit ? x.unit : ""} (${x.source}${x.recorded_at ? ` ${x.recorded_at.slice(0, 10)}` : ""})`),
  }));
}

/* ── main ───────────────────────────────────────────────────────────────────── */

export function assess(input: AssessInput): HealthAssessment {
  const m = latestByKey(input.labs);
  const domains: HealthAssessment["domains"] = {
    metabolic: metabolic(m, input.cgm, input.food),
    body_comp: bodyComp(input.measurement, input.customer, input.today),
    cardio_lipid: cardioLipid(m, input.wearable),
    liver_kidney: liverKidney(m, input.customer.gender),
    recovery: recovery(input.wearable),
    nutrition: nutrition(input.food, input.measurement),
    health_age: healthAge(input.labs, input.customer),
  };

  const sources_used: Source[] = [];
  if (m.size) sources_used.push("labs");
  if (input.measurement) sources_used.push("bca");
  if (input.cgm && input.cgm.n > 0) sources_used.push("cgm");
  if (input.wearable && input.wearable.days > 0) sources_used.push("wearable");
  if (input.food && input.food.entries > 0) sources_used.push("food");

  const gaps: DataGap[] = [];
  if (!sources_used.includes("labs")) gaps.push({ source: "labs", reason: "ยังไม่มีผลแล็บในระบบ" });
  if (!sources_used.includes("bca")) gaps.push({ source: "bca", reason: "ยังไม่มีค่าองค์ประกอบร่างกาย (BCA)" });
  if (!sources_used.includes("cgm")) gaps.push({ source: "cgm", reason: "ยังไม่มีข้อมูลน้ำตาลต่อเนื่อง (CGM)" });
  else if (!input.cgm!.reliable) gaps.push({ source: "cgm", reason: `CGM ยังไม่ครบ 14 วัน/70% (${input.cgm!.days} วัน · ${input.cgm!.completeness_pct}%)` });
  if (!sources_used.includes("wearable")) gaps.push({ source: "wearable", reason: "ยังไม่ได้เชื่อมนาฬิกา/อุปกรณ์สวมใส่" });
  if (!sources_used.includes("food")) gaps.push({ source: "food", reason: "ยังไม่มีบันทึกอาหาร" });

  // labs: staleness + core panel coverage
  const latestLab = [...m.values()].map((l) => l.recorded_at).sort().pop() ?? null;
  const labAgeDays = latestLab ? daysBetween(latestLab, input.today) : null;
  const caveats: string[] = [];
  if (labAgeDays != null && labAgeDays > 180) caveats.push(`ผลแล็บล่าสุดอายุ ${labAgeDays} วัน — ค่าอาจไม่สะท้อนปัจจุบัน`);
  const missingCore = m.size ? Object.keys(CORE_PANEL_TH).filter((k) => !m.has(k)) : [];
  if (missingCore.length) gaps.push({ source: "labs_panel", reason: `ยังไม่เคยตรวจ: ${missingCore.map((k) => CORE_PANEL_TH[k]).join(", ")}` });
  if (domains.health_age.phenoage == null && m.size) gaps.push({ source: "health_age", reason: domains.health_age.caveats[0] ?? "คำนวณอายุสุขภาพไม่ได้" });

  // confidence — explicit rule so the word means the same thing every time
  let confidence: HealthAssessment["confidence"]; let confidence_reason: string;
  const freshLabs = labAgeDays != null && labAgeDays <= 180;
  const freshBca = !!input.measurement && daysBetween(input.measurement.recorded_at, input.today) <= 90;
  const continuous = (input.cgm?.reliable ?? false) || ((input.wearable?.days ?? 0) >= 7);
  if (freshLabs && freshBca && continuous) { confidence = "high"; confidence_reason = "แล็บ ≤180 วัน + BCA ≤90 วัน + ข้อมูลต่อเนื่อง (CGM ครบเกณฑ์ หรือนาฬิกา ≥7 วัน)"; }
  else if (m.size && (freshLabs || freshBca)) { confidence = "medium"; confidence_reason = "มีแล็บ แต่ยังขาดข้อมูลต่อเนื่อง หรือค่าใดค่าหนึ่งเริ่มเก่า"; }
  else { confidence = "low"; confidence_reason = sources_used.length ? "ข้อมูลแหล่งเดียวหรือเก่ากว่า 6 เดือน" : "ยังไม่มีข้อมูลเลย"; }

  if (sources_used.length === 0) caveats.push("ยังไม่มีข้อมูล — ประเมินอะไรไม่ได้");
  for (const key of ["metabolic", "body_comp", "cardio_lipid", "liver_kidney", "recovery", "nutrition"] as const) caveats.push(...domains[key].caveats.map((c) => `${DOMAIN_LABEL_TH[key]}: ${c}`));

  // Population position for every lab / BMI driver that the reference table covers.
  for (const key of ["metabolic", "body_comp", "cardio_lipid", "liver_kidney"] as const) {
    for (const d of domains[key].drivers) {
      if ((d.source === "labs" || d.metric === "bmi") && typeof d.value === "number") {
        const r = percentileOf(d.metric, d.value, input.customer.gender, input.customer.age);
        if (r) d.reference = r;
      }
    }
  }
  if (input.customer.gender && input.customer.age != null && input.customer.age >= 20 && m.size) {
    caveats.push("เปอร์เซ็นไทล์อ้างอิงมาจากประชากรสหรัฐ (NHANES 2017–2020) — ใช้ดูตำแหน่งเทียบคนวัยเดียวกัน ไม่ใช่เกณฑ์สุขภาพ · จะเปลี่ยนเป็นฐานคนไทยเมื่อได้ข้อมูล");
  }
  caveats.push("สิ่งที่ไม่ได้วัดไม่ได้แปลว่าปกติ — ดู data_gaps ประกอบทุกครั้ง");

  return {
    engine_version: ENGINE_VERSION, sources_used, data_gaps: gaps, confidence, confidence_reason,
    domains, priorities: prioritise(domains), caveats, disclaimer: DISCLAIMER,
  };
}
