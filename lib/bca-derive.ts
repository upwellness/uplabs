/**
 * Pure functions to derive metrics from raw measurements.
 * Lives in /lib because both BFF and frontend may want them.
 */
import type { Measurement, MeasurementWithDerived, Customer } from "./types";

export function deriveBMI(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return +(weightKg / (m * m)).toFixed(1);
}

export function deriveFatMass(weight: number | null, fatPct: number | null): number | null {
  if (weight == null || fatPct == null) return null;
  return +((weight * fatPct) / 100).toFixed(1);
}

export function deriveMuscleMass(weight: number | null, musclePct: number | null): number | null {
  if (weight == null || musclePct == null) return null;
  return +((weight * musclePct) / 100).toFixed(1);
}

export function deriveChronoAge(birthYear: number | null, atIso: string): number | null {
  if (!birthYear) return null;
  const at = new Date(atIso);
  return at.getFullYear() - birthYear;
}

export function enrichMeasurement(m: Measurement, c: Customer): MeasurementWithDerived {
  return {
    ...m,
    bmi: deriveBMI(m.weight, c.height),
    fat_mass: deriveFatMass(m.weight, m.fat_pct),
    muscle_mass: deriveMuscleMass(m.weight, m.muscle_pct),
    chrono_age: deriveChronoAge(c.birth_year, m.recorded_at),
  };
}
