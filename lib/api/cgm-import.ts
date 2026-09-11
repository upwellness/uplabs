/**
 * Turning a CGM export (Ottai and the like) into rows for `cgm_readings`.
 *
 * Pure: takes a grid of cells, returns rows plus a list of what was dropped and why.
 * No I/O, so the whole thing is unit-testable and the route stays thin.
 *
 * Conventions this MUST match, because 52,000 rows already in the table use them:
 *   - `original_time`      the device's wall-clock string, Thai local time, "YYYY-MM-DD HH:MM"
 *   - `reading_timestamp`  epoch milliseconds of that wall-clock time in Asia/Bangkok
 *   - `date_str`           the local calendar date
 * Getting the zone wrong would put every reading 7 hours off and silently break the
 * day-by-day metrics for that person — so the zone is fixed here, not inferred.
 */

export const BANGKOK_OFFSET_MIN = 7 * 60;
export const MAX_ROWS = 60_000;
export const MIN_READINGS = 12;
/** Readings above this are not glucose — a device clamps at ~400–500, anything past 700 is garbage. */
const GLUCOSE_MAX = 700;
const GLUCOSE_MIN = 10;
/** Value a device writes when it reports "LO" — below its measurable floor. */
const DEVICE_FLOOR = 36;
const DEVICE_CEILING = 400;

export interface CgmRow {
  profile_name: string;
  original_time: string;
  reading_timestamp: number;
  date_str: string;
  glucose: number;
}

export interface RejectedRow {
  row: number;            // 1-based row in the sheet
  reason: string;
  cells?: unknown[];
}

export interface ParseResult {
  ok: boolean;
  error?: string;
  rows: CgmRow[];
  rejected: RejectedRow[];
  unit: "mg/dL" | "mmol/L";
  header_row: number;
  duplicates_in_file: number;
}

/** Strip BOM, spaces, punctuation and case so header matching survives real files. */
const normalise = (s: unknown) =>
  String(s ?? "").replace(/^﻿/, "").toLowerCase().replace(/[^a-z0-9฀-๿]/g, "");

const TIME_KEYS = ["time", "timestamp", "datetime", "devicetimestamp", "date", "เวลา", "วันเวลา", "วันที่"];
// `Glucosemg/dL` in the Ottai export has no space — which is exactly why we
// normalise instead of comparing literals.
const GLUCOSE_KEYS = [
  "glucosemgdl", "glucosemmoll", "glucose", "bloodglucose", "sensorglucose",
  "glucosevalue", "historicglucose", "ค่าน้ำตาล", "น้ำตาล", "sg",
];

interface HeaderHit { rowIdx: number; timeCol: number; glucoseCol: number; unit: "mg/dL" | "mmol/L" }

export function findHeader(rows: unknown[][]): HeaderHit | null {
  // The header is not guaranteed to be row 1 — a summary block above it is common.
  const limit = Math.min(rows.length, 10);
  for (let r = 0; r < limit; r++) {
    const row = rows[r];
    if (!row) continue;
    let timeCol = -1, glucoseCol = -1, unit: "mg/dL" | "mmol/L" = "mg/dL";
    for (let c = 0; c < row.length; c++) {
      const key = normalise(row[c]);
      if (!key) continue;
      if (timeCol < 0 && TIME_KEYS.includes(key)) timeCol = c;
      if (glucoseCol < 0 && GLUCOSE_KEYS.some((k) => key === k || key.startsWith(k))) {
        glucoseCol = c;
        if (key.includes("mmol")) unit = "mmol/L";
      }
    }
    if (timeCol >= 0 && glucoseCol >= 0) return { rowIdx: r, timeCol, glucoseCol, unit };
  }
  return null;
}

