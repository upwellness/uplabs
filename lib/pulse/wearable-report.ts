/**
 * Unified Wearable Report model.
 *
 * Merges every wearable source (WHOOP CSV/OAuth, Google Fit, future devices)
 * into ONE common daily series + a source-agnostic metric registry. Any metric
 * that has no data is simply absent from `availableMetrics`, so the report UI
 * renders only the charts that exist — no empty panels.
 *
 * Add a new source by:
 *   1. mapping its rows into UnifiedDaily (a column per metric key), and
 *   2. (if it introduces a new metric) adding a METRIC_REGISTRY entry.
 */

/* ───────────────────────── metric registry ───────────────────────── */

export type ChartKind = "line" | "bar" | "sleepStacked";

export interface MetricDef {
  key: string;
  label: string;
  unit: string;
  color: string;
  kind: ChartKind;
  /** higher value is better? (for trend arrow direction) */
  higherBetter?: boolean;
  /** reference lines drawn on the chart */
  refs?: { value: number; label: string; tone: "good" | "warn" }[];
  /** recovery-style background zones (optional) */
  zones?: { min: number; max: number; color: string }[];
  /** decimal places for displayed averages */
  digits?: number;
  /** group heading in the report */
  group: "recovery" | "sleep" | "activity" | "body";
}

// uplabs brand tokens
const C = {
  rose: "#8C4C4C", wellness: "#396755", science: "#2A7B8F", amber: "#C47A2A",
  ink: "#18151A", purple: "#6366F1", violet: "#A78BFA", teal: "#0D9488",
  green: "#16A34A", red: "#DC2626", sky: "#0EA5E9", indigo: "#4F46E5",
};

export const METRIC_REGISTRY: Record<string, MetricDef> = {
  // ── recovery / cardiovascular ──
  recovery: {
    key: "recovery", label: "Recovery", unit: "%", color: C.wellness, kind: "line",
    higherBetter: true, group: "recovery",
    zones: [
      { min: 67, max: 100, color: "rgba(22,163,74,.06)" },
      { min: 34, max: 67, color: "rgba(196,122,42,.05)" },
      { min: 0, max: 34, color: "rgba(220,38,38,.06)" },
    ],
    refs: [{ value: 67, label: "ดี", tone: "good" }, { value: 34, label: "ต่ำ", tone: "warn" }],
  },
  hrv: {
    key: "hrv", label: "HRV (ความแปรปรวนหัวใจ)", unit: "ms", color: C.science, kind: "line",
    higherBetter: true, group: "recovery",
  },
  rhr: {
    key: "rhr", label: "Resting HR (ชีพจรพัก)", unit: "bpm", color: C.rose, kind: "line",
    higherBetter: false, group: "recovery",
  },
  hr_avg: {
    key: "hr_avg", label: "Heart Rate (เฉลี่ย)", unit: "bpm", color: C.red, kind: "line",
    group: "recovery",
  },
  spo2: {
    key: "spo2", label: "SpO₂ (ออกซิเจนในเลือด)", unit: "%", color: C.science, kind: "line",
    higherBetter: true, group: "recovery", digits: 1,
    refs: [{ value: 95, label: "ปกติ 95%+", tone: "good" }, { value: 93, label: "เกณฑ์ 93%", tone: "warn" }],
    zones: [{ min: 80, max: 93, color: "rgba(220,38,38,.06)" }],
  },
  skin_temp: {
    key: "skin_temp", label: "Skin Temp (อุณหภูมิผิว)", unit: "°C", color: C.amber, kind: "line",
    group: "recovery", digits: 1,
  },
  resp_rate: {
    key: "resp_rate", label: "Respiratory Rate (อัตราหายใจ)", unit: "rpm", color: C.teal, kind: "line",
    group: "recovery", digits: 1,
  },

  // ── sleep ──
  sleep_perf: {
    key: "sleep_perf", label: "Sleep Performance (คุณภาพการนอน)", unit: "%", color: C.purple, kind: "line",
    higherBetter: true, group: "sleep",
    refs: [{ value: 85, label: "เป้า 85%", tone: "good" }],
  },
  sleep_stages: {
    key: "sleep_stages", label: "Sleep Stages (หลับลึก · REM · ตื้น)", unit: "ชม.", color: C.purple, kind: "sleepStacked",
    group: "sleep",
    refs: [{ value: 7, label: "7 ชม.", tone: "good" }],
  },
  sleep_eff: {
    key: "sleep_eff", label: "Sleep Efficiency (ประสิทธิภาพ)", unit: "%", color: C.indigo, kind: "line",
    higherBetter: true, group: "sleep",
  },

  // ── activity ──
  strain: {
    key: "strain", label: "Day Strain (ความเหนื่อยล้า)", unit: "", color: C.amber, kind: "bar",
    group: "activity", digits: 1,
  },
  steps: {
    key: "steps", label: "Steps (ก้าว/วัน)", unit: "", color: C.sky, kind: "bar",
    higherBetter: true, group: "activity",
    refs: [{ value: 10000, label: "10k", tone: "good" }],
  },
  active_minutes: {
    key: "active_minutes", label: "Active Minutes", unit: "min", color: C.green, kind: "bar",
    higherBetter: true, group: "activity",
    refs: [{ value: 30, label: "30 min", tone: "good" }],
  },
  calories: {
    key: "calories", label: "Calories Burned", unit: "kcal", color: C.amber, kind: "bar",
    group: "activity",
  },

  // ── body ──
  weight: {
    key: "weight", label: "น้ำหนัก", unit: "kg", color: C.sky, kind: "line", group: "body", digits: 1,
  },
  body_fat: {
    key: "body_fat", label: "Body Fat %", unit: "%", color: C.amber, kind: "line",
    higherBetter: false, group: "body", digits: 1,
  },
};

