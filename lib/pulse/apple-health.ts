/**
 * Apple Health export parser.
 *
 * Apple Watch / iPhone HealthKit data has NO server-side API — it lives
 * on-device. The user exports it via Health app → Export All Health Data,
 * producing export.zip → apple_health_export/export.xml (can be 50-500MB).
 *
 * Because the file is huge, parsing runs CLIENT-SIDE (in the browser) and
 * only the compact daily summary is POSTed to the server. This module is
 * isomorphic (no DOM/Node deps) so it can run in the AppleImport component.
 *
 * HRV NOTE: Apple reports HRV as SDNN (ms) — a different metric from WHOOP/
 * Oura RMSSD. We store it as `hrv_sdnn` and label it accordingly; never mix
 * the two on one axis.
 */

export interface AppleDaily {
  date: string;              // YYYY-MM-DD
  rhr: number | null;        // resting heart rate (bpm) · avg
  hrv_sdnn: number | null;   // HRV SDNN (ms) · avg
  hr_avg: number | null;     // heart rate (bpm) · avg
  spo2: number | null;       // blood oxygen (%) · avg
  resp_rate: number | null;  // respiratory rate (rpm) · avg
  skin_temp: number | null;  // sleeping wrist temp (°C) · avg
  steps: number | null;      // count · sum
  active_minutes: number | null; // exercise time (min) · sum
  calories: number | null;   // active energy (kcal) · sum
  deep_min: number | null;
  rem_min: number | null;
  light_min: number | null;  // core
  awake_min: number | null;
  asleep_min: number | null; // deep+rem+light
  weight: number | null;     // kg · latest
  body_fat: number | null;   // % · latest
}

/* ── HealthKit identifier → our metric bucket ── */
const QTY: Record<string, { key: keyof AppleDaily; agg: "avg" | "sum" | "last"; scale?: (v: number) => number }> = {
  HKQuantityTypeIdentifierRestingHeartRate:          { key: "rhr", agg: "avg" },
  HKQuantityTypeIdentifierHeartRate:                 { key: "hr_avg", agg: "avg" },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN:  { key: "hrv_sdnn", agg: "avg" },
  HKQuantityTypeIdentifierOxygenSaturation:          { key: "spo2", agg: "avg", scale: (v) => (v <= 1 ? v * 100 : v) },
  HKQuantityTypeIdentifierRespiratoryRate:           { key: "resp_rate", agg: "avg" },
  HKQuantityTypeIdentifierAppleSleepingWristTemperature: { key: "skin_temp", agg: "avg" },
  HKQuantityTypeIdentifierStepCount:                 { key: "steps", agg: "sum" },
  HKQuantityTypeIdentifierActiveEnergyBurned:        { key: "calories", agg: "sum" },
  HKQuantityTypeIdentifierAppleExerciseTime:         { key: "active_minutes", agg: "sum" },
  HKQuantityTypeIdentifierBodyMass:                  { key: "weight", agg: "last" },
  HKQuantityTypeIdentifierBodyFatPercentage:         { key: "body_fat", agg: "last", scale: (v) => (v <= 1 ? v * 100 : v) },
};

// Sleep category value → stage bucket (minutes)
const SLEEP_STAGE: Record<string, keyof AppleDaily> = {
  HKCategoryValueSleepAnalysisAsleepDeep:        "deep_min",
  HKCategoryValueSleepAnalysisAsleepREM:         "rem_min",
  HKCategoryValueSleepAnalysisAsleepCore:        "light_min",
  HKCategoryValueSleepAnalysisAsleepUnspecified: "light_min",
  HKCategoryValueSleepAnalysisAwake:             "awake_min",
};

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}
function dateOf(s: string | null): string | null {
  if (!s) return null;
  const d = s.trim().slice(0, 10); // "2026-06-14 08:00:00 +0700" → "2026-06-14"
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}
function minutesBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const s = Date.parse(start.replace(" ", "T").replace(/\s*([+-]\d{4})$/, "$1"));
  const e = Date.parse(end.replace(" ", "T").replace(/\s*([+-]\d{4})$/, "$1"));
  if (isNaN(s) || isNaN(e) || e <= s) return 0;
  return Math.round((e - s) / 60000);
}

interface Acc { sums: Record<string, number>; counts: Record<string, number>; lasts: Record<string, number>; }
function blankAcc(): Acc { return { sums: {}, counts: {}, lasts: {} }; }

/**
 * Parse the Apple Health export.xml text into daily aggregates.
 * Uses a streaming regex scan (no line-split) so it stays memory-safe on
 * 100MB+ files. onProgress is called with a 0-1 fraction periodically.
 */
