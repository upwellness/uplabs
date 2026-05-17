/**
 * Shared types across BFF + Frontend.
 * Mirrors the existing Supabase schema (customers, measurements).
 */

export type Gender = "male" | "female";

export interface Customer {
  id: string;
  coach_id: string;
  name: string;
  gender: Gender;
  birth_year: number | null;    // auto-synced from birth_date via DB trigger · kept for back-compat
  birth_date: string | null;    // ISO date YYYY-MM-DD (Gregorian). UI toggles พ.ศ./ค.ศ. display
  height: number | null;        // cm
  created_at: string;
}

export interface Measurement {
  id: string;
  customer_id: string;
  recorded_at: string;          // ISO date
  weight: number | null;        // kg
  fat_pct: number | null;       // %
  visceral: number | null;      // level (Tanita scale)
  muscle_pct: number | null;    // %
  body_age: number | null;      // years
  bmr: number | null;           // kcal
}

export interface MeasurementWithDerived extends Measurement {
  bmi: number | null;
  fat_mass: number | null;
  muscle_mass: number | null;
  chrono_age: number | null;
}