/* ───────────────────────── unified daily ───────────────────────── */

export interface UnifiedDaily {
  date: string;            // YYYY-MM-DD
  recovery?: number | null;
  hrv?: number | null;
  rhr?: number | null;
  hr_avg?: number | null;
  spo2?: number | null;
  skin_temp?: number | null;
  resp_rate?: number | null;
  sleep_perf?: number | null;
  sleep_eff?: number | null;
  // sleep stages (minutes)
  deep_min?: number | null;
  rem_min?: number | null;
  light_min?: number | null;
  asleep_min?: number | null;
  strain?: number | null;
  steps?: number | null;
  active_minutes?: number | null;
  calories?: number | null;
  weight?: number | null;
  body_fat?: number | null;
}

export interface WhoopDailyRow {
  cycle_date: string;
  recovery: number | null; rhr: number | null; hrv: number | null; spo2: number | null;
  skin_temp: number | null; strain: number | null; sleep_perf: number | null; resp_rate: number | null;
  asleep_min: number | null; deep_min: number | null; rem_min: number | null; light_min: number | null;
  sleep_eff: number | null;
}

export interface PulseReadingRow {
  metric_type: string; value: number; recorded_at: string;
}

/* ───────────────────────── aggregation ───────────────────────── */

export interface MetricSummary {
  def: MetricDef;
  latest: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
  windowDays: number;
}

export interface WearableReport {
  series: UnifiedDaily[];          // chronological
  dateStart: string | null;
  dateEnd: string | null;
  days: number;
  sources: string[];               // ["WHOOP", "Google Fit"]
  available: string[];             // metric keys that have ≥1 value
  summaries: Record<string, MetricSummary>;
}

const dayOf = (iso: string) => (iso || "").split("T")[0].split(" ")[0];

