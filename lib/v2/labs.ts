/**
 * UP Labs v2 · Lab + vital metric classification (client-safe)
 * ────────────────────────────────────────────────────────────
 * Thresholds mirror the locked clinical rules already used server-side
 * (lib/customers/insight-rules · lib/medical-status). Used by the Customer 360
 * Vital Dashboard (6 metric cards) and the Labs/Trends tabs so the SAME status
 * tokens drive every surface.
 */
import type { StatusLevel } from "@/lib/medical-status";
import { classifyVisceralFat, classifyBodyAge, classifyBMI } from "@/lib/medical-status";

export type { StatusLevel };

/** HbA1c (%) — ADA: <5.7 normal · 5.7–6.4 prediabetes · ≥6.5 diabetes. */
export function classifyHbA1c(v: number): StatusLevel {
  if (v < 5.7) return "optimal";
  if (v < 6.0) return "caution";
  if (v < 6.5) return "warning";
  return "danger";
}

/** Fasting glucose (mg/dL) — <100 normal · 100–125 prediabetes · ≥126 diabetes. */
export function classifyFBS(v: number): StatusLevel {
  if (v < 100) return "optimal";
  if (v < 110) return "good";
  if (v < 126) return "caution";
  if (v < 160) return "warning";
  return "danger";
}

/** LDL-C (mg/dL) — <100 optimal · 100–129 near · 130–159 borderline · 160–189 high · ≥190 very high. */
export function classifyLDL(v: number): StatusLevel {
  if (v < 100) return "optimal";
  if (v < 130) return "good";
  if (v < 160) return "caution";
  if (v < 190) return "warning";
  return "danger";
}

/** HDL-C (mg/dL) — higher is better. */
export function classifyHDL(v: number): StatusLevel {
  if (v >= 60) return "optimal";
  if (v >= 50) return "good";
  if (v >= 40) return "caution";
  return "warning";
}

/** Triglyceride (mg/dL) — <150 normal · 150–199 borderline · 200–499 high · ≥500 very high. */
export function classifyTriglyceride(v: number): StatusLevel {
  if (v < 150) return "optimal";
  if (v < 200) return "caution";
  if (v < 500) return "warning";
  return "danger";
}

/** ALT/AST (U/L) — ULN ≈ 40; >2× ULN critical. */
export function classifyTransaminase(v: number): StatusLevel {
  if (v <= 40) return "optimal";
  if (v <= 60) return "caution";
  if (v <= 80) return "warning";
  return "danger";
}

export { classifyVisceralFat, classifyBodyAge, classifyBMI };

/** Generic key → classifier (for the Labs tab). Returns null for unknown keys. */
export function classifyMetric(key: string, value: number, opts?: { chronoAge?: number | null }): StatusLevel | null {
  switch (key) {
    case "hba1c": return classifyHbA1c(value);
    case "fbs": return classifyFBS(value);
    case "ldl": return classifyLDL(value);
    case "hdl": return classifyHDL(value);
    case "triglyceride": return classifyTriglyceride(value);
    case "alt":
    case "ast": return classifyTransaminase(value);
    case "visceral": return classifyVisceralFat(value);
    case "body_age":
      return opts?.chronoAge != null ? classifyBodyAge(value, opts.chronoAge) : null;
    default: return null;
  }
}

/** Trend direction from a numeric series (oldest → newest). */
export function trendDir(series: number[]): "up" | "down" | "flat" {
  const clean = series.filter((n) => n != null && !Number.isNaN(n));
  if (clean.length < 2) return "flat";
  const delta = clean[clean.length - 1] - clean[0];
  const denom = Math.abs(clean[0]) || 1;
  if (Math.abs(delta) / denom < 0.02) return "flat";
  return delta > 0 ? "up" : "down";
}

/** For a metric where LOWER is better (LDL, visceral, HbA1c…), is an upward trend bad? */
export const LOWER_IS_BETTER = new Set(["hba1c", "fbs", "ldl", "triglyceride", "alt", "ast", "visceral", "body_age", "weight", "fat_pct"]);
