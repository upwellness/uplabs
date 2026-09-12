/**
 * UP Health Design — Assessment Engine. Each test pins one rule from
 * docs/SPEC-Health-Design.md §3.1: no data ≠ normal · thresholds are the cited ones ·
 * priorities never name a disease · domains are never collapsed into one number.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { assess, fromStatus, type AssessInput, type LabPoint } from "../lib/health-design/assess.ts";
import { computeMetrics } from "../lib/api/cgm-metrics.ts";

const TODAY = "2026-09-12";
const lab = (metric_key: string, value_num: number, recorded_at = "2026-08-01", unit: string | null = null): LabPoint =>
  ({ metric_key, label_th: null, value_num, value: String(value_num), unit, recorded_at });
const base = (over: Partial<AssessInput> = {}): AssessInput => ({
  customer: { gender: "male", age: 45, height_cm: 170 }, labs: [], measurement: null, cgm: null, wearable: null, food: null, today: TODAY, ...over,
});
const BKK = 7 * 3_600_000;
const cgmSeries = (vals: number[], days: number) => {
  const start = Date.UTC(2026, 8, 1) - BKK; const pts: { t: number; v: number }[] = [];
  for (let i = 0; i < 288 * days; i++) pts.push({ t: start + i * 5 * 60_000, v: vals[i % vals.length] });
  return pts;
};

test("no data at all → every domain null, every source a gap, confidence low — never 'normal'", () => {
  const a = assess(base());
  assert.deepEqual(a.sources_used, []);
  for (const k of ["metabolic", "body_comp", "cardio_lipid", "liver_kidney", "recovery", "nutrition"] as const) {
    assert.equal(a.domains[k].level, null, k); assert.equal(a.domains[k].drivers.length, 0, k);
  }
  assert.equal(a.domains.health_age.phenoage, null);
  assert.equal(a.confidence, "low");
  assert.deepEqual(a.data_gaps.map((g) => g.source), ["labs", "bca", "cgm", "wearable", "food"]);
  assert.deepEqual(a.priorities, []);
  assert.ok(!("score" in a), "there must be no overall score");
});

test("labs only: ADA/ATP III cut-points and latest-per-metric selection", () => {
  const a = assess(base({ labs: [
    lab("hba1c", 6.6), lab("hba1c", 5.4, "2025-01-01"),        // newer 6.6 wins
    lab("fbs", 110), lab("ldl", 165), lab("hdl", 38), lab("triglyceride", 180), lab("alt_sgpt", 95), lab("egfr", 75),
  ] }));
  const m = Object.fromEntries(a.domains.metabolic.drivers.map((d) => [d.metric, d]));
  assert.equal(m.hba1c.value, 6.6); assert.equal(m.hba1c.level, "attention");
  assert.equal(m.fbs.level, "watch");
  const c = Object.fromEntries(a.domains.cardio_lipid.drivers.map((d) => [d.metric, d]));
  assert.equal(c.ldl.level, "attention"); assert.equal(c.hdl.level, "watch"); assert.equal(c.triglyceride.level, "watch");
  const l = Object.fromEntries(a.domains.liver_kidney.drivers.map((d) => [d.metric, d]));
  assert.equal(l.alt_sgpt.level, "attention"); assert.equal(l.egfr.level, "watch");
  assert.equal(a.domains.metabolic.level, "attention");
  assert.equal(a.domains.cardio_lipid.level, "attention");
  assert.deepEqual(a.sources_used, ["labs"]);
});

test("priorities: attention domains first, most-flagged first, and the wording never diagnoses", () => {
  const a = assess(base({ labs: [lab("hba1c", 7.1), lab("ldl", 170), lab("triglyceride", 210), lab("alt_sgpt", 45)] }));
  assert.equal(a.priorities.length, 3);
  assert.equal(a.priorities[0].domain, "cardio_lipid");   // 2 attention drivers beats 1
  assert.equal(a.priorities[1].domain, "metabolic");
  assert.equal(a.priorities[2].domain, "liver_kidney"); assert.equal(a.priorities[2].level, "watch");
  for (const p of a.priorities) {
    assert.ok(!/เบาหวาน|โรค|วินิจฉัย|ไขมันในเลือดสูง|ตับอักเสบ/.test(p.why), p.why);
    assert.ok(p.evidence.length > 0);
  }
  assert.match(a.priorities[0].why, /ควรปรึกษาแพทย์/);
  assert.match(a.priorities[2].why, /ควรติดตาม/);
  // body composition at "attention" is lifestyle work, not a referral
  const b = assess(base({ measurement: { recorded_at: TODAY, weight: 90, fat_pct: 30, muscle_pct: 30, visceral: 6, body_age: null } }));
  assert.equal(b.priorities[0].domain, "body_comp");
  assert.match(b.priorities[0].why, /ต้องดูแลจริงจัง/);
  assert.doesNotMatch(b.priorities[0].why, /แพทย์/);
});

test("BCA: reuses medical-status bands; stale measurement is flagged; unknown sex is flagged", () => {
  const a = assess(base({ measurement: { recorded_at: "2026-05-01", weight: 80, fat_pct: 26, muscle_pct: 31, visceral: 12, body_age: 52 } }));
  const d = Object.fromEntries(a.domains.body_comp.drivers.map((x) => [x.metric, x]));
  assert.equal(d.fat_pct.level, "attention");     // male ≥25% = danger band
  assert.equal(d.muscle_pct.level, "attention");  // male <32.9 = warning
  assert.equal(d.visceral.level, "attention");    // 11–15 = warning
  assert.equal(d.bmi.value, 27.7); assert.equal(d.bmi.level, "attention");
  assert.equal(d.body_age.level, "attention");    // +7 years
  assert.ok(a.domains.body_comp.caveats.some((c) => /อายุ \d+ วัน/.test(c)));
  const u = assess(base({ customer: { gender: null, age: 45, height_cm: null }, measurement: { recorded_at: TODAY, weight: 60, fat_pct: 22, muscle_pct: 30, visceral: 4, body_age: null } }));
  assert.ok(u.domains.body_comp.caveats.some((c) => c.includes("ไม่ทราบเพศ")));
  assert.equal(u.domains.body_comp.drivers.find((x) => x.metric === "weight")?.level, null); // no height → no BMI
});

test("CGM: below 14 days/70% the numbers are reported but NOT graded; at the consensus bar they are", () => {
  const short = computeMetrics(cgmSeries([120, 130, 110], 4));
  const a = assess(base({ cgm: short }));
  const tir = a.domains.metabolic.drivers.find((d) => d.metric === "cgm_tir")!;
  assert.equal(tir.value, 100); assert.equal(tir.level, null); assert.match(tir.note!, /14 วัน/);
  assert.equal(a.domains.metabolic.level, null);
  assert.ok(a.data_gaps.some((g) => g.source === "cgm" && g.reason.includes("14")));

  const full = computeMetrics(cgmSeries([120, 190, 200, 110], 14));  // TIR 50% → watch
  const b = assess(base({ cgm: full }));
  const t2 = b.domains.metabolic.drivers.find((d) => d.metric === "cgm_tir")!;
  assert.equal(t2.level, "watch");
  assert.equal(b.domains.metabolic.level, "watch");
  assert.equal(b.domains.metabolic.drivers.find((d) => d.metric === "cgm_gmi")!.level, null); // GMI is informational
});

test("wearable: sleep/steps/recovery graded by cited bands, HRV and RHR informational", () => {
  const a = assess(base({ wearable: { source: "Whoop", days: 10, from: "2026-09-01", to: "2026-09-10", avg_sleep_min: 350, avg_hrv: 45, avg_rhr: 62, avg_steps: 6000, avg_recovery_pct: 70 } }));
  const d = Object.fromEntries(a.domains.recovery.drivers.map((x) => [x.metric, x]));
  assert.equal(d.sleep.level, "attention"); assert.equal(d.sleep.value, 5.8);
  assert.equal(d.steps.level, "watch");
  assert.equal(d.recovery.level, "good");
  assert.equal(d.hrv.level, null);
  assert.equal(a.domains.cardio_lipid.drivers.find((x) => x.metric === "rhr")!.level, null);
  assert.equal(a.domains.recovery.level, "attention");
  assert.deepEqual(a.sources_used, ["wearable"]);
});

test("food: protein per kg needs a weight; coverage bands; AI estimates are caveated", () => {
  const food = { window_days: 14, days_logged: 10, entries: 25, avg_calories: 1800, avg_protein_g: 60, avg_carb_g: 200, avg_fat_g: 60, avg_health_score: 6.5, avg_glucose_impact: 5 };
  const withWeight = assess(base({ food, measurement: { recorded_at: TODAY, weight: 80, fat_pct: null, muscle_pct: null, visceral: null, body_age: null } }));
  const d = Object.fromEntries(withWeight.domains.nutrition.drivers.map((x) => [x.metric, x]));
  assert.equal(d.protein_per_kg.value, 0.8); assert.equal(d.protein_per_kg.level, "watch");   // 60/80 = 0.75 → r1 = 0.8 → watch band [0.8,1.2)
  assert.equal(d.food_coverage.level, "good");                                                 // 10/14 = 71%
  const noWeight = assess(base({ food }));
  assert.equal(noWeight.domains.nutrition.drivers.find((x) => x.metric === "protein_g")!.level, null);
  assert.ok(noWeight.domains.nutrition.caveats.some((c) => c.includes("ประมาณของ AI")));
  assert.equal(withWeight.domains.metabolic.drivers.find((x) => x.metric === "food_glucose_impact")!.level, null);
});

test("health age: shown only when CRP and RDW are real; hybrid mode names what was imputed", () => {
  const nine = [lab("albumin", 4.4), lab("creatinine", 0.9), lab("fbs", 92), lab("hs_crp", 0.8, "2026-08-01", "mg/L"), lab("lymphocytes", 32), lab("mcv", 89), lab("rdw", 12.8), lab("alp", 65), lab("wbc", 5.6)];
  const full = assess(base({ labs: nine }));
  assert.equal(full.domains.health_age.mode, "measured");
  assert.ok(typeof full.domains.health_age.phenoage === "number");
  assert.equal(full.domains.health_age.imputed.length, 0);

  const noCrp = assess(base({ labs: nine.filter((l) => l.metric_key !== "hs_crp") }));
  assert.equal(noCrp.domains.health_age.phenoage, null);
  assert.match(noCrp.domains.health_age.caveats[0], /hs-CRP/);
  assert.ok(noCrp.data_gaps.some((g) => g.source === "health_age"));

  const hybrid = assess(base({ labs: nine.filter((l) => l.metric_key !== "alp" && l.metric_key !== "mcv") }));
  assert.equal(hybrid.domains.health_age.mode, "hybrid");
  assert.equal(hybrid.domains.health_age.imputed.length, 2);
  assert.match(hybrid.domains.health_age.caveats[0], /ค่าประมาณ/);
});

test("confidence: high needs fresh labs + fresh BCA + continuous data; stale labs drop it", () => {
  const labs = [lab("hba1c", 5.3, "2026-08-20"), lab("ldl", 100, "2026-08-20")];
  const ms = { recorded_at: "2026-09-01", weight: 70, fat_pct: 18, muscle_pct: 36, visceral: 4, body_age: 40 };
  const w = { source: "Whoop", days: 10, from: "2026-09-01", to: "2026-09-10", avg_sleep_min: 430, avg_hrv: 50, avg_rhr: 58, avg_steps: 9000, avg_recovery_pct: 72 };
  assert.equal(assess(base({ labs, measurement: ms, wearable: w })).confidence, "high");
  assert.equal(assess(base({ labs, measurement: ms })).confidence, "medium");
  const old = [lab("hba1c", 5.3, "2025-01-10")];
  const o = assess(base({ labs: old, measurement: ms, wearable: w }));
  assert.equal(o.confidence, "medium");
  assert.ok(o.caveats.some((c) => /ผลแล็บล่าสุดอายุ \d+ วัน/.test(c)));
  assert.equal(assess(base({ labs: old })).confidence, "low");
});

test("core-panel gaps are listed by metric; the closing caveat always warns about unmeasured things", () => {
  const a = assess(base({ labs: [lab("hba1c", 5.2)] }));
  const gap = a.data_gaps.find((g) => g.source === "labs_panel")!;
  assert.match(gap.reason, /LDL/); assert.match(gap.reason, /hs-CRP/);
  assert.ok(!gap.reason.includes("HbA1c"));
  assert.match(a.caveats[a.caveats.length - 1], /ไม่ได้แปลว่าปกติ/);
  assert.equal(fromStatus("caution"), "watch"); assert.equal(fromStatus("danger"), "attention"); assert.equal(fromStatus("optimal"), "good");
});