/** Merge WHOOP daily + pulse_readings (Google Fit / Apple Health) into one series. */
export function buildWearableReport(opts: {
  whoop?: WhoopDailyRow[];
  pulseReadings?: PulseReadingRow[];
  /** label for the pulse_readings source (e.g. "Apple Watch", "Google Fit") */
  pulseSource?: string;
}): WearableReport {
  const srcLabel = opts.pulseSource ?? "Google Fit";
  const byDate = new Map<string, UnifiedDaily>();
  const ensure = (d: string) => {
    if (!byDate.has(d)) byDate.set(d, { date: d });
    return byDate.get(d)!;
  };
  const sources = new Set<string>();

  // WHOOP
  for (const w of opts.whoop ?? []) {
    const d = ensure(w.cycle_date);
    d.recovery = w.recovery; d.rhr = w.rhr; d.hrv = w.hrv; d.spo2 = w.spo2;
    d.skin_temp = w.skin_temp; d.strain = w.strain; d.sleep_perf = w.sleep_perf;
    d.resp_rate = w.resp_rate; d.asleep_min = w.asleep_min; d.deep_min = w.deep_min;
    d.rem_min = w.rem_min; d.light_min = w.light_min; d.sleep_eff = w.sleep_eff;
    if (w.recovery != null || w.hrv != null || w.spo2 != null) sources.add("WHOOP");
  }

  // Google Fit (pulse_readings) — pivot metric_type → column, daily
  const gfBucket = new Map<string, Record<string, number[]>>();
  for (const r of opts.pulseReadings ?? []) {
    const d = dayOf(r.recorded_at);
    if (!d) continue;
    if (!gfBucket.has(d)) gfBucket.set(d, {});
    const b = gfBucket.get(d)!;
    (b[r.metric_type] ??= []).push(Number(r.value));
  }
  for (const [d, metrics] of gfBucket) {
    const row = ensure(d);
    const avg = (a?: number[]) => (a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : undefined);
    const sum = (a?: number[]) => (a && a.length ? a.reduce((x, y) => x + y, 0) : undefined);
    if (metrics.rhr && row.rhr == null) row.rhr = avg(metrics.rhr) ?? null;
    if (metrics.hr_bpm && row.hr_avg == null) row.hr_avg = avg(metrics.hr_bpm) ?? null;
    // Apple HRV = SDNN (ms) · only used if WHOOP RMSSD absent
    if (metrics.hrv && row.hrv == null) row.hrv = avg(metrics.hrv) ?? null;
    if (metrics.spo2 && row.spo2 == null) row.spo2 = avg(metrics.spo2) ?? null;
    if (metrics.resp_rate && row.resp_rate == null) row.resp_rate = avg(metrics.resp_rate) ?? null;
    if (metrics.skin_temp && row.skin_temp == null) row.skin_temp = avg(metrics.skin_temp) ?? null;
    if (metrics.steps) row.steps = sum(metrics.steps) ?? null;
    if (metrics.active_minutes) row.active_minutes = sum(metrics.active_minutes) ?? null;
    if (metrics.calories_expended) row.calories = sum(metrics.calories_expended) ?? null;
    if (metrics.weight) row.weight = avg(metrics.weight) ?? null;
    if (metrics.body_fat_pct) row.body_fat = avg(metrics.body_fat_pct) ?? null;
    if (metrics.sleep_total && row.asleep_min == null) row.asleep_min = sum(metrics.sleep_total) ?? null;
    if (metrics.sleep_deep && row.deep_min == null) row.deep_min = sum(metrics.sleep_deep) ?? null;
    if (metrics.sleep_rem && row.rem_min == null) row.rem_min = sum(metrics.sleep_rem) ?? null;
    if (metrics.sleep_light && row.light_min == null) row.light_min = sum(metrics.sleep_light) ?? null;
    if (Object.keys(metrics).length) sources.add(srcLabel);
  }

  const series = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  // availability + summaries
  const has = (pred: (d: UnifiedDaily) => boolean) => series.some(pred);
  const availabilityChecks: Record<string, (d: UnifiedDaily) => boolean> = {
    recovery: (d) => d.recovery != null,
    hrv: (d) => d.hrv != null,
    rhr: (d) => d.rhr != null,
    hr_avg: (d) => d.hr_avg != null,
    spo2: (d) => d.spo2 != null,
    skin_temp: (d) => d.skin_temp != null,
    resp_rate: (d) => d.resp_rate != null,
    sleep_perf: (d) => d.sleep_perf != null,
    sleep_eff: (d) => d.sleep_eff != null,
    sleep_stages: (d) => d.deep_min != null || d.rem_min != null || d.light_min != null,
    strain: (d) => d.strain != null,
    steps: (d) => (d.steps ?? 0) > 0,
    active_minutes: (d) => (d.active_minutes ?? 0) > 0,
    calories: (d) => (d.calories ?? 0) > 0,
    weight: (d) => d.weight != null,
    body_fat: (d) => d.body_fat != null,
  };
  const available = Object.keys(availabilityChecks).filter((k) => has(availabilityChecks[k]));

  // per-metric summary (latest + rolling 30-day avg/min/max)
  const window = series.slice(-30);
  const colFor: Record<string, (d: UnifiedDaily) => number | null | undefined> = {
    recovery: (d) => d.recovery, hrv: (d) => d.hrv, rhr: (d) => d.rhr, hr_avg: (d) => d.hr_avg,
    spo2: (d) => d.spo2, skin_temp: (d) => d.skin_temp, resp_rate: (d) => d.resp_rate,
    sleep_perf: (d) => d.sleep_perf, sleep_eff: (d) => d.sleep_eff,
    sleep_stages: (d) => (d.asleep_min != null ? d.asleep_min / 60 : null),
    strain: (d) => d.strain, steps: (d) => d.steps, active_minutes: (d) => d.active_minutes,
    calories: (d) => d.calories, weight: (d) => d.weight, body_fat: (d) => d.body_fat,
  };
  const summaries: Record<string, MetricSummary> = {};
  for (const key of available) {
    const def = METRIC_REGISTRY[key];
    if (!def) continue;
    const getv = colFor[key];
    const vals = window.map(getv).filter((v): v is number => typeof v === "number");
    const latestRow = [...series].reverse().find((d) => typeof getv(d) === "number");
    summaries[key] = {
      def,
      latest: latestRow ? (getv(latestRow) as number) : null,
      avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
      min: vals.length ? Math.min(...vals) : null,
      max: vals.length ? Math.max(...vals) : null,
      windowDays: window.length,
    };
  }

  return {
    series,
    dateStart: series[0]?.date ?? null,
    dateEnd: series[series.length - 1]?.date ?? null,
    days: series.length,
    sources: [...sources],
    available,
    summaries,
  };
}

