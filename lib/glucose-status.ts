/**
 * Glucose classification — clinical reference ranges.
 * Optimal 70-110, Acceptable 110-140, Low <70, High >140
 */
import type { GlucoseLevel, CGMReading, CGMStats } from "./types-cgm";
import { type StatusLevel } from "./medical-status";

export const GLUCOSE_RANGES = {
  optimal:    { min: 70,  max: 110 },
  acceptable: { min: 110, max: 140 },
  low:        70,
  high:       140,
};

export function classifyGlucose(value: number): GlucoseLevel {
  if (value < GLUCOSE_RANGES.low) return "low";
  if (value <= GLUCOSE_RANGES.optimal.max) return "optimal";
  if (value <= GLUCOSE_RANGES.acceptable.max) return "acceptable";
  return "high";
}

/** Map glucose level → unified StatusLevel for color coding */
export const glucoseToStatus: Record<GlucoseLevel, StatusLevel> = {
  low:        "warning",
  optimal:    "optimal",
  acceptable: "caution",
  high:       "danger",
};

export const glucoseColors: Record<GlucoseLevel, string> = {
  low:        "#F59E0B",  // amber (warning)
  optimal:    "#16A34A",  // green
  acceptable: "#EAB308",  // yellow
  high:       "#DC2626",  // red
};

/** Compute stats over a slice of readings. */
export function computeStats(readings: CGMReading[]): CGMStats | null {
  if (readings.length === 0) return null;

  const vals = readings.map((r) => r.glucose);
  const count = vals.length;
  const sum   = vals.reduce((a, b) => a + b, 0);
  const avg   = sum / count;
  const min   = Math.min(...vals);
  const max   = Math.max(...vals);
  const sqDiff = vals.reduce((a, v) => a + (v - avg) ** 2, 0);
  const stdDev = Math.sqrt(sqDiff / count);

  const inOptimal    = vals.filter((v) => v >= 70 && v <= 110).length;
  const inAcceptable = vals.filter((v) => v >= 70 && v <= 140).length;
  const low          = vals.filter((v) => v < 70).length;
  const high         = vals.filter((v) => v > 140).length;

  // GMI = 3.31 + 0.02392 * avg_mg/dL  (ADA formula → estimated HbA1c%)
  const gmi = +(3.31 + 0.02392 * avg).toFixed(2);

  return {
    count,
    avg:     +avg.toFixed(1),
    min,
    max,
    stdDev:  +stdDev.toFixed(1),
    tir:     +((inOptimal / count) * 100).toFixed(1),
    tirWide: +((inAcceptable / count) * 100).toFixed(1),
    lowPct:  +((low / count) * 100).toFixed(1),
    highPct: +((high / count) * 100).toFixed(1),
    gmi,
  };
}
