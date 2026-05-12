/**
 * CGM meal-response analysis.
 * Mirrors v1 algorithm: baseline → 3h window → peak/lag/delta/hourly samples → curve shape.
 */
import type { CGMReading, CGMMeal } from "./types-cgm";

export interface MealWindowPoint {
  relativeMin: number;   // minutes after meal start (0-180)
  glucose: number;
}

export type CurveShape = "FastRiseFall" | "FastRiseSlowFall" | "SlowRiseSlowFall" | "Steady";
export type Grade = "A" | "B" | "C";

export interface AnalyzedMeal extends CGMMeal {
  valid: boolean;
  baseline: number | null;
  peak: number | null;
  peakAt: number | null;       // epoch ms of peak
  lagMins: number | null;      // minutes from meal to peak
  delta: number | null;        // peak - baseline
  hr1: number | null;
  hr2: number | null;
  hr3: number | null;
  score: number;
  grade: Grade;
  curveShape: CurveShape;
  windowData: MealWindowPoint[];
}

/** Find reading closest to a target timestamp within tolerance */
function readingAt(readings: CGMReading[], targetTs: number, toleranceMs = 15 * 60 * 1000): number | null {
  let best: CGMReading | null = null;
  let bestDiff = Infinity;
  for (const r of readings) {
    const diff = Math.abs(r.reading_timestamp - targetTs);
    if (diff <= toleranceMs && diff < bestDiff) {
      best = r;
      bestDiff = diff;
    }
  }
  return best?.glucose ?? null;
}

export function analyzeMeals(readings: CGMReading[], meals: CGMMeal[]): AnalyzedMeal[] {
  if (readings.length === 0) return meals.map((m) => emptyAnalyzed(m));

  const sorted = [...readings].sort((a, b) => a.reading_timestamp - b.reading_timestamp);

  return meals.map((m) => {
    // Baseline = last reading before meal
    const beforeMeal = sorted.filter((r) => r.reading_timestamp <= m.meal_timestamp);
    const baseline = beforeMeal.length > 0 ? beforeMeal[beforeMeal.length - 1].glucose : null;

    // 3h window after meal
    const windowEnd = m.meal_timestamp + 3 * 60 * 60 * 1000;
    const windowReadings = sorted.filter(
      (r) => r.reading_timestamp >= m.meal_timestamp && r.reading_timestamp <= windowEnd,
    );

    if (windowReadings.length === 0 || baseline == null) {
      return emptyAnalyzed(m);
    }

    // Peak
    let peak = windowReadings[0];
    for (const r of windowReadings) if (r.glucose > peak.glucose) peak = r;

    const lagMins = Math.round((peak.reading_timestamp - m.meal_timestamp) / 60000);
    const delta   = peak.glucose - baseline;

    const hr1 = readingAt(sorted, m.meal_timestamp + 1 * 3600000);
    const hr2 = readingAt(sorted, m.meal_timestamp + 2 * 3600000);
    const hr3 = readingAt(sorted, m.meal_timestamp + 3 * 3600000);

    // Score (mirrors v1)
    let score = 100;
    if (delta > 30) score -= (delta - 30);
    if (lagMins > 60) score -= 10;
    if (hr2 != null && hr2 > baseline + 20) score -= 15;
    if (hr3 != null && hr3 > baseline + 10) score -= 15;
    score = Math.max(0, Math.min(100, Math.round(score)));
    const grade: Grade = score >= 85 ? "A" : score >= 60 ? "B" : "C";

    // Curve shape
    const isFastRise = lagMins <= 50;
    const isFastFall = hr2 != null && hr2 <= baseline + 15;
    let curveShape: CurveShape;
    if (isFastRise && isFastFall) curveShape = "FastRiseFall";
    else if (isFastRise && !isFastFall) curveShape = "FastRiseSlowFall";
    else if (!isFastRise && !isFastFall) curveShape = "SlowRiseSlowFall";
    else curveShape = "Steady";

    const windowData: MealWindowPoint[] = windowReadings.map((r) => ({
      relativeMin: Math.round((r.reading_timestamp - m.meal_timestamp) / 60000),
      glucose: r.glucose,
    }));

    return {
      ...m,
      valid: true,
      baseline,
      peak: peak.glucose,
      peakAt: peak.reading_timestamp,
      lagMins,
      delta,
      hr1, hr2, hr3,
      score, grade,
      curveShape,
      windowData,
    };
  });
}

function emptyAnalyzed(m: CGMMeal): AnalyzedMeal {
  return {
    ...m, valid: false,
    baseline: null, peak: null, peakAt: null, lagMins: null, delta: null,
    hr1: null, hr2: null, hr3: null,
    score: 0, grade: "C", curveShape: "Steady", windowData: [],
  };
}

export const CURVE_LABEL: Record<CurveShape, { th: string; tone: "good" | "warn" | "danger" | "neutral" }> = {
  FastRiseFall:     { th: "ขึ้นเร็ว ลงเร็ว (Metabolic Flexible)",            tone: "good" },
  FastRiseSlowFall: { th: "ขึ้นเร็ว ลงช้า (Insulin Load)",                  tone: "warn" },
  SlowRiseSlowFall: { th: "ขึ้นช้า ลงช้า (Sluggish)",                       tone: "danger" },
  Steady:           { th: "นิ่ง (Steady) — มื้อ low-impact",               tone: "neutral" },
};

export const COMPARE_COLORS = ["#14B8A6", "#F43F5E", "#8B5CF6", "#F59E0B", "#0EA5E9", "#84CC16"];
