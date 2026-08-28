/**
 * Tests for the comparison table builder — the shape the whole "เทียบ 3 รอบ" ask
 * depends on. Pure input → output, no database.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCompare, ageFrom, selectRounds, type LabRound } from "../lib/api/compare.ts";

const v = (key: string, num: number | null, status = "normal", unit = "mg/dL") => ({
  metric_key: key, metric_label_th: key, value: num == null ? "" : String(num),
  value_num: num, unit, status, category: "lipid", ref_text: "<100", recorded_at: "",
});

const round = (date: string, values: any[]): LabRound => ({
  recorded_at: date, source: "test", notes: null,
  values: values.map((x) => ({ ...x, recorded_at: date })),
});

test("metrics align to rounds and missing draws stay null", () => {
  const out = buildCompare([
    round("2026-01-01", [v("ldl", 165, "high"), v("hdl", 36, "low")]),
    round("2026-06-01", [v("ldl", 120, "high")]),               // hdl not drawn
    round("2026-08-01", [v("ldl", 87), v("hdl", 40, "low")]),
  ]);

  const ldl = out.metrics.find((m) => m.metric_key === "ldl")!;
  const hdl = out.metrics.find((m) => m.metric_key === "hdl")!;
  assert.deepEqual(ldl.values, [165, 120, 87]);
  assert.deepEqual(hdl.values, [36, null, 40], "a round without the test must be null");
  assert.equal(out.rounds.length, 3);
});

test("a missing round is never filled in with zero or the previous value", () => {
  const out = buildCompare([
    round("2026-01-01", [v("hdl", 36)]),
    round("2026-06-01", []),
    round("2026-08-01", [v("hdl", 40)]),
  ]);
  const hdl = out.metrics.find((m) => m.metric_key === "hdl")!;
  assert.equal(hdl.values[1], null);
  assert.notEqual(hdl.values[1], 0, "zero would read as a real measurement of zero");
  assert.notEqual(hdl.values[1], 36, "carrying the previous value forward invents a draw");
});

test("delta uses the last two rounds that actually have a value", () => {
  const out = buildCompare([
    round("2026-01-01", [v("hdl", 36)]),
    round("2026-06-01", []),
    round("2026-08-01", [v("hdl", 40)]),
  ]);
  const hdl = out.metrics.find((m) => m.metric_key === "hdl")!;
  assert.deepEqual({ from: hdl.delta!.from, to: hdl.delta!.to, change: hdl.delta!.change },
    { from: 36, to: 40, change: 4 });
  assert.equal(hdl.delta!.direction, "up");
});

test("direction is judged per metric, not globally", () => {
  const out = buildCompare([
    round("2026-01-01", [v("ldl", 165), v("hdl", 36)]),
    round("2026-08-01", [v("ldl", 87), v("hdl", 40)]),
  ]);
  // LDL falling and HDL rising are both improvements
  assert.equal(out.summary.improved, 2);
  assert.equal(out.summary.worsened, 0);
});

test("a single round yields no delta rather than a fake one", () => {
  const out = buildCompare([round("2026-08-01", [v("ldl", 87)])]);
  assert.equal(out.metrics[0].delta, null);
});

test("percentage change is computed, and division by zero does not produce Infinity", () => {
  const out = buildCompare([
    round("2026-01-01", [v("tg", 353)]),
    round("2026-08-01", [v("tg", 145)]),
  ]);
  assert.equal(out.metrics[0].delta!.pct, -58.9);

  const zero = buildCompare([
    round("2026-01-01", [v("x", 0)]),
    round("2026-08-01", [v("x", 5)]),
  ]);
  assert.equal(zero.metrics[0].delta!.pct, null);
});

test("abnormal count reflects the latest round only", () => {
  const out = buildCompare([
    round("2026-01-01", [v("ldl", 165, "high"), v("hdl", 36, "low")]),
    round("2026-08-01", [v("ldl", 87, "normal"), v("hdl", 40, "low")]),
  ]);
  assert.equal(out.summary.abnormal_in_latest, 1);
});

test("empty input does not throw", () => {
  const out = buildCompare([]);
  assert.deepEqual(out.metrics, []);
  assert.equal(out.summary.rounds_returned, 0);
});

test("age is computed from a birth date and tolerates junk", () => {
  const y = new Date().getFullYear();
  assert.equal(ageFrom(`${y - 40}-01-01`), 40);
  assert.equal(ageFrom(null), null);
  assert.equal(ageFrom("not-a-date"), null);
});

test("round selection skips single-value visits when asked, and says which", () => {
  // real shape: two home glucometer readings between two hospital panels
  const perDate = new Map([
    ["2026-06-20", 5],   // clinic
    ["2026-07-01", 1],   // fingerstick
    ["2026-07-03", 1],   // fingerstick
    ["2026-08-28", 8],   // clinic
  ]);

  const loose = selectRounds(perDate, 3, 1);
  assert.deepEqual(loose.chosen, ["2026-07-01", "2026-07-03", "2026-08-28"],
    "with no floor, the two fingersticks crowd out the June panel");

  const strict = selectRounds(perDate, 3, 2);
  assert.deepEqual(strict.chosen, ["2026-06-20", "2026-08-28"],
    "with a floor of 2, the comparison is clinic-to-clinic");
  assert.deepEqual(strict.skipped.map((s) => s.recorded_at).sort(), ["2026-07-01", "2026-07-03"],
    "and what was left out is reported, not silently dropped");
});

test("round selection returns oldest → newest so charts and tables read left to right", () => {
  const perDate = new Map([["2026-01-01", 3], ["2026-05-01", 3], ["2026-08-01", 3]]);
  assert.deepEqual(selectRounds(perDate, 3).chosen, ["2026-01-01", "2026-05-01", "2026-08-01"]);
});

test("round selection honours the requested count", () => {
  const perDate = new Map([["2026-01-01", 3], ["2026-05-01", 3], ["2026-08-01", 3]]);
  assert.deepEqual(selectRounds(perDate, 2).chosen, ["2026-05-01", "2026-08-01"], "the 2 most recent");
});

test("round selection copes with nothing meeting the floor", () => {
  const out = selectRounds(new Map([["2026-08-01", 1]]), 3, 2);
  assert.deepEqual(out.chosen, []);
  assert.equal(out.skipped.length, 1);
});
