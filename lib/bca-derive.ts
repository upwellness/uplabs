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

/**
 * Compute age at a given date. Prefers full birth_date for day-accurate age; falls back to birth_year.
 */
export function deriveChronoAge(
  birthDateOrYear: string | number | null,
  atIso: string,
): number | null {
  if (birthDateOrYear == null) return null;
  const at = new Date(atIso);
  if (typeof birthDateOrYear === "string") {
    const birth = new Date(birthDateOrYear);
    if (isNaN(birth.getTime())) return null;
    let age = at.getFullYear() - birth.getFullYear();
    const md = at.getMonth() - birth.getMonth();
    if (md < 0 || (md === 0 && at.getDate() < birth.getDate())) age--;
    return age;
  }
  return at.getFullYear() - birthDateOrYear;
}

export function enrichMeasurement(m: Measurement, c: Customer): MeasurementWithDerived {
  return {
    ...m,
    bmi: deriveBMI(m.weight, c.height),
    fat_mass: deriveFatMass(m.weight, m.fat_pct),
    muscle_mass: deriveMuscleMass(m.weight, m.muscle_pct),
    chrono_age: deriveChronoAge(c.birth_date ?? c.birth_year, m.recorded_at),
  };
}
