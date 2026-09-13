/**
 * Google Health API parsers — pinned to the shapes in the published v4 REST reference
 * (rollupDataPoints / dataPoints unions). A casing change on Google's side must show
 * up here, not as a silent "no data" in production.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDailyRollup, parseDataPoints, mergeSleepByDay, rollupBody, listFilter, parseBloodGlucose } from "../lib/pulse/google-health-parse.ts";

test("steps dailyRollUp → one reading per civil day at Bangkok noon", () => {
  const json = { rollupDataPoints: [
    { civilStartTime: { date: { year: 2026, month: 9, day: 10 }, time: { hours: 0 } }, civilEndTime: { date: { year: 2026, month: 9, day: 11 } }, value: { steps: { countSum: "8123" } } },
    { civil_start_time: { date: { year: 2026, month: 9, day: 11 } }, value: { steps: { count_sum: 4021 } } },
    { civilStartTime: { date: { year: 2026, month: 9, day: 12 } }, value: {} },
  ] };
  const rows = parseDailyRollup(json, "steps");
  assert.deepEqual(rows.map((r) => [r.recorded_at, r.value, r.unit]), [["2026-09-10T05:00:00.000Z", 8123, "count"], ["2026-09-11T05:00:00.000Z", 4021, "count"]]);
});

test("active-minutes rollup sums per-level minutes", () => {
  const json = { rollupDataPoints: [{ civilStartTime: { date: { year: 2026, month: 9, day: 10 } }, value: { activeMinutes: { activeMinutesRollupByActivityLevel: [{ activityLevel: "MODERATE", minutes: "20" }, { activityLevel: "VIGOROUS", minutes: 5 }] } } }] };
  assert.deepEqual(parseDailyRollup(json, "active_minutes").map((r) => r.value), [25]);
  // heart-rate rollup → avg / max / min as three rows; the minimum is hr_min, never rhr
  const hr = parseDailyRollup({ rollupDataPoints: [{ civilStartTime: { date: { year: 2026, month: 9, day: 12 } }, heartRate: { beatsPerMinuteAvg: 71.44, beatsPerMinuteMax: 132, beatsPerMinuteMin: 52 } }] }, "heart_rate");
  assert.deepEqual(hr.map((r) => [r.metric_type, r.value]), [["hr_bpm", 71.4], ["hr_max", 132], ["hr_min", 52]]);
  assert.ok(!hr.some((r) => r.metric_type === "rhr"));
});

test("daily resting HR and HRV list → rhr / hrv_rmssd rows", () => {
  const rhr = parseDataPoints({ dataPoints: [{ dailyRestingHeartRate: { date: { year: 2026, month: 9, day: 10 }, beatsPerMinute: "62" } }] }, "daily-resting-heart-rate");
  assert.deepEqual(rhr, [{ recorded_at: "2026-09-10T05:00:00.000Z", metric_type: "rhr", value: 62, unit: "bpm" }]);
  const hrv = parseDataPoints({ dataPoints: [{ dailyHeartRateVariability: { date: { year: 2026, month: 9, day: 10 }, averageHeartRateVariabilityMilliseconds: 41.26, entropy: 2.1 } }] }, "daily-heart-rate-variability");
  assert.equal(hrv[0].metric_type, "hrv_rmssd"); assert.equal(hrv[0].value, 41.3); assert.equal(hrv[0].unit, "ms");
});

test("sleep sessions → minutes asleep on the civil day they END; naps merge; zero-minute sessions dropped", () => {
  const json = { dataPoints: [
    { sleep: { interval: { civilStartTime: { date: { year: 2026, month: 9, day: 9 } }, civilEndTime: { date: { year: 2026, month: 9, day: 10 } } }, summary: { minutesAsleep: "402", minutesAwake: "35" } } },
    { sleep: { interval: { civilEndTime: { date: { year: 2026, month: 9, day: 10 } } }, summary: { minutesAsleep: 30 } } },
    { sleep: { interval: { civilEndTime: { date: { year: 2026, month: 9, day: 11 } } }, summary: { minutesAsleep: 0 } } },
  ] };
  const rows = mergeSleepByDay(parseDataPoints(json, "sleep"));
  assert.equal(rows.length, 1); assert.equal(rows[0].value, 432); assert.equal(rows[0].recorded_at, "2026-09-10T05:00:00.000Z");
});

test("request helpers: rollup body civil dates, snake_case list filters", () => {
  const b = rollupBody("2026-09-01", "2026-09-15");
  assert.deepEqual(b.range.start.date, { year: 2026, month: 9, day: 1 }); assert.equal(b.windowSizeDays, 1);
  // explicit midnight on both ends — the shape in Google's worked example (omitting `time` got INVALID_ARGUMENT live)
  assert.deepEqual(b.range.start.time, { hours: 0, minutes: 0, seconds: 0, nanos: 0 }); assert.deepEqual(b.range.end.time, b.range.start.time);
  assert.ok(!("pageSize" in b));
  // response shape from the filters guide: `steps` sits on the point itself, not under `value`
  const official = parseDailyRollup({ rollupDataPoints: [{ civilStartTime: { date: { year: 2026, month: 7, day: 28 }, time: {} }, civilEndTime: { date: { year: 2026, month: 7, day: 28 }, time: { hours: 23, minutes: 59, seconds: 59 } }, steps: { countSum: "8430" } }] }, "steps");
  assert.deepEqual(official.map((r) => [r.recorded_at.slice(0, 10), r.value]), [["2026-07-28", 8430]]);
  assert.equal(listFilter("sleep", "2026-09-01"), 'sleep.interval.civil_end_time >= "2026-09-01T00:00:00"');
  assert.equal(listFilter("daily-resting-heart-rate", "2026-09-01"), 'daily_resting_heart_rate.date >= "2026-09-01"');
  assert.deepEqual(parseDataPoints({}, "sleep"), []); assert.deepEqual(parseDailyRollup(null, "steps"), []);
});

test("blood glucose: CGM + unlabelled samples kept, fingerstick/lab dropped, local date from utcOffset, sorted", () => {
  const json = { dataPoints: [
    { bloodGlucose: { sampleTime: { physicalTime: "2026-09-12T17:30:00Z", utcOffset: "25200s" }, measurementSource: "CONTINUOUS_GLUCOSE_MONITORING", bloodGlucoseMilligramsPerDeciliter: 104.4 } },
    { bloodGlucose: { sampleTime: { physicalTime: "2026-09-12T17:25:00Z", utcOffset: "25200s" }, bloodGlucoseMilligramsPerDeciliter: 101 } },
    { bloodGlucose: { sampleTime: { physicalTime: "2026-09-12T12:00:00Z", utcOffset: "25200s" }, measurementSource: "SELF_MONITORING_BLOOD_GLUCOSE", bloodGlucoseMilligramsPerDeciliter: 95 } },
    { bloodGlucose: { sampleTime: { physicalTime: "2026-09-12T08:00:00Z", utcOffset: "25200s" }, measurementSource: "LAB_TEST", bloodGlucoseMilligramsPerDeciliter: 90 } },
    { blood_glucose: { sample_time: { physical_time: "not-a-time" }, blood_glucose_milligrams_per_deciliter: 100 } },
  ] };
  const s = parseBloodGlucose(json);
  assert.deepEqual(s.map((x) => [x.original, x.mgdl, x.local_date]), [["2026-09-12T17:25:00Z", 101, "2026-09-13"], ["2026-09-12T17:30:00Z", 104.4, "2026-09-13"]]);
  assert.deepEqual(parseBloodGlucose({}), []);
});

