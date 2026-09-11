/**
 * Parsing CGM exports into cgm_readings rows.
 *
 * The one invariant that matters most: a Thai wall-clock string must produce the SAME
 * reading_timestamp that the 52,000 rows already in the table use, or day-level
 * metrics for that person silently shift by seven hours.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { coerceTime, coerceGlucose, findHeader, parseCgmGrid, summariseRows, normaliseProfileName } from "../lib/api/cgm-import.ts";

test("Thai wall-clock string → the exact epoch already stored in the table", () => {
  // Row seen in production: original_time '2026-08-23 21:12' ↔ reading_timestamp 1787494320000
  const t = coerceTime("2026-08-23 21:12");
  assert.equal(t?.ms, 1787494320000);
  assert.equal(t?.original, "2026-08-23 21:12");
  assert.equal(t?.date, "2026-08-23");
});

test("all accepted time shapes agree on the same instant", () => {
  const ref = coerceTime("2026-09-11 19:08")!.ms;
  assert.equal(coerceTime("2026-09-11 19:08:00")!.ms, ref);
  assert.equal(coerceTime("2026-09-11T19:08")!.ms, ref);
  assert.equal(coerceTime("11/09/2026 19:08")!.ms, ref);            // day-first
  assert.equal(coerceTime(new Date(Date.UTC(2026, 8, 11, 19, 8)))!.ms, ref); // xlsx cellDates
  // Excel serial for 2026-09-11 19:08 = 46276 + 19:08/24h
  const serial = 46276 + (19 * 60 + 8) / 1440;
  assert.equal(coerceTime(serial)!.ms, ref);
});

test("garbage times are rejected, not guessed", () => {
  for (const bad of ["", "yesterday", "2026-13-01 10:00", "2026-09-11 25:00", 12, null, "2026-09-11"]) {
    assert.equal(coerceTime(bad), null, `should reject ${JSON.stringify(bad)}`);
  }
});

test("glucose: strings, numbers, LO/HI clamps, mmol conversion, sanity range", () => {
  assert.equal(coerceGlucose("83", "mg/dL"), 83);
  assert.equal(coerceGlucose(101.26, "mg/dL"), 101.3);
  assert.equal(coerceGlucose("LO", "mg/dL"), 36);
  assert.equal(coerceGlucose("HI", "mg/dL"), 400);
  assert.equal(coerceGlucose("5.5", "mmol/L"), 99.1);
  assert.equal(coerceGlucose("", "mg/dL"), null);
  assert.equal(coerceGlucose("abc", "mg/dL"), null);
  assert.equal(coerceGlucose(9, "mg/dL"), null);
  assert.equal(coerceGlucose(701, "mg/dL"), null);
});

test("Ottai header 'Glucosemg/dL' is found even with no space and with a banner row above", () => {
  const h = findHeader([["Ottai CGM export"], [], ["Time", "Glucosemg/dL"], ["2026-09-11 19:08", "83"]]);
  assert.deepEqual(h, { rowIdx: 2, timeCol: 0, glucoseCol: 1, unit: "mg/dL" });
  const mm = findHeader([["Device Timestamp", "Historic Glucose mmol/L"]]);
  assert.equal(mm?.unit, "mmol/L");
});

function ottaiGrid(n: number, start = Date.UTC(2026, 8, 6, 13, 38)) {
  // Ottai exports NEWEST first, 5-minute steps, Thai wall-clock; build newest-first too.
  const rows: unknown[][] = [["Time", "Glucosemg/dL"]];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(start + i * 5 * 60_000);
    const s = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    rows.push([s, String(90 + (i % 40))]);
  }
  return rows;
}

test("parseCgmGrid: sorts ascending, tags profile, drops in-file duplicates keeping the first (newest) copy", () => {
  const grid = ottaiGrid(30);
  grid.splice(2, 0, [grid[1][0], "999"]); // duplicate newest timestamp, out-of-range value → still counts as dup? no: rejected first
  grid.splice(3, 0, [grid[1][0], "150"]); // genuine duplicate with a valid value
  const r = parseCgmGrid(grid, "ทดสอบ");
  assert.ok(r.ok, r.error);
  assert.equal(r.rows[0].profile_name, "ทดสอบ");
  for (let i = 1; i < r.rows.length; i++) assert.ok(r.rows[i].reading_timestamp > r.rows[i - 1].reading_timestamp, "ascending");
  assert.equal(r.duplicates_in_file, 1);
  assert.equal(r.rejected.length, 1);
  assert.match(r.rejected[0].reason, /10–700/);
  // the newest row's value survived (first occurrence wins), not the later duplicate's 150
  const newest = r.rows[r.rows.length - 1];
  assert.equal(newest.glucose, 90 + 29 % 40);
});

test("parseCgmGrid: too few readings is an error that still returns what it parsed", () => {
  const r = parseCgmGrid(ottaiGrid(5), "x");
  assert.equal(r.ok, false);
  assert.match(r.error!, /อย่างน้อย 12/);
  assert.equal(r.rows.length, 5);
});

test("parseCgmGrid: no recognisable header → clear error", () => {
  const r = parseCgmGrid([["foo", "bar"], [1, 2]], "x");
  assert.equal(r.ok, false);
  assert.match(r.error!, /Time/);
});

test("summariseRows: days, span, completeness at 5-minute cadence", () => {
  // 576 readings from local midnight = exactly 2 calendar days (a mid-day start would straddle 3)
  const r = parseCgmGrid(ottaiGrid(288 * 2, Date.UTC(2026, 8, 6, 0, 0)), "x");
  const s = summariseRows(r.rows);
  assert.equal(s.count, 576);
  assert.equal(s.days, 2);
  assert.equal(s.completeness_pct, 100);
  // drop half the rows → completeness halves
  const half = summariseRows(r.rows.filter((_, i) => i % 2 === 0));
  assert.ok(half.completeness_pct > 49 && half.completeness_pct < 51, String(half.completeness_pct));
});

test("profile names are trimmed, collapsed and bounded", () => {
  assert.equal(normaliseProfileName("  คุณ   มาลี "), "คุณ มาลี");
  assert.equal(normaliseProfileName(""), null);
  assert.equal(normaliseProfileName("x".repeat(81)), null);
});
