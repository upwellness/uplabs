/**
 * Medical Status Color System
 * ────────────────────────────
 * Universal traffic-light scheme — NOT brand colors.
 * Used across all UPLABS apps for any health metric requiring
 * clinical seriousness (lab values, vitals, body composition).
 *
 * Mapping is consistent with international clinical conventions:
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

export const statusHex: Record<StatusLevel, string> = {
  optimal: "#16A34A",
  good:    "#65A30D",
  caution: "#CA8A04",
  warning: "#EA580C",
  danger:  "#DC2626",
};

/* ── BCA Thresholds ──────────────────────────────────
 * Sources: ACE (American Council on Exercise) Body Fat Categories,
 *          WHO BMI · NHLBI · Tanita Visceral Fat reference
 */

export type Gender = "male" | "female";

export function classifyBodyFat(pct: number, gender: Gender): StatusLevel {
  if (gender === "male") {
    if (pct < 6)  return "caution"; // too low (essential fat only)
    if (pct <= 13) return "optimal"; // athletes
    if (pct <= 17) return "good";    // fitness
    if (pct <= 24) return "caution"; // average
    if (pct <= 29) return "warning"; // overweight
    return "danger";                 // obese
  } else {
    if (pct < 14) return "caution";
    if (pct <= 20) return "optimal";
    if (pct <= 24) return "good";
    if (pct <= 31) return "caution";
    if (pct <= 36) return "warning";
    return "danger";
  }
}

export function classifyMusclePct(pct: number, gender: Gender): StatusLevel {
  if (gender === "male") {
    if (pct < 33)  return "danger";
    if (pct < 37)  return "warning";
    if (pct < 40)  return "caution";
    if (pct <= 44) return "good";
    return "optimal";
  } else {
    if (pct < 24)  return "danger";
    if (pct < 28)  return "warning";
    if (pct < 31)  return "caution";
    if (pct <= 35) return "good";
    return "optimal";
  }
}

export function classifyVisceralFat(level: number): StatusLevel {
  // Tanita scale 1–59
  if (level <= 9)  return "optimal";
  if (level <= 12) return "caution";
  if (level <= 14) return "warning";
  return "danger";
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
  const diff = bodyAge - chronoAge;
  if (diff <= -5) return "optimal";
  if (diff <= -2) return "good";
  if (diff <= 2)  return "caution";
  if (diff <= 6)  return "warning";
  return "danger";
}
