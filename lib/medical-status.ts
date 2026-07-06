/**
 * Medical Status Color System
 * ────────────────────────────
 * ★ UP Wellness CI-harmonized 5-level ramp (single source of truth).
 * Every status surface — BCA gauges, the cinematic scan reveal, lab badges,
 * customer-status dots — reads these SAME five levels + hexes, so a metric can
 * never be classified (or coloured) two different ways on two screens.
 *
 * The ramp stays inside the brand family (two greens → gold → terracotta →
 * old-rose) instead of a generic red/orange traffic light, so it reads
 * "clinical-warm" on cream, not cold. Contrast is WCAG-checked:
 *   - statusHex (rings/dots/graphics) ≥ 3:1 on white
 *   - statusTextHex (lib/v2/status, for LABEL text) ≥ 4.5:1 on white
 *
 * Severity mapping (international clinical convention):
 *   optimal → recommended healthy range
 *   good    → acceptable, no action
 *   caution → borderline, monitor
 *   warning → elevated risk, intervene
 *   danger  → critical, urgent attention
 */

export type StatusLevel = "optimal" | "good" | "caution" | "warning" | "danger";

export const STATUS_LABEL_TH: Record<StatusLevel, string> = {
  optimal: "เหมาะสม",
  good:    "ดี",
  caution: "ควรระวัง",
  warning: "เสี่ยงสูง",
  danger:  "อันตราย",
};

export const STATUS_LABEL_EN: Record<StatusLevel, string> = {
  optimal: "Optimal",
  good:    "Good",
  caution: "Caution",
  warning: "High Risk",
  danger:  "Critical",
};

// Tailwind-ready class lookups
export const statusClasses = {
  text:  { optimal: "text-status-optimal", good: "text-status-good", caution: "text-status-caution", warning: "text-status-warning", danger: "text-status-danger" } as Record<StatusLevel, string>,
  bg:    { optimal: "bg-status-bg-optimal", good: "bg-status-bg-good", caution: "bg-status-bg-caution", warning: "bg-status-bg-warning", danger: "bg-status-bg-danger" } as Record<StatusLevel, string>,
  ring:  { optimal: "ring-status-optimal/30", good: "ring-status-good/30", caution: "ring-status-caution/30", warning: "ring-status-warning/30", danger: "ring-status-danger/30" } as Record<StatusLevel, string>,
};

// ★ CI-harmonized graphics ramp (rings, dots, chart strokes). WCAG ≥3:1 on white.
// Keep in sync with the scan reveal's COLHEX and tailwind `status` tokens.
export const statusHex: Record<StatusLevel, string> = {
  optimal: "#2E6B4C", // deep pine green — best
  good:    "#4E8168", // wellness green — healthy
  caution: "#BE8B1E", // gold — monitor
  warning: "#B5623A", // terracotta — elevated risk
  danger:  "#8C4C4C", // old rose — critical
};

/* ── BCA Thresholds ──────────────────────────────────
 * Sources:
 *   Body fat  → Gallagher et al. 2000 (Am J Clin Nutr) healthy-body-fat ranges
 *               by age + sex — the reference BIA smart-scales (Tanita/InBody)
 *               calibrate to. Age-adjusted (a 55-yr-old's healthy % > a 25-yr-old's).
 *   Muscle    → skeletal-muscle % of body weight, sex-specific (higher = better).
 *   Visceral  → Tanita visceral-fat rating (1–9 healthy · 10–14 high · 15+ very high).
 *   BMI       → WHO Asian-Pacific cut-offs (appropriate for Thai population).
 *   Body age  → offset from chronological age.
 * ★ These are the ONLY BCA thresholds in the app — the scan reveal mirrors them.
 */

export type Gender = "male" | "female";

/**
 * Body-fat %, age- and sex-adjusted (Gallagher/Tanita). `age` is optional: when
 * unknown we fall back to a mid-adult band (45) so legacy callers still classify.
 * Healthy range is split across the two greens (optimal = leaner half, good =
 * upper-healthy) so a top-of-healthy reading still reads green, not amber.
 */
export function classifyBodyFat(pct: number, gender: Gender, age?: number): StatusLevel {
  const a = age ?? 45;
  const band = a < 40 ? 0 : a < 60 ? 1 : 2; // Gallagher age bands 20–39 / 40–59 / 60+
  // [underfat < uf] [healthy uf..ho) [overfat ho..ob) [obese ≥ ob]
  const [uf, ho, ob] = gender === "male"
    ? [[8, 20, 25], [11, 22, 28], [13, 25, 30]][band]
    : [[21, 33, 39], [23, 34, 40], [24, 36, 42]][band];
  if (pct < uf) return "caution";                       // underfat (too low)
  if (pct < ho) return pct <= uf + 0.55 * (ho - uf) ? "optimal" : "good"; // healthy
  if (pct < ob) return "warning";                       // overfat
  return "danger";                                      // obese
}

export function classifyMusclePct(pct: number, gender: Gender): StatusLevel {
  // Skeletal-muscle % of body weight (BIA). Higher = better; sex-specific.
  if (gender === "male") {
    if (pct < 31) return "danger";
    if (pct < 35) return "warning";
    if (pct < 38) return "caution";
    if (pct < 42) return "good";
    return "optimal";
  } else {
    if (pct < 23) return "danger";
    if (pct < 26) return "warning";
    if (pct < 29) return "caution";
    if (pct < 33) return "good";
    return "optimal";
  }
}

export function classifyVisceralFat(level: number): StatusLevel {
  // Tanita visceral-fat rating (device standard):
  //   1–9  healthy · 10–14 high · 15+ very high
  if (level <= 5)  return "optimal"; // 1–5  solidly healthy
  if (level <= 9)  return "good";    // 6–9  healthy, upper end
  if (level <= 12) return "caution"; // 10–12 high — monitor
  if (level <= 14) return "warning"; // 13–14 high — intervene
  return "danger";                   // 15+  very high
}

export function classifyBMI(bmi: number): StatusLevel {
  // WHO Asian-Pacific cutoffs (more appropriate for Thai population)
  if (bmi < 18.5) return "caution";
  if (bmi < 23)   return "optimal";
  if (bmi < 25)   return "good";
  if (bmi < 30)   return "caution";
  if (bmi < 35)   return "warning";
  return "danger";
}

export function classifyBodyAge(bodyAge: number, chronoAge: number): StatusLevel {
  // Being AT or below your actual age reads "good"; only older-than-actual escalates.
  const diff = bodyAge - chronoAge;
  if (diff <= -5) return "optimal"; // ≥5 yrs younger — excellent
  if (diff <= 0)  return "good";    // at or below your age
  if (diff <= 4)  return "caution"; // up to 4 yrs older — monitor
  if (diff <= 8)  return "warning"; // 5–8 yrs older
  return "danger";                  // 9+ yrs older
}
