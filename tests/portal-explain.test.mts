/**
 * Customer-portal glossary + AI-explain guardrails (SPEC-Mobile-Portal.md R4, Q4).
 * The model may only rephrase engine-graded facts: every figure in its answer must come
 * from the facts, and clinical/product vocabulary is rejected outright.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { assess, type AssessInput, type LabPoint } from "../lib/health-design/assess.ts";
import { buildFacts, buildPrompt, validateAnswer, fallbackAnswer, levelLabelTh } from "../lib/health-design/explain.ts";

const TODAY = "2026-09-14";
const lab = (metric_key: string, value_num: number, recorded_at = "2026-09-02", unit: string | null = null): LabPoint =>
  ({ metric_key, label_th: null, value_num, value: String(value_num), unit, recorded_at });
const input = (): AssessInput => ({
  customer: { gender: "female", age: 52, height_cm: 165 },
  labs: [lab("hba1c", 5.8, "2026-09-02", "%"), lab("ldl", 131), lab("hdl", 54), lab("egfr", 96)],
  measurement: { recorded_at: "2026-09-08", weight: 68.4, fat_pct: 31.2, muscle_pct: 26.1, visceral: 9, body_age: 55 },
  cgm: null, wearable: null, food: null, today: TODAY,
});

test("buildFacts: metric facts carry value, engine verdict, source, bands, and the numbers set; unknown metric → error", () => {
  const a = assess(input());
  const f = buildFacts({ kind: "metric", domain: "metabolic", metric: "hba1c" }, a, null, "female");
  assert.ok(!("error" in f));
  if ("error" in f) return;
  assert.equal(f.title, "HbA1c");
  assert.ok(f.facts.some((x) => x.includes("5.8")), "value");
  assert.ok(f.facts.some((x) => x.includes("ควรติดตาม")), "verdict from engine");
  assert.ok(f.facts.some((x) => x.includes("ADA")), "source");
  assert.ok(f.numbers.includes("5.8") && f.numbers.includes("5.7") && f.numbers.includes("6.5"));
  assert.deepEqual(f.actions, []);
  assert.match(buildPrompt(f), /ยังไม่มีแผน/);
  assert.deepEqual(buildFacts({ kind: "metric", domain: "metabolic", metric: "nope" }, a, null, null), { error: "ไม่พบค่านี้ในผลประเมินล่าสุด" });
  const ov = buildFacts({ kind: "overview" }, a, null, null);
  assert.ok(!("error" in ov) && ov.facts.length >= 7);
  assert.equal(levelLabelTh("metabolic", "attention"), "อยู่ในช่วงที่ควรปรึกษาแพทย์");
  assert.equal(levelLabelTh("body_comp", "attention"), "อยู่ในช่วงที่ต้องดูแลจริงจัง");
});

test("validateAnswer: numbers must come from the facts; diagnosis/treatment/product words are rejected; fallback uses engine words", () => {
  const allowed = ["5.8", "5.7", "6.5", "2026", "09", "02", "69"];
  const good = { what: "น้ำตาลสะสม 2–3 เดือน", where: "5.8% อยู่ในช่วงควรติดตาม (เกณฑ์ 5.7–6.5) สูงกว่าคนวัยเดียวกันราว 69%", action: "เดินหลังมื้อเย็น" };
  assert.equal(validateAnswer(good, allowed).ok, true);
  const invented = { ...good, where: "5.8% ถือว่าดี ถ้าถึง 7.2 ค่อยกังวล" };
  const r1 = validateAnswer(invented, allowed); assert.equal(r1.ok, false); assert.match((r1 as any).reason, /7\.2/);
  const dx = { ...good, where: "คุณเป็นเบาหวานระยะแรก" };
  assert.equal(validateAnswer(dx, allowed).ok, false);
  const product = { ...good, action: "กิน Nutrilite Double X วันละ 2 เม็ด" };
  assert.equal(validateAnswer(product, allowed).ok, false);
  const rx = { ...good, action: "ควรกินยา metformin" };
  assert.equal(validateAnswer(rx, allowed).ok, false);
  assert.equal(validateAnswer({ what: "x" }, allowed).ok, false);
  // small counts ("3 ข้อ") are allowed even when not in the facts; everyday "รักษาระดับ" (keep) is not a treatment word
  assert.equal(validateAnswer({ ...good, action: "ทำ 3 ข้อจากแผน เพื่อรักษาระดับน้ำตาลให้คงที่" }, allowed).ok, true);
  assert.equal(validateAnswer({ ...good, action: "ควรรับการรักษา" }, allowed).ok, false);

  const a = assess(input());
  const f = buildFacts({ kind: "metric", domain: "metabolic", metric: "hba1c" }, a, null, "female");
  if ("error" in f) throw new Error();
  const fb = fallbackAnswer(f);
  assert.match(fb.what, /เม็ดเลือดแดง/); assert.equal(fb.where, "ควรติดตาม"); assert.equal(fb.action, "รอโค้ชวางแผน");
});
