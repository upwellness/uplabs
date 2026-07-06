/**
 * UP Labs v2 · BCA Scan-Reveal — data mapper
 * ──────────────────────────────────────────
 * Maps the app's Customer + enriched measurements into the self-contained
 * shape the cinematic scan HTML (see _scan-template.ts) reads from
 * window.__SCAN_DATA__. Kept in its own light module (no heavy template
 * import) so the big HTML string can be dynamic-imported with the overlay.
 * Every numeric field is nullable — the scan page degrades gracefully
 * (missing metric → "—", call-out hidden, excluded from the score).
 */
import { resolveAge } from "@/lib/v2/identity";
import { deriveChronoAge } from "@/lib/bca-derive";
import type { Customer, MeasurementWithDerived } from "@/lib/types";

export interface ScanRevealData {
  name: string;
  sex: "male" | "female";
  age: number | null;
  heightCm: number | null;
  date: string;
  m: {
    weight: number | null;
    bodyFat: number | null;
    visceral: number | null;
    muscle: number | null;
    bodyAge: number | null;
    bmr: number | null;
  };
  history: Array<{
    date: string;
    weight: number | null;
    bodyFat: number | null;
    visceral: number | null;
    muscle: number | null;
  }>;
}

const shortMonth = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { month: "short" });
const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

/** enriched must be newest-first (as produced by the BCA workspace). */
export function buildScanData(customer: Customer, enriched: MeasurementWithDerived[]): ScanRevealData | null {
  const latest = enriched[0];
  if (!latest) return null;
  const age = resolveAge(customer) ?? deriveChronoAge(customer.birth_date ?? customer.birth_year, latest.recorded_at);
  return {
    name: customer.name,
    sex: customer.gender === "male" ? "male" : "female",
    age: age ?? null,
    heightCm: customer.height ?? null,
    date: fullDate(latest.recorded_at),
    m: {
      weight: latest.weight,
      bodyFat: latest.fat_pct,
      visceral: latest.visceral,
      muscle: latest.muscle_pct,
      bodyAge: latest.body_age,
      bmr: latest.bmr,
    },
    // oldest → newest, last 4 points for the trend sparklines
    history: enriched.slice(0, 4).reverse().map((m) => ({
      date: shortMonth(m.recorded_at),
      weight: m.weight,
      bodyFat: m.fat_pct,
      visceral: m.visceral,
      muscle: m.muscle_pct,
    })),
  };
}
