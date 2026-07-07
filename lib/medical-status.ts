/**
 * Medical Status Color System
 * ────────────────────────────
 * ★ 5-level clinical traffic light (single source of truth — Ton's spec 2026-07-06):
 *   เขียวเข้ม ดีมาก · เขียว ปกติ · เหลือง ควรระวัง · ส้ม เสี่ยงสูง · แดง อันตราย
 * Every status surface — BCA gauges, the cinematic scan reveal, lab badges,
 * customer-status dots — reads these SAME five levels + hexes, so a metric can
 * never be classified (or coloured) two different ways on two screens.
 *
 * Contrast is WCAG-checked:
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

// Middle levels stay direction-neutral ("ควรระวัง/เสี่ยงสูง" not "สูง/สูงมาก")
// because LOW values also land there (muscle %, underweight BMI, low HDL).
export const STATUS_LABEL_TH: Record<StatusLevel, string> = {
  optimal: "ดีมาก",
  good:    "ปกติ",
  caution: "ควรระวัง",
  warning: "เสี่ยงสูง",
  danger:  "อันตราย",
};

export const STATUS_LABEL_EN: Record<StatusLevel, string> = {
  optimal: "Excellent",
  good:    "Normal",
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

// ★ Traffic-light graphics ramp (rings, dots, chart strokes). WCAG ≥3:1 on white.
// Keep in sync with the scan reveal's COLHEX and tailwind `status` tokens.
export const statusHex: Record<StatusLevel, string> = {
  optimal: "#166534", // เขียวเข้ม — ดีมาก
  good:    "#16A34A", // เขียว — ปกติ
  caution: "#C18A03", // เหลือง — ควรระวัง
  warning: "#EA580C", // ส้ม — เสี่ยงสูง
  danger:  "#DC2626", // แดง — อันตราย
};

/* ── BCA Thresholds ──────────────────────────────────
 * ★ SOURCE = UP Wellness official evaluation chart (เกณฑ์การประเมิน) — the exact
 *   bands + Thai category words the clinic uses with customers. Sex-split, NOT
 *   age-adjusted. Each band() returns {level (→colour), label (→the clinic word)}.
 *   classify*() are thin wrappers returning just the level, so every existing
 *   colour caller keeps working. The scan reveal mirrors these numbers + words.
 */

export type Gender = "male" | "female";

export interface BcaBand { level: StatusLevel; label: string; }

/** Body-fat % — 4 bands, sex-split. High = worse; "ต่ำ" (below normal) also flagged. */
export function bandBodyFat(pct: number, gender: Gender): BcaBand {
  if (gender === "male") {
    if (pct < 10) return { level: "caution", label: "ต่ำ" };       // 5.0–9.9
    if (pct < 20) return { level: "good",    label: "ปกติ" };      // 10.0–19.9
    if (pct < 25) return { level: "warning", label: "เริ่มอ้วน" }; // 20.0–24.9
    return { level: "danger", label: "อ้วน" };                     // 25.0+
  }
  if (pct < 20) return { level: "caution", label: "ต่ำ" };         // 5.0–19.9
  if (pct < 30) return { level: "good",    label: "ปกติ" };        // 20.0–29.9
  if (pct < 35) return { level: "warning", label: "เริ่มอ้วน" };   // 30.0–34.5
  return { level: "danger", label: "อ้วน" };                       // 35.0+
}

/** Muscle % — 4 bands, sex-split. Higher = better (สูง/สูงมาก are the good end). */
export function bandMusclePct(pct: number, gender: Gender): BcaBand {
  if (gender === "male") {
    if (pct < 32.9) return { level: "warning", label: "ต่ำ" };     // 5.0–32.8
    if (pct < 35.8) return { level: "good",    label: "ปกติ" };    // 32.9–35.7
    if (pct < 37.4) return { level: "optimal", label: "สูง" };     // 35.8–37.3
    return { level: "optimal", label: "สูงมาก" };                  // 37.4+
  }
  if (pct < 25.9) return { level: "warning", label: "ต่ำ" };       // 5.0–25.8
  if (pct < 28.0) return { level: "good",    label: "ปกติ" };      // 25.9–27.9
  if (pct < 29.1) return { level: "optimal", label: "สูง" };       // 28.0–29.0
  return { level: "optimal", label: "สูงมาก" };                    // 29.1+
}

/** Visceral fat rating — 5 bands (device rating, sex-neutral). */
export function bandVisceralFat(level: number): BcaBand {
  if (level <= 2)  return { level: "optimal", label: "ดี" };        // 1–2
  if (level <= 5)  return { level: "good",    label: "ปกติ" };      // 3–5
  if (level <= 10) return { level: "caution", label: "เริ่มเสี่ยง" }; // 6–10
  if (level <= 15) return { level: "warning", label: "เสี่ยงสูง" };  // 11–15
  return { level: "danger", label: "อันตราย" };                     // 16+
}

/** BMI — 5 bands, WHO Asian-Pacific (clinic labels). */
export function bandBMI(bmi: number): BcaBand {
  if (bmi < 18.5) return { level: "caution", label: "ผอมกว่าปกติ" };   // < 18.5
  if (bmi < 23)   return { level: "good",    label: "ปกติสุขภาพดี" };  // 18.5–22.9
  if (bmi < 25)   return { level: "caution", label: "อ้วนระดับ 1" };   // 23–24.9
  if (bmi <= 30)  return { level: "warning", label: "อ้วนระดับ 2" };   // 25–30
  return { level: "danger", label: "อ้วนระดับ 3" };                    // > 30
}

// ── Level-only wrappers (colour callers: gauges, labs, badges, 360 body map) ──
export function classifyBodyFat(pct: number, gender: Gender, _age?: number): StatusLevel { return bandBodyFat(pct, gender).level; }
export function classifyMusclePct(pct: number, gender: Gender): StatusLevel { return bandMusclePct(pct, gender).level; }
export function classifyVisceralFat(level: number): StatusLevel { return bandVisceralFat(level).level; }
export function classifyBMI(bmi: number): StatusLevel { return bandBMI(bmi).level; }

export function classifyBodyAge(bodyAge: number, chronoAge: number): StatusLevel {
  // Being AT or below your actual age reads "good"; only older-than-actual escalates.
  const diff = bodyAge - chronoAge;
  if (diff <= -5) return "optimal"; // ≥5 yrs younger — excellent
  if (diff <= 0)  return "good";    // at or below your age
  if (diff <= 4)  return "caution"; // up to 4 yrs older — monitor
  if (diff <= 8)  return "warning"; // 5–8 yrs older
  return "danger";                  // 9+ yrs older
}