export function coerceGlucose(cell: unknown, unit: "mg/dL" | "mmol/L"): number | null {
  let n: number;
  if (typeof cell === "number") {
    n = cell;
  } else {
    const s = String(cell ?? "").trim().replace(/,/g, "");
    if (!s) return null;
    // Some exports clamp the ends to words instead of numbers.
    if (/^(hi|high|>\s*\d+)$/i.test(s)) return DEVICE_CEILING;
    if (/^(lo|low|<\s*\d+)$/i.test(s)) return DEVICE_FLOOR;
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    n = parseFloat(s);
  }
  if (!Number.isFinite(n)) return null;
  if (unit === "mmol/L") n = n * 18.0182;
  if (n < GLUCOSE_MIN || n > GLUCOSE_MAX) return null;
  return Math.round(n * 10) / 10;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Build the epoch-ms for a Bangkok wall-clock time without touching the host's zone. */
function bangkokToEpochMs(y: number, mo: number, d: number, h: number, mi: number, s = 0): number {
  return Date.UTC(y, mo - 1, d, h, mi, s) - BANGKOK_OFFSET_MIN * 60_000;
}

export interface CoercedTime { ms: number; original: string; date: string }

/**
 * Accepts the shapes real exports use and returns Bangkok-anchored fields.
 *   "2026-09-11 19:08"  "2026-09-11 19:08:30"  "2026-09-11T19:08"
 *   "11/09/2026 19:08"  (day first — Thai/EU)
 *   Excel serial number (days since 1899-12-30, fractional = time of day)
 *   JS Date (xlsx with cellDates) — read as if its UTC fields were local wall-clock
 */
export function coerceTime(cell: unknown): CoercedTime | null {
  let y: number, mo: number, d: number, h: number, mi: number, s = 0;

  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return null;
    // xlsx parses date cells as UTC-midnight-based Dates carrying the sheet's wall-clock in UTC fields.
    y = cell.getUTCFullYear(); mo = cell.getUTCMonth() + 1; d = cell.getUTCDate();
    h = cell.getUTCHours(); mi = cell.getUTCMinutes(); s = cell.getUTCSeconds();
  } else if (typeof cell === "number") {
    if (!Number.isFinite(cell) || cell < 20_000 || cell > 80_000) return null; // sane Excel serial range (1954–2119)
    const ms = Math.round((cell - 25_569) * 86_400_000); // 25569 = 1970-01-01 in Excel serial days
    const dt = new Date(ms);
    y = dt.getUTCFullYear(); mo = dt.getUTCMonth() + 1; d = dt.getUTCDate();
    h = dt.getUTCHours(); mi = dt.getUTCMinutes(); s = dt.getUTCSeconds();
  } else {
    const str = String(cell ?? "").trim();
    if (!str) return null;
    let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      y = +m[1]; mo = +m[2]; d = +m[3]; h = +m[4]; mi = +m[5]; s = m[6] ? +m[6] : 0;
    } else {
      m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (!m) return null;
      d = +m[1]; mo = +m[2]; y = +m[3]; h = +m[4]; mi = +m[5]; s = m[6] ? +m[6] : 0;
    }
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || y < 2000 || y > 2100) return null;
  return {
    ms: bangkokToEpochMs(y, mo, d, h, mi, s),
    original: `${y}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(mi)}`,
    date: `${y}-${pad(mo)}-${pad(d)}`,
  };
}

/**
 * Grid → rows. Duplicate timestamps inside the file keep the FIRST occurrence (Ottai
 * exports newest-first, so "first" is the most recently written value for that slot).
 */
export function parseCgmGrid(rows: unknown[][], profileName: string): ParseResult {
  const empty: ParseResult = { ok: false, rows: [], rejected: [], unit: "mg/dL", header_row: -1, duplicates_in_file: 0 };
  if (!Array.isArray(rows) || rows.length === 0) return { ...empty, error: "ไฟล์ว่าง" };
  if (rows.length > MAX_ROWS) return { ...empty, error: `ไฟล์เกิน ${MAX_ROWS.toLocaleString()} แถว` };

  const hdr = findHeader(rows);
  if (!hdr) return { ...empty, error: 'หาคอลัมน์ "Time" และ "Glucose" ไม่พบใน 10 แถวแรก' };

  const out: CgmRow[] = [];
  const rejected: RejectedRow[] = [];
  const seen = new Set<number>();
  let dups = 0;

  for (let r = hdr.rowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === "")) continue;
    const t = coerceTime(row[hdr.timeCol]);
    if (!t) { rejected.push({ row: r + 1, reason: "อ่านเวลาไม่ได้", cells: [row[hdr.timeCol]] }); continue; }
    const g = coerceGlucose(row[hdr.glucoseCol], hdr.unit);
    if (g === null) { rejected.push({ row: r + 1, reason: "ค่าน้ำตาลไม่ใช่ตัวเลขในช่วง 10–700", cells: [row[hdr.glucoseCol]] }); continue; }
    if (seen.has(t.ms)) { dups++; continue; }
    seen.add(t.ms);
    out.push({ profile_name: profileName, original_time: t.original, reading_timestamp: t.ms, date_str: t.date, glucose: g });
  }

  if (out.length < MIN_READINGS) {
    return { ok: false, error: `อ่านได้แค่ ${out.length} ค่า (ต้องอย่างน้อย ${MIN_READINGS})`, rows: out, rejected, unit: hdr.unit, header_row: hdr.rowIdx + 1, duplicates_in_file: dups };
  }
  out.sort((a, b) => a.reading_timestamp - b.reading_timestamp);
  return { ok: true, rows: out, rejected, unit: hdr.unit, header_row: hdr.rowIdx + 1, duplicates_in_file: dups };
}

export interface ImportSummary {
  count: number;
  first: string | null;
  last: string | null;
  days: number;
  /** readings ÷ (days × 288) — a 5-minute sensor writes 288/day */
  completeness_pct: number;
}

export function summariseRows(rows: CgmRow[]): ImportSummary {
  if (rows.length === 0) return { count: 0, first: null, last: null, days: 0, completeness_pct: 0 };
  const first = rows[0], last = rows[rows.length - 1];
  const days = new Set(rows.map((r) => r.date_str)).size;
  const spanMin = (last.reading_timestamp - first.reading_timestamp) / 60_000;
  const expected = Math.max(1, Math.round(spanMin / 5) + 1);
  return {
    count: rows.length,
    first: first.original_time,
    last: last.original_time,
    days,
    completeness_pct: Math.min(100, Math.round((rows.length / expected) * 1000) / 10),
  };
}

/** Profile names are used as a join key across three tables — keep them tidy and bounded. */
export function normaliseProfileName(s: unknown): string | null {
  const v = String(s ?? "").trim().replace(/\s+/g, " ");
  if (!v || v.length > 80) return null;
  return v;
}
