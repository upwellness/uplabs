/**
 * Design Engine — a draft plan follows the assessment, never invents supplements,
 * and carries the guard-rails the coach must see before confirming.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { assess, type AssessInput, type LabPoint } from "../lib/health-design/assess.ts";
import { draftPlan, deriveGoal, PLAN_VERSION } from "../lib/health-design/plan.ts";

const TODAY = "2026-09-12";
const lab = (metric_key: string, value_num: number, recorded_at = "2026-08-01"): LabPoint => ({ metric_key, label_th: null, value_num, value: String(value_num), unit: null, recorded_at });
const base = (over: Partial<AssessInput> = {}): AssessInput => ({ customer: { gender: "female", age: 60, height_cm: 158 }, labs: [], measurement: null, cgm: null, wearable: null, food: null, today: TODAY, ...over });
const heavy = { recorded_at: "2026-09-01", weight: 64, fat_pct: 36.4, muscle_pct: 24.3, visceral: 8, body_age: 64 };

test("goal follows body composition: fat/BMI attention → loss; low muscle only → muscle; else longevity", () => {
  const a1 = assess(base({ measurement: heavy }));
  assert.equal(deriveGoal(a1, "female").goal, "loss");
  const a2 = assess(base({ measurement: { recorded_at: "2026-09-01", weight: 50, fat_pct: 24, muscle_pct: 20, visceral: 3, body_age: null } }));
  assert.equal(deriveGoal(a2, "female").goal, "muscle");
  const a3 = assess(base({ measurement: { recorded_at: "2026-09-01", weight: 52, fat_pct: 24, muscle_pct: 29, visceral: 3, body_age: null } }));
  assert.equal(deriveGoal(a3, "female").goal, "longevity");
  // a coach-set goal wins over the derived one
  const p = draftPlan({ assessment: a1, assessment_id: "x", customer: { gender: "female", age: 60, weight: 64, height_cm: 158 }, goal: "muscle", supplements: null, today: TODAY });
  assert.equal(p.goal, "muscle"); assert.match(p.goal_reason, /โค้ช/);
});

test("a full draft: goals from priorities, Plate Planner targets + 7 sample days, lifestyle, retest, doctor flags", () => {
  const a = assess(base({ measurement: heavy, labs: [lab("hba1c", 6.0), lab("fbs", 116), lab("ldl", 69), lab("egfr", 89.5), lab("alt_sgpt", 95)] }));
  const p = draftPlan({ assessment: a, assessment_id: "asm-1", customer: { gender: "female", age: 60, weight: 64, height_cm: 158 }, supplements: null, today: TODAY });
  assert.equal(p.plan_version, PLAN_VERSION); assert.equal(p.based_on_assessment_id, "asm-1"); assert.equal(p.goal, "loss");
  assert.ok(p.goals_90d.length >= 2 && p.goals_90d.length <= 3);
  assert.equal(p.goals_90d[0].domain, "body_comp"); assert.match(p.goals_90d[0].target, /ไขมัน → ต่ำกว่า 30%/);
  const met = p.goals_90d.find((g) => g.domain === "metabolic")!;
  assert.match(met.target, /HbA1c → ต่ำกว่า 5.7%/); assert.match(met.target, /100 mg\/dL/);
  // nutrition from the Plate Planner engine
  assert.ok(p.nutrition.targets); assert.ok(p.nutrition.targets!.kcal > 800);
  assert.equal(p.nutrition.targets!.protein_g_per_kg, Math.round((p.nutrition.targets!.p / 64) * 100) / 100);
  assert.equal(p.nutrition.sample_days.length, 7);
  assert.ok(p.nutrition.sample_days[0].length >= 3);
  // lifestyle always has sleep/steps/resistance; food_log + cgm added because they are missing
  assert.deepEqual(p.lifestyle.map((l) => l.area), ["sleep", "steps", "resistance", "food_log", "cgm"]);
  // ALT 95 is attention in a clinical domain → doctor flag; retest includes 90-day clinical recheck and monthly BCA
  assert.ok(p.doctor_flags.some((f) => f.metric === "alt_sgpt"));
  assert.ok(p.retest.some((r) => r.when_days === 90 && /ALT/.test(r.what)));
  assert.ok(p.retest.some((r) => r.what === "ชั่ง BCA" && r.when_days === 30));
  assert.ok(p.retest.some((r) => /ตรวจเพิ่ม/.test(r.what) && /hs_crp/.test(r.what)));
});

test("supplements are the pharmacist's schedule or an explicit 'none' — the engine never proposes any", () => {
  const a = assess(base({ measurement: heavy }));
  const none = draftPlan({ assessment: a, assessment_id: null, customer: { gender: "female", age: 60, weight: 64, height_cm: 158 }, supplements: null, today: TODAY });
  assert.equal(none.supplements.source, "pharmacist"); assert.equal(none.supplements.schedule, null); assert.match(none.supplements.note, /เภสัชกร/);
  const withRx = draftPlan({ assessment: a, assessment_id: null, customer: { gender: "female", age: 60, weight: 64, height_cm: 158 }, supplements: [{ meal_slot: "เช้า", items: ["Double X"] }], today: TODAY });
  assert.deepEqual(withRx.supplements.schedule, [{ meal_slot: "เช้า", items: ["Double X"] }]);
  const text = JSON.stringify(withRx).toLowerCase();
  for (const brand of ["nutrilite", "omega", "vitamin d", "โปรตีนเชค"]) assert.ok(!text.includes(brand), `engine text must not mention ${brand}`);
});

test("no weight/height → no nutrition targets, caveat says why; no priorities → holding goal; low confidence flagged", () => {
  const a = assess(base({ labs: [lab("ldl", 100, "2025-01-01")] }));
  const p = draftPlan({ assessment: a, assessment_id: null, customer: { gender: "female", age: 60, weight: null, height_cm: null }, supplements: null, today: TODAY });
  assert.equal(p.nutrition.targets, null); assert.equal(p.nutrition.sample_days.length, 0);
  assert.ok(p.caveats.some((c) => c.includes("ส่วนสูง")));
  assert.equal(p.goals_90d.length, 1); assert.match(p.goals_90d[0].target, /รักษา/);
  assert.ok(p.caveats.some((c) => c.includes("ความเชื่อมั่นต่ำ")));
  assert.ok(p.retest.some((r) => /ตรวจแล็บซ้ำ/.test(r.what)));
  assert.equal(p.doctor_flags.length, 0);
  assert.match(p.disclaimer, /โค้ชต้องตรวจและยืนยัน/);
});
