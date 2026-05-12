/**
 * Master customer data — pulls latest values from all sources:
 *   - BCA measurements
 *   - CGM glucose readings
 *   - Pulse wearable readings (Google Fit)
 *   - Pulse intake (medications, conditions, goals)
 *
 * Returns aggregated structure with "as of" timestamps so AI can note staleness.
 */

interface DataPoint {
  value: any;
  unit?: string;
  as_of: string | null;
  days_stale: number | null;
  source: string;
}

export interface MasterSnapshot {
  customer: {
    name:       string;
    gender:     string | null;
    age:        number | null;
    height_cm:  number | null;
  };

  // ── Body composition (BCA + Inbody via Pulse) ──
  weight:           DataPoint | null;
  bmi:              DataPoint | null;
  body_fat_pct:     DataPoint | null;
  muscle_pct:       DataPoint | null;
  visceral_fat:     DataPoint | null;
  body_age:         DataPoint | null;
  bmr:              DataPoint | null;

  // ── Wearable (last 7 days, daily averages) ──
  hr_avg:               DataPoint | null;
  hr_resting:           DataPoint | null;
  hr_max:               DataPoint | null;
  hr_variability:       DataPoint | null;
  steps_avg:            DataPoint | null;
  active_minutes_avg:   DataPoint | null;
  heart_minutes_avg:    DataPoint | null;
  calories_expended:    DataPoint | null;
  sleep_hours:          DataPoint | null;
  sleep_deep:           DataPoint | null;
  sleep_rem:            DataPoint | null;

  // ── CGM (last 14 days if available) ──
  glucose_avg:          DataPoint | null;
  glucose_tir:          DataPoint | null;       // % in range 70-110
  glucose_max:          DataPoint | null;
  glucose_min:          DataPoint | null;
  glucose_gmi:          DataPoint | null;       // estimated HbA1c%

  // ── Intake (latest) ──
  medications:      string[];
  conditions:       string[];
  pregnant:         boolean;
  breastfeeding:    boolean;
  goal:             string | null;
  budget_range:     string | null;
  intake_as_of:     string | null;
}

