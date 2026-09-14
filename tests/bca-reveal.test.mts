/** BCA Reveal engine: verdicts come from lib/medical-status, arithmetic is checkable, guidance ranks by the person's numbers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { assessScan, fatScenario, estimateBmr, tdee, proteinRange, walkingKcal, guidance, QUIZ_EMPTY, type RevealInput } from "../lib/bca-reveal/engine.ts";

const F: RevealInput = { gender: "female", age: 52, height_cm: 165, weight: 68.4, fat_pct: 31.2, muscle_pct: 26.1, visceral: 9, body_age: 55, bmr: 1312 };

test("assessScan: bands mirror the clinic chart; fat mass / lean mass / healthy weight keep lean mass constant", () => {
  const a = assessScan(F);
  const m = Object.fromEntries(a.metrics.map((x) => [x.key, x]));
  assert.equal(m.fat_pct.level, "warning"); assert.equal(m.fat_pct.label, "เริ่มอ้วน");
  assert.equal(m.muscle_pct.level, "good"); assert.equal(m.visceral.level, "caution"); assert.equal(m.bmi.level, "warning");
  assert.equal(m.body_age.level, "caution"); assert.equal(m.bmr.level, null);
  assert.equal(a.fat_mass_kg, 21.3); assert.equal(a.lean_mass_kg, 47.1);
  // lean 47.1 at 25% fat → 62.8 kg
  assert.equal(a.healthy_weight_kg, 62.7); assert.equal(a.healthy_fat_target_pct, 25);
  assert.equal(a.overall, "warning");
  assert.match(a.headline, /ลดไขมันโดยรักษากล้ามเนื้อ/);
  // unknown sex falls to the female chart and says so
  const u = assessScan({ ...F, gender: null }); assert.equal(u.gender_assumed, true); assert.equal(u.gender_used, "female");
  // missing height → BMI has no verdict, never a fake number
  assert.equal(assessScan({ ...F, height_cm: null }).metrics.find((x) => x.key === "bmi")!.value, null);
});

test("play numbers: fat scenario, BMR fallback, TDEE, protein range, walking kcal", () => {
  const s = fatScenario(F, 25)!;
  assert.equal(s.weight_then_kg, 62.7); assert.equal(s.fat_to_lose_kg, 5.7); assert.equal(s.weeks_at_half_kg, 12);
  assert.equal(fatScenario(F, 40)!.fat_to_lose_kg, 0); // asking for more fat never says "lose"
  assert.equal(estimateBmr(F), 1312);
  assert.equal(estimateBmr({ ...F, bmr: null }), Math.round(10 * 68.4 + 6.25 * 165 - 5 * 52 - 161));
  assert.equal(tdee(1312, "moderate"), Math.round(1312 * 1.55));
  assert.deepEqual(proteinRange(68.4), { low: 82, high: 109 });
  assert.equal(walkingKcal(68.4, 30), Math.round(((3.5 * 3.5 * 68.4) / 200) * 30));
  assert.equal(walkingKcal(null, 30), null);
});

test("guidance: high fat + visceral ranks fiber-first / walking; low muscle ranks resistance first; L2 never names a product or dose; L3 adds labs only when the numbers call for them", () => {
  const a = assessScan(F);
  const g = guidance(F, a, { ...QUIZ_EMPTY, sugary_drinks: "daily", sleep_h: 6 });
  assert.equal(g.l1.length, 5);
  assert.equal(g.l1[0].id, "no_sugar_drink");
  assert.ok(g.l1.some((t) => t.id === "fiber_first") && g.l1.some((t) => t.id === "walk_after"));
  for (const x of g.l2) { assert.ok(!/Nutrilite|Double|mg|IU|เม็ด/.test(x.nutrient + x.why + x.note), x.nutrient); }
  assert.ok(g.l2.some((x) => x.nutrient === "โอเมก้า-3"));
  assert.ok(g.l3.some((x) => /HbA1c/.test(x.what)) && !g.l3.some((x) => /ALT/.test(x.what)));
  const lowMuscle: RevealInput = { ...F, weight: 60, fat_pct: 24, muscle_pct: 22, visceral: 4 };
  const g2 = guidance(lowMuscle, assessScan(lowMuscle), QUIZ_EMPTY);
  assert.equal(g2.l1[0].id, "resistance");
  assert.ok(!g2.l3.some((x) => /HbA1c/.test(x.what)));
  assert.match(g.disclaimer, /เภสัชกร/);
});