export function parseAppleHealthXml(xml: string, onProgress?: (frac: number) => void): AppleDaily[] {
  const byDate = new Map<string, Acc>();
  const ensure = (d: string) => { if (!byDate.has(d)) byDate.set(d, blankAcc()); return byDate.get(d)!; };

  // Match each <Record ...> opening tag (attrs up to the first > or />)
  const re = /<Record\s+([^>]*?)\/?>/g;
  let m: RegExpExecArray | null;
  let i = 0;
  const total = xml.length;
  while ((m = re.exec(xml)) !== null) {
    const tag = m[1];
    if ((++i & 0x3fff) === 0 && onProgress) onProgress(Math.min(0.98, m.index / total));

    const type = attr(tag, "type");
    if (!type) continue;

    // ── Sleep analysis (category, duration-based) ──
    if (type === "HKCategoryTypeIdentifierSleepAnalysis") {
      const val = attr(tag, "value");
      const stage = val ? SLEEP_STAGE[val] : null;
      if (!stage) continue;
      const start = attr(tag, "startDate"), end = attr(tag, "endDate");
      const mins = minutesBetween(start, end);
      if (mins <= 0) continue;
      // attribute sleep to the WAKE date (end)
      const d = dateOf(end) ?? dateOf(start);
      if (!d) continue;
      const a = ensure(d);
      a.sums[stage] = (a.sums[stage] ?? 0) + mins;
      continue;
    }

    // ── Quantity types ──
    const def = QTY[type];
    if (!def) continue;
    const rawVal = attr(tag, "value");
    if (rawVal == null) continue;
    let v = Number(rawVal);
    if (!isFinite(v)) continue;
    if (def.scale) v = def.scale(v);
    const d = dateOf(attr(tag, "startDate"));
    if (!d) continue;
    const a = ensure(d);
    const k = def.key as string;
    if (def.agg === "sum") {
      a.sums[k] = (a.sums[k] ?? 0) + v;
    } else if (def.agg === "avg") {
      a.sums[k] = (a.sums[k] ?? 0) + v;
      a.counts[k] = (a.counts[k] ?? 0) + 1;
    } else {
      a.lasts[k] = v; // last seen wins (records are roughly chronological)
    }
  }
  if (onProgress) onProgress(1);

  const out: AppleDaily[] = [];
  for (const [date, a] of byDate) {
    const avg = (k: string) => (a.counts[k] ? +(a.sums[k] / a.counts[k]).toFixed(1) : null);
    const sum = (k: string) => (a.sums[k] != null ? Math.round(a.sums[k]) : null);
    const last = (k: string) => (a.lasts[k] != null ? +a.lasts[k].toFixed(1) : null);
    const deep = sum("deep_min"), rem = sum("rem_min"), light = sum("light_min");
    const asleep = (deep ?? 0) + (rem ?? 0) + (light ?? 0);
    out.push({
      date,
      rhr: avg("rhr"), hrv_sdnn: avg("hrv_sdnn"), hr_avg: avg("hr_avg"),
      spo2: avg("spo2"), resp_rate: avg("resp_rate"), skin_temp: avg("skin_temp"),
      steps: sum("steps"), active_minutes: sum("active_minutes"), calories: sum("calories"),
      deep_min: deep, rem_min: rem, light_min: light, awake_min: sum("awake_min"),
      asleep_min: asleep > 0 ? asleep : null,
      weight: last("weight"), body_fat: last("body_fat"),
    });
  }
  out.sort((x, y) => x.date.localeCompare(y.date));
  // drop fully-empty days
  return out.filter((d) =>
    d.rhr != null || d.hrv_sdnn != null || d.hr_avg != null || d.spo2 != null ||
    d.steps != null || d.asleep_min != null || d.calories != null || d.active_minutes != null ||
    d.resp_rate != null || d.skin_temp != null || d.weight != null);
}

/** metric_type strings used when writing into pulse_readings */
export const APPLE_METRIC_MAP: { field: keyof AppleDaily; metric: string; unit: string }[] = [
  { field: "rhr",            metric: "rhr",               unit: "bpm" },
  { field: "hrv_sdnn",       metric: "hrv",               unit: "ms" },  // SDNN
  { field: "hr_avg",         metric: "hr_bpm",            unit: "bpm" },
  { field: "spo2",           metric: "spo2",              unit: "%" },
  { field: "resp_rate",      metric: "resp_rate",         unit: "rpm" },
  { field: "skin_temp",      metric: "skin_temp",         unit: "°C" },
  { field: "steps",          metric: "steps",             unit: "count" },
  { field: "active_minutes", metric: "active_minutes",    unit: "min" },
  { field: "calories",       metric: "calories_expended", unit: "kcal" },
  { field: "deep_min",       metric: "sleep_deep",        unit: "min" },
  { field: "rem_min",        metric: "sleep_rem",         unit: "min" },
  { field: "light_min",      metric: "sleep_light",       unit: "min" },
  { field: "asleep_min",     metric: "sleep_total",       unit: "min" },
  { field: "weight",         metric: "weight",            unit: "kg" },
  { field: "body_fat",       metric: "body_fat_pct",      unit: "%" },
];