/* ───────────────────────── lab trend ───────────────────────── */

export interface LabValueRow {
  category: string; metric_key: string; metric_label_th: string | null;
  value_num: number | null; unit: string | null; ref_low: number | null;
  ref_high: number | null; ref_text: string | null; status: string | null; recorded_at: string;
}

export interface LabMetricTrend {
  key: string; label: string; unit: string;
  points: { date: string; value: number; status: string | null }[];
  ref_low: number | null; ref_high: number | null; ref_text: string | null;
  latest: number | null; latestStatus: string | null;
}

/** Group lab values by metric_key into time series for trend charts. */
export function buildLabTrends(rows: LabValueRow[]): { byCategory: Record<string, LabMetricTrend[]>; dates: string[] } {
  const byKey = new Map<string, LabMetricTrend>();
  const dateSet = new Set<string>();
  for (const r of rows) {
    dateSet.add(r.recorded_at);
    if (!byKey.has(r.metric_key)) {
      byKey.set(r.metric_key, {
        key: r.metric_key, label: r.metric_label_th ?? r.metric_key, unit: r.unit ?? "",
        points: [], ref_low: r.ref_low, ref_high: r.ref_high, ref_text: r.ref_text,
        latest: null, latestStatus: null,
      });
    }
    const t = byKey.get(r.metric_key)!;
    if (r.value_num != null) t.points.push({ date: r.recorded_at, value: r.value_num, status: r.status });
  }
  const byCategory: Record<string, LabMetricTrend[]> = {};
  for (const r of rows) {
    const t = byKey.get(r.metric_key);
    if (!t) continue;
    t.points.sort((a, b) => a.date.localeCompare(b.date));
    const last = t.points[t.points.length - 1];
    t.latest = last?.value ?? null;
    t.latestStatus = last?.status ?? null;
    if (!byCategory[r.category]) byCategory[r.category] = [];
    if (!byCategory[r.category].some((x) => x.key === t.key)) byCategory[r.category].push(t);
  }
  return { byCategory, dates: [...dateSet].sort() };
}