function daysBetween(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

function point(value: any, unit: string, as_of: string | null, source: string): DataPoint | null {
  if (value == null) return null;
  return { value, unit, as_of, days_stale: daysBetween(as_of), source };
}

export interface BcaMeasurement {
  recorded_at: string;
  weight:      number | null;
  fat_pct:     number | null;
  visceral:    number | null;
  muscle_pct:  number | null;
  body_age:    number | null;
  bmr:         number | null;
}

export interface CgmReading {
  reading_timestamp: number; // epoch ms
  glucose: number;
}

export interface PulseReading {
  recorded_at: string;
  metric_type: string;
  value: number;
}

export interface PulseIntake {
  submitted_at:  string;
  medications:   string[];
  conditions:    string[];
  pregnant:      boolean;
  breastfeeding: boolean;
  goal:          string | null;
  budget_range:  string | null;
}

export interface BuildMasterInput {
  customer: { name: string; gender: string | null; birth_year: number | null; height: number | null };
  bca_history:    BcaMeasurement[];
  cgm_readings:   CgmReading[];      // last 14 days
  pulse_readings: PulseReading[];     // last 7 days
  pulse_intake:   PulseIntake | null;
}

export function buildMasterSnapshot(input: BuildMasterInput): MasterSnapshot {
  const { customer, bca_history, cgm_readings, pulse_readings, pulse_intake } = input;

  const age = customer.birth_year ? new Date().getFullYear() - customer.birth_year : null;

  // ── BCA: latest non-null per metric ──
  const latestBCA = (key: keyof BcaMeasurement, unit: string): DataPoint | null => {
    for (const m of bca_history) {
      const v = m[key];
      if (v != null) return point(v, unit, m.recorded_at, "BCA");
    }
    return null;
  };

  let weight   = latestBCA("weight",   "kg");
  let fat_pct  = latestBCA("fat_pct",  "%");
  const visceral = latestBCA("visceral", "lv");
  const muscle_pct = latestBCA("muscle_pct", "%");
  const body_age = latestBCA("body_age", "yr");
  const bmr_bca  = latestBCA("bmr",      "kcal");

  // ── Pulse readings: aggregate last 7 days per metric ──
  const pulseGroups: Record<string, { values: number[]; latestTs: string }> = {};
  let pulseLatest: string | null = null;
  for (const r of pulse_readings) {
    (pulseGroups[r.metric_type] ??= { values: [], latestTs: r.recorded_at }).values.push(r.value);
    if (!pulseLatest || r.recorded_at > pulseLatest) pulseLatest = r.recorded_at;
    if (r.recorded_at > pulseGroups[r.metric_type].latestTs)
      pulseGroups[r.metric_type].latestTs = r.recorded_at;
  }
  const avg = (arr?: number[]) => arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const pulseAvg = (key: string, unit: string) => {
    const g = pulseGroups[key];
    if (!g || g.values.length === 0) return null;
    return point(+avg(g.values)!.toFixed(1), unit, g.latestTs, "Google Fit");
  };

  // Fallback: weight + body_fat from Pulse if BCA not available
  if (!weight)  weight  = pulseAvg("weight", "kg");
  if (!fat_pct) fat_pct = pulseAvg("body_fat_pct", "%");

  const hr_avg    = pulseAvg("hr_bpm",  "bpm");
  const hr_resting= pulseAvg("rhr",     "bpm");
  const hr_max    = pulseAvg("hr_max",  "bpm");

  // HR variability proxy = max - avg
  const hr_var: DataPoint | null = (hr_max && hr_avg && typeof hr_max.value === "number" && typeof hr_avg.value === "number")
    ? point(+(hr_max.value - hr_avg.value).toFixed(1), "bpm", hr_avg.as_of, "Google Fit")
    : null;

  const steps_avg            = pulseAvg("steps", "steps/day");
  const active_minutes_avg   = pulseAvg("active_minutes", "min/day");
  const heart_minutes_avg    = pulseAvg("heart_minutes",  "min/day");
  const calories_expended    = pulseAvg("calories_expended", "kcal/day");
  const sleep_hours_min      = pulseGroups.sleep_total ?? pulseGroups.sleep_minutes;
  const sleep_hours          = sleep_hours_min
    ? point(+(avg(sleep_hours_min.values)! / 60).toFixed(1), "hr", sleep_hours_min.latestTs, "Google Fit")
    : null;
  const sleep_deep = pulseGroups.sleep_deep
    ? point(+(avg(pulseGroups.sleep_deep.values)! / 60).toFixed(1), "hr", pulseGroups.sleep_deep.latestTs, "Google Fit")
    : null;
  const sleep_rem = pulseGroups.sleep_rem
    ? point(+(avg(pulseGroups.sleep_rem.values)! / 60).toFixed(1), "hr", pulseGroups.sleep_rem.latestTs, "Google Fit")
    : null;

  // BMI derived
  let bmi: DataPoint | null = null;
  if (weight && customer.height && typeof weight.value === "number") {
    const m = customer.height / 100;
    bmi = point(+(weight.value / (m * m)).toFixed(1), "", weight.as_of, "derived");
  }

  // ── CGM stats (last 14 days) ──
  let glucose_avg: DataPoint | null = null;
  let glucose_tir: DataPoint | null = null;
  let glucose_max: DataPoint | null = null;
  let glucose_min: DataPoint | null = null;
  let glucose_gmi: DataPoint | null = null;

  if (cgm_readings.length > 0) {
    const vals = cgm_readings.map((r) => r.glucose);
    const sum = vals.reduce((a, b) => a + b, 0);
    const gAvg = sum / vals.length;
    const inRange = vals.filter((v) => v >= 70 && v <= 110).length;
    const latestTs = new Date(Math.max(...cgm_readings.map((r) => r.reading_timestamp))).toISOString();
    glucose_avg = point(+gAvg.toFixed(0), "mg/dL", latestTs, "CGM");
    glucose_tir = point(+((inRange / vals.length) * 100).toFixed(1), "%",      latestTs, "CGM");
    glucose_max = point(Math.max(...vals),                          "mg/dL", latestTs, "CGM");
    glucose_min = point(Math.min(...vals),                          "mg/dL", latestTs, "CGM");
    glucose_gmi = point(+(3.31 + 0.02392 * gAvg).toFixed(2),        "%",     latestTs, "CGM derived");
  }

  return {
    customer: {
      name:      customer.name,
      gender:    customer.gender,
      age,
      height_cm: customer.height,
    },
    weight, bmi, body_fat_pct: fat_pct, muscle_pct, visceral_fat: visceral, body_age, bmr: bmr_bca,
    hr_avg, hr_resting, hr_max, hr_variability: hr_var,
    steps_avg, active_minutes_avg, heart_minutes_avg, calories_expended,
    sleep_hours, sleep_deep, sleep_rem,
    glucose_avg, glucose_tir, glucose_max, glucose_min, glucose_gmi,
    medications:  pulse_intake?.medications ?? [],
    conditions:   pulse_intake?.conditions  ?? [],
    pregnant:     pulse_intake?.pregnant    ?? false,
    breastfeeding:pulse_intake?.breastfeeding ?? false,
    goal:         pulse_intake?.goal        ?? null,
    budget_range: pulse_intake?.budget_range ?? null,
    intake_as_of: pulse_intake?.submitted_at ?? null,
  };
}
