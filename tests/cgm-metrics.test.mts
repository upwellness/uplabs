/**
 * CGM metrics — definitions per International Consensus on TIR (Battelino 2019).
 * Each test pins one definition so a future "tidy-up" cannot quietly move a threshold.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMetrics, countLowEvents, TARGETS } from "../lib/api/cgm-metrics.ts";

const BKK = 7 * 3_600_000;
/** points every 5 min starting at a Bangkok wall-clock */
const series = (vals: number[], y = 2026, mo = 9, d = 7, h = 0, mi = 0) =>
  vals.map((v, i) => ({ t: Date.UTC(y, mo - 1, d, h, mi) - BKK + i * 5 * 60_000, v }));

test("empty input is honest, not zero", () => {
  const m = computeMetrics([]);
  assert.equal(m.n, 0);
  assert.equal(m.mean, null);
  assert.ok(m.caveats.some((c) => c.includes("ไม่มีข้อมูล")));
});

test("band arithmetic on a known set", () => {
  const m = computeMetrics(series([69, 70, 180, 181, 250, 251, 53, 54]));
  assert.equal(m.tir_70_180, 25);          // 70, 180 → 2/8
  assert.equal(m.tar_above_180, 37.5);     // 181, 250, 251 → 3/8
  assert.equal(m.tar_above_250, 12.5);     // 251 → 1/8
  assert.equal(m.tbr_below_70, 37.5);      // 69, 53, 54 → 3/8
  assert.equal(m.tbr_below_54, 12.5);      // 53 → 1/8
  assert.equal(m.titr_70_140, 12.5);       // 70 → 1/8
});

test("mean / sd / cv / gmi use the documented formulas", () => {
  const m = computeMetrics(series([100, 100, 100, 100]));
  assert.equal(m.mean, 100); assert.equal(m.sd, 0); assert.equal(m.cv, 0);
  assert.equal(m.gmi, 5.7); // 3.31 + 0.02392 × 100 = 5.702
  const v = computeMetrics(series([80, 120]));
  assert.equal(v.sd, 28.3);  // sample sd of [80,120] = 28.28
  assert.equal(v.cv, 28.3);  // 28.28/100
});

test("reliability needs BOTH 14 days and 70% completeness", () => {
  const twoDays = computeMetrics(series(Array(288 * 2).fill(100)));
  assert.equal(twoDays.days, 2);
  assert.equal(twoDays.completeness_pct, 100);
  assert.equal(twoDays.reliable, false);
  assert.ok(twoDays.caveats.some((c) => c.includes("14")));

  const full = computeMetrics(series(Array(288 * 14).fill(100)));
  assert.equal(full.days, 14);
  assert.equal(full.reliable, true);

  // 14 days of span but only every 3rd reading present → ~33% → not reliable
  const sparse = computeMetrics(series(Array(288 * 14).fill(100)).filter((_, i) => i % 3 === 0));
  assert.equal(sparse.days, 14);
  assert.ok(sparse.completeness_pct < 40);
  assert.equal(sparse.reliable, false);
});

test("days are counted on the Bangkok calendar, not UTC", () => {
  // 23:50 → 00:10 local on the next day = 2 local days; in UTC both are the same day (16:50–17:10)
  const m = computeMetrics(series([100, 100, 100, 100, 100], 2026, 9, 7, 23, 50));
  assert.equal(m.days, 2);
  assert.equal(m.per_day[0].date, "2026-09-07");
  assert.equal(m.per_day[1].date, "2026-09-08");
  assert.equal(m.from, "2026-09-07 23:50");
});

test("nocturnal TBR looks only at 00:00–06:00 local", () => {
  const night = series([60, 60, 60], 2026, 9, 7, 2, 0);      // 02:00 local, all low
  const day = series([100, 100, 100], 2026, 9, 7, 14, 0);    // 14:00 local, all fine
  const m = computeMetrics([...night, ...day]);
  assert.equal(m.nocturnal_tbr_below_70, 100);
  assert.equal(m.tbr_below_70, 50);
});

test("low events: a run must last ≥15 min, a data gap breaks the run, separate runs count separately", () => {
  const ok = { v: 100 }, lo = { v: 60 };
  const mk = (arr: { v: number }[], start = 0) => arr.map((p, i) => ({ t: start + i * 5 * 60_000, v: p.v }));
  assert.equal(countLowEvents(mk([ok, lo, lo, ok])), 0);            // 10 min low → not an event
  assert.equal(countLowEvents(mk([ok, lo, lo, lo, lo, ok])), 1);    // 20 min low → 1
  assert.equal(countLowEvents(mk([lo, lo, lo, lo, ok, ok, lo, lo, lo, lo])), 2);
  // gap: two lows, then 30 min missing, then two lows — not one continuous 15-min run
  const gappy = [...mk([lo, lo]), ...mk([lo, lo], 40 * 60_000)];
  assert.equal(countLowEvents(gappy), 0);
});

test("meets/targets mirror the consensus thresholds", () => {
  assert.equal(TARGETS.tir_70_180.min, 70);
  assert.equal(TARGETS.tbr_below_70.max, 4);
  assert.equal(TARGETS.tbr_below_54.max, 1);
  assert.equal(TARGETS.cv.max, 36);
  const good = computeMetrics(series(Array(288 * 14).fill(110)));
  assert.equal(good.meets.tir_70_180, true);
  assert.equal(good.meets.tbr_below_70, true);
  assert.equal(good.meets.cv, true);
});

test("below-54 readings always add the finger-stick caveat", () => {
  const m = computeMetrics(series([100, 50, 100]));
  assert.ok(m.caveats.some((c) => c.includes("เจาะปลายนิ้ว")));
});
