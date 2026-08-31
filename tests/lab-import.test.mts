/**
 * Normalising lab values submitted for review.
 *
 * This is the seam where a misread turns into a stored number, so the rule under test
 * throughout is: normalise, never invent. Anything unclear becomes a warning for the
 * reviewer rather than a guess baked into the record.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseSubmission, validateDrawDate, summarise } from "../lib/api/lab-import.ts";

const TODAY = new Date("2026-08-31T00:00:00Z");
const one = (v: any) => normaliseSubmission([v], TODAY);
const first = (v: any) => one(v).values![0];

/* ── shape ────────────────────────────────────────────────────────────────── */

test("a clean submission normalises without complaint", () => {
  const r = normaliseSubmission([
    { metric_key: "hba1c", value: "5.5", value_num: 5.5, unit: "%", status: "normal", category: "glucose" },
  ], TODAY);
  assert.equal(r.ok, true);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.values![0].value_num, 5.5);
});

test("values must be a non-empty array", () => {
  assert.equal(normaliseSubmission(null as any, TODAY).ok, false);
  assert.equal(normaliseSubmission({} as any, TODAY).ok, false);
  assert.equal(normaliseSubmission([], TODAY).ok, false);
});

test("metric_key is required and normalised to a safe form", () => {
  assert.equal(one({ value: "5" }).ok, false);
  assert.equal(first({ metric_key: "  HbA1c  ", value: "5.5" }).metric_key, "hba1c");
  assert.equal(first({ metric_key: "alt sgpt", value: "17" }).metric_key, "alt_sgpt");
  assert.equal(one({ metric_key: "ldl; drop table", value: "1" }).ok, false, "must reject odd characters");
});

test("a value is required, but does not have to be a number", () => {
  assert.equal(one({ metric_key: "hba1c" }).ok, false);
  const neg = first({ metric_key: "hbsag", value: "Negative" });
  assert.equal(neg.value, "Negative");
  assert.equal(neg.value_num, null, "non-numeric results keep no number rather than a fake 0");
});

test("numbers with thousands separators still parse", () => {
  assert.equal(first({ metric_key: "triglyceride", value: "1,240" }).value_num, 1240);
});

/* ── the misreads this exists to catch ────────────────────────────────────── */

test("★ a value far outside human range is flagged, not stored quietly", () => {
  const r = first({ metric_key: "hba1c", value: "55", unit: "%" });   // 5.5 read as 55
  assert.match(r.warnings.join(" "), /นอกช่วงที่เป็นไปได้/);
  assert.equal(r.value_num, 55, "the value is kept as submitted — the reviewer decides");
});

test("★ a unit that changes the number by an order of magnitude is flagged", () => {
  const r = first({ metric_key: "fbs", value: "6.0", unit: "mmol/L" });
  assert.match(r.warnings.join(" "), /mmol\/L/);
  assert.equal(r.unit, "mmol/L", "flagged, never silently converted");
});

test("★ value and value_num disagreeing is flagged", () => {
  // classic OCR slip: the text says one thing, the parsed number another
  const r = first({ metric_key: "ldl", value: "87", value_num: 8.7 });
  assert.match(r.warnings.join(" "), /ไม่ตรงกัน/);
  assert.equal(r.value_num, 8.7, "value_num wins, but the reviewer is told");
});

test("★ a repeated metric is flagged — a row read twice", () => {
  const r = normaliseSubmission([
    { metric_key: "ldl", value: "87" },
    { metric_key: "ldl", value: "112" },
  ], TODAY);
  assert.match(r.warnings!.join(" "), /ซ้ำ/);
});

test("★ a missing status is never inferred", () => {
  const r = first({ metric_key: "ldl", value: "165" });
  assert.equal(r.status, "normal");
  assert.match(r.warnings.join(" "), /ไม่ได้ระบุสถานะ/,
    "165 is high, but inferring that would mean deciding a clinical threshold from a guess");
});

test("an unrecognised status falls back and says so", () => {
  const r = first({ metric_key: "ldl", value: "165", status: "HIGH!!" });
  assert.equal(r.status, "normal");
  assert.match(r.warnings.join(" "), /ไม่รู้จัก/);
});

test("a valid status passes through untouched and unflagged", () => {
  for (const s of ["normal", "low", "high", "borderline"]) {
    const r = first({ metric_key: "ldl", value: "1", status: s });
    assert.equal(r.status, s);
    assert.equal(r.warnings.some((w) => w.includes("สถานะ")), false, `${s} should not warn`);
  }
});

test("an unknown category is kept and flagged, never rewritten", () => {
  const r = first({ metric_key: "x", value: "1", category: "lipids" });  // typo for "lipid"
  assert.equal(r.category, "lipids");
  assert.match(r.warnings.join(" "), /ยังไม่เคยใช้/);
});

test("a known category passes clean", () => {
  assert.deepEqual(first({ metric_key: "ldl", value: "87", status: "normal", category: "lipid" }).warnings, []);
});

/* ── draw date ────────────────────────────────────────────────────────────── */

test("★ a Buddhist year on the lab slip is caught with the Gregorian one offered", () => {
  const r = validateDrawDate("2569-08-24", TODAY);
  assert.equal(r.ok, false);
  assert.match(r.error!, /2026/);
});

test("draw date must be present, well formed, and not in the future", () => {
  assert.equal(validateDrawDate("", TODAY).ok, false);
  assert.equal(validateDrawDate("24/08/2026", TODAY).ok, false);
  assert.equal(validateDrawDate("2026-09-30", TODAY).ok, false, "future");
  assert.equal(validateDrawDate("1989-01-01", TODAY).ok, false, "implausibly old");
  assert.equal(validateDrawDate("2026-08-24", TODAY).ok, true);
  assert.equal(validateDrawDate("2026-08-31", TODAY).ok, true, "today is fine");
});

/* ── inbox summary ────────────────────────────────────────────────────────── */

test("the inbox summary leads with what needs attention", () => {
  const r = normaliseSubmission([
    { metric_key: "hba1c", value: "5.5", unit: "%", status: "normal", category: "glucose" },
    { metric_key: "ldl", value: "165", status: "high", category: "lipid" },
    { metric_key: "fbs", value: "6.0", unit: "mmol/L", status: "normal", category: "glucose" },
  ], TODAY);
  const s = summarise(r.values!);
  assert.match(s, /3 ค่า/);
  assert.match(s, /ผิดปกติ 1/);
  assert.match(s, /ต้องดู/);
});

test("normalisation is pure — same input, same output", () => {
  const input = [{ metric_key: "ldl", value: "87", status: "normal", category: "lipid" }];
  assert.deepEqual(normaliseSubmission(input, TODAY), normaliseSubmission(input, TODAY));
});
