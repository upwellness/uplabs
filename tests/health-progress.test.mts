/** Progress against a plan: only newer readings count; band moves decide achieved/worsening; retests come due by day. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { assess, type AssessInput, type LabPoint } from "../lib/health-design/assess.ts";
import { draftPlan } from "../lib/health-design/plan.ts";
import { computeProgress } from "../lib/health-design/progress.ts";

const lab = (metric_key: string, value_num: number, recorded_at: string): LabPoint => ({ metric_key, label_th: null, value_num, value: String(value_num), unit: null, recorded_at });
const base = (over: Partial<AssessInput> = {}): AssessInput => ({ customer: { gender: "female", age: 60, height_cm: 158 }, labs: [], measurement: null, cgm: null, wearable: null, food: null, today: "2026-09-12", ...over });
const m0 = { recorded_at: "2026-06-01", weight: 64, fat_pct: 36.4, muscle_pct: 24.3, visceral: 8, body_age: 64 };

test("no newer readings → every goal is no_new_data, day counter runs from confirmation", () => {
  const a0 = assess(base({ measurement: m0, labs: [lab("hba1c", 6.0, "2026-06-01")] }));
  const plan = draftPlan({ assessment: a0, assessment_id: "a0", customer: { gender: "female", age: 60, weight: 64, height_cm: 158 }, supplements: null, today: "2026-06-02" });
  const p = computeProgress({ baseline: a0, baseline_at: "2026-06-02T00:00:00Z", current: a0, current_at: "2026-07-02T00:00:00Z", plan, plan_confirmed_at: "2026-06-03T00:00:00Z", today: "2026-07-03T00:00:00Z" });
  assert.equal(p.day, 30); assert.equal(p.days_left, 60);
  assert.ok(p.goals.every((g) => g.status === "no_new_data"));
  assert.ok(p.due_now.some((d) => d.when_days === 30));           // 30-day retests are due today
  assert.ok(!p.due_now.some((d) => d.when_days === 90));
});

test("newer BCA and labs: better numbers → improving; band watch→good → achieved; worse band → worsening", () => {
  const a0 = assess(base({ measurement: m0, labs: [lab("hba1c", 6.0, "2026-06-01"), lab("ldl", 165, "2026-06-01"), lab("alt_sgpt", 45, "2026-06-01")] }));
  const plan = draftPlan({ assessment: a0, assessment_id: "a0", customer: { gender: "female", age: 60, weight: 64, height_cm: 158 }, supplements: null, today: "2026-06-02" });
  const a1 = assess(base({ today: "2026-09-01", measurement: { recorded_at: "2026-08-30", weight: 61, fat_pct: 33.9, muscle_pct: 25.1, visceral: 7, body_age: 62 },
    labs: [lab("hba1c", 5.6, "2026-08-30"), lab("ldl", 172, "2026-08-30"), lab("alt_sgpt", 85, "2026-08-30")] }));
  const p = computeProgress({ baseline: a0, baseline_at: "2026-06-02T00:00:00Z", current: a1, current_at: "2026-09-01T00:00:00Z", plan, plan_confirmed_at: "2026-06-02T00:00:00Z", today: "2026-09-01T00:00:00Z" });
  const by = Object.fromEntries(p.goals.map((g) => [g.domain, g]));
  assert.equal(by.body_comp.status, "improving");
  const fat = by.body_comp.changes.find((c) => c.metric === "fat_pct")!;
  assert.equal(fat.delta, -2.5); assert.equal(fat.better, true);
  assert.equal(by.metabolic.status, "achieved");          // HbA1c 6.0 (watch) → 5.6 (good)
  assert.equal(by.cardio_lipid.status, "worsening");      // LDL 165 → 172, same band, number worse
  assert.match(p.summary_th, /ดีขึ้น 1/); assert.match(p.summary_th, /ถึงเป้าแล้ว 1/); assert.match(p.summary_th, /แย่ลง 1/);
  assert.ok(by.body_comp.note.includes("ไขมัน 36.4→33.9"));
});

test("weekly LINE nudge text: day counter, one line per goal, due items, portal link; suggests data when nothing is new", async () => {
  const { nudgeText } = await import("../lib/health-design/weekly-nudge.ts");
  const t = nudgeText("สุ", { day: 14, days_left: 76, goals: [{ domain: "body_comp", status: "improving", note: "ไขมัน 36.4→33.9 % (-2.5)" }, { domain: "metabolic", status: "no_new_data", note: "" }], due_now: [{ what: "ชั่ง BCA" }] }, "https://x.test/my/abc");
  assert.match(t, /วันที่ 14 \(เหลือ 76 วัน\)/); assert.match(t, /องค์ประกอบร่างกาย: ดีขึ้น — ไขมัน 36.4→33.9/); assert.match(t, /น้ำตาลและเมตาบอลิซึม: ยังไม่มีข้อมูลใหม่/);
  assert.match(t, /⏰ ถึงกำหนด: ชั่ง BCA/); assert.match(t, /https:\/\/x.test\/my\/abc/); assert.ok(!t.includes("ลองชั่ง BCA หรือบันทึกอาหาร"));
  const quiet = nudgeText("สุ", { day: 7, days_left: 83, goals: [{ domain: "body_comp", status: "no_new_data", note: "" }], due_now: [] }, null);
  assert.match(quiet, /ลองชั่ง BCA หรือบันทึกอาหาร/); assert.ok(!quiet.includes("http"));
});
