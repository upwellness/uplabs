/**
 * Google Health API v4 → pulse_readings rows. Pure; tested in tests/google-health.test.mts.
 *
 * Google Fit's REST API is switched off at the end of 2026 with no drop-in successor.
 * The cloud-side replacement is the Google Health API (data from Fitbit devices and
 * Pixel Watch, tied to the Google account; Health Connect on-device data is NOT
 * reachable from a server). Shapes below follow the published REST reference:
 *   dailyRollUp  → { rollupDataPoints: [{ civilStartTime, civilEndTime, value: { steps: { countSum } } }] }
 *   list         → { dataPoints: [{ dailyRestingHeartRate: { date, beatsPerMinute } }
 *                                 | { dailyHeartRateVariability: { date, averageHeartRateVariabilityMilliseconds } }
 *                                 | { sleep: { interval: { civilStartTime, civilEndTime }, summary: { minutesAsleep, minutesAwake } } } ] }
 * Every value is read defensively (snake_case twins accepted) — Google's JSON casing
 * has changed between previews, and a parse miss must surface as "no data", not a crash.
 */

export interface ReadingRow { recorded_at: string; metric_type: "steps" | "rhr" | "hrv_rmssd" | "sleep_minutes" | "active_minutes"; value: number; unit: string; source_data?: unknown }

type CivilDate = { year: number; month: number; day: number };
const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: CivilDate | undefined | null) => (d && d.year && d.month && d.day ? `${d.year}-${pad(d.month)}-${pad(d.day)}` : null);
const num = (v: unknown): number | null => { const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN; return Number.isFinite(n) ? n : null; };
const g = (o: any, ...keys: string[]) => { for (const k of keys) if (o && o[k] !== undefined) return o[k]; return undefined; };

/** Civil date of a CivilDateTime {date:{…}, time?:{…}} (snake or camel). */
const civilDate = (c: any): string | null => isoDate(g(c, "date"));

/** Bangkok-local noon as the reading instant for a daily value (keeps the day stable across zones). */
const dayInstant = (date: string) => `${date}T05:00:00.000Z`; // 12:00 Asia/Bangkok

/** dailyRollUp for `steps` (countSum) or `active-minutes` (sum of per-level minutes). */
export function parseDailyRollup(json: unknown, metric: "steps" | "active_minutes"): ReadingRow[] {
  const pts: any[] = g(json as any, "rollupDataPoints", "rollup_data_points") ?? [];
  const out: ReadingRow[] = [];
  for (const p of pts) {
    const date = civilDate(g(p, "civilStartTime", "civil_start_time"));
    if (!date) continue;
    const v = g(p, "value") ?? p;
    let value: number | null = null;
    if (metric === "steps") value = num(g(g(v, "steps") ?? v, "countSum", "count_sum"));
    else {
      const levels: any[] = g(g(v, "activeMinutes", "active_minutes") ?? v, "activeMinutesRollupByActivityLevel", "active_minutes_rollup_by_activity_level") ?? [];
      const sum = levels.reduce((a, l) => a + (num(g(l, "minutes", "activeMinutes", "active_minutes")) ?? 0), 0);
      value = levels.length ? sum : null;
    }
    if (value == null) continue;
    out.push({ recorded_at: dayInstant(date), metric_type: metric, value, unit: metric === "steps" ? "count" : "min" });
  }
  return out;
}

/** dataPoints.list for the daily types and sleep sessions. */
export function parseDataPoints(json: unknown, kind: "daily-resting-heart-rate" | "daily-heart-rate-variability" | "sleep"): ReadingRow[] {
  const pts: any[] = g(json as any, "dataPoints", "data_points") ?? [];
  const out: ReadingRow[] = [];
  for (const p of pts) {
    if (kind === "daily-resting-heart-rate") {
      const d = g(p, "dailyRestingHeartRate", "daily_resting_heart_rate") ?? p;
      const date = isoDate(g(d, "date")); const bpm = num(g(d, "beatsPerMinute", "beats_per_minute"));
      if (date && bpm != null) out.push({ recorded_at: dayInstant(date), metric_type: "rhr", value: bpm, unit: "bpm" });
    } else if (kind === "daily-heart-rate-variability") {
      const d = g(p, "dailyHeartRateVariability", "daily_heart_rate_variability") ?? p;
      const date = isoDate(g(d, "date")); const ms = num(g(d, "averageHeartRateVariabilityMilliseconds", "average_heart_rate_variability_milliseconds"));
      if (date && ms != null) out.push({ recorded_at: dayInstant(date), metric_type: "hrv_rmssd", value: Math.round(ms * 10) / 10, unit: "ms" });
    } else {
      const s = g(p, "sleep") ?? p;
      const end = civilDate(g(g(s, "interval") ?? {}, "civilEndTime", "civil_end_time"));
      const mins = num(g(g(s, "summary") ?? {}, "minutesAsleep", "minutes_asleep"));
      if (end && mins != null && mins > 0) out.push({ recorded_at: dayInstant(end), metric_type: "sleep_minutes", value: mins, unit: "min", source_data: { minutes_awake: num(g(g(s, "summary") ?? {}, "minutesAwake", "minutes_awake")) } });
    }
  }
  return out;
}

/** Several sleep sessions ending on the same civil day (naps) → one total per day. */
export function mergeSleepByDay(rows: ReadingRow[]): ReadingRow[] {
  const by = new Map<string, ReadingRow>();
  for (const r of rows) {
    if (r.metric_type !== "sleep_minutes") { by.set(`${r.metric_type}|${r.recorded_at}`, r); continue; }
    const k = `sleep|${r.recorded_at}`; const cur = by.get(k);
    by.set(k, cur ? { ...cur, value: cur.value + r.value } : r);
  }
  return [...by.values()];
}

/** Request body for dailyRollUp over [from, to) civil dates, one-day windows. */
/**
 * dailyRollUp body, shaped exactly like Google's worked example (filters guide): explicit
 * midnight `time` on both ends, closed-open range. Omitting `time` is documented as
 * "defaults to midnight" but the live API answered INVALID_ARGUMENT (13 Sep 2026).
 */
export function rollupBody(fromDate: string, toDate: string) {
  const d = (s: string): CivilDate => ({ year: Number(s.slice(0, 4)), month: Number(s.slice(5, 7)), day: Number(s.slice(8, 10)) });
  const midnight = { hours: 0, minutes: 0, seconds: 0, nanos: 0 };
  return { range: { start: { date: d(fromDate), time: midnight }, end: { date: d(toDate), time: midnight } }, windowSizeDays: 1 };
}

/** list filter for a daily type / sleep since a civil date. Field paths are snake_case per the docs. */
export function listFilter(kind: "daily-resting-heart-rate" | "daily-heart-rate-variability" | "sleep", fromDate: string): string {
  if (kind === "sleep") return `sleep.interval.civil_end_time >= "${fromDate}T00:00:00"`;
  const field = kind === "daily-resting-heart-rate" ? "daily_resting_heart_rate.date" : "daily_heart_rate_variability.date";
  return `${field} >= "${fromDate}"`;
}
