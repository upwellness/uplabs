/**
 * CGM types — mirrors the existing v1 Supabase schema.
 * Tables: cgm_readings, cgm_meals
 */

export interface CGMProfile {
  name: string;            // profile_name (string key, no FK to customers)
  readings_count: number;
  first_reading?: number;  // epoch ms
  last_reading?: number;
}

export interface CGMReading {
  id?: number;
  profile_name: string;
  reading_timestamp: number;   // epoch ms
  date_str: string;
  glucose: number;             // mg/dL
}

export interface CGMMeal {
  id: number;
  profile_name: string;
  meal_timestamp: number;      // epoch ms
  date_str: string;
  description: string;
  carbs: number | null;
  protein: number | null;
  fat: number | null;
}

export type GlucoseLevel = "low" | "optimal" | "acceptable" | "high";

export interface CGMStats {
  count:    number;
  avg:      number;
  min:      number;
  max:      number;
  stdDev:   number;
  tir:      number;    // % in optimal range (70-110)
  tirWide:  number;    // % in acceptable range (70-140)
  lowPct:   number;
  highPct:  number;
  gmi:      number;    // Glucose Management Indicator (estimated HbA1c)
}
