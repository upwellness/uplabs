/**
 * UP Labs v2 · Single status system (SPEC §5 — "one status system")
 * ─────────────────────────────────────────────────────────────────
 * Two scales feed the UI; both map to the SAME 5 status tokens so badges,
 * gauges and text never drift:
 *   - StatusLevel  ("optimal"…"danger")  — clinical metric severity (lib/medical-status)
 *   - CustomerStatus ("healthy"…"critical") — overall customer state (lib/customers/status-classifier)
 *
 * All Tailwind classes reference the design tokens (status-* / status-bg-*),
 * never floating hex. Charts read `statusHex` from lib/medical-status.
 */
import type { StatusLevel } from "@/lib/medical-status";
import { STATUS_LABEL_TH, statusClasses } from "@/lib/medical-status";
import type { CustomerStatus } from "@/lib/customers/status-classifier";

export type { StatusLevel };

/**
 * ★ Accessible status TEXT colors (SPEC §8 · WCAG 2.2 AA, ≥4.5:1 on white/tinted bg).
 * ──────────────────────────────────────────────────────────────────────────────────
 * The bright `statusHex` (lib/medical-status) is tuned for *graphics* — dots, gauge
 * rings, chart strokes — where 3:1 (non-text) is enough. As small text it fails 4.5:1.
 * Use `statusTextHex` (or the Tailwind classes in `statusTextClass`) for any status
 * LABEL/TEXT; keep `statusHex` for dots/rings/graphics only. v2-scoped — does not
 * change the global tailwind tokens or v1.
 */
export const statusTextHex: Record<StatusLevel, string> = {
  optimal: "#15803D", // green-700
  good:    "#3F6212", // lime-800
  caution: "#854D0E", // amber-800
  warning: "#9A3412", // orange-800
  danger:  "#991B1B", // red-800
};

/** Tailwind arbitrary-value text classes mirroring statusTextHex (for className use). */
export const statusTextClass: Record<StatusLevel, string> = {
  optimal: "text-[#15803D]",
  good:    "text-[#3F6212]",
  caution: "text-[#854D0E]",
  warning: "text-[#9A3412]",
  danger:  "text-[#991B1B]",
};

/** Tailwind classes for a clinical metric level (text + bg + ring). */
export function levelChip(level: StatusLevel): { text: string; bg: string; ring: string; label: string } {
  return {
    text: statusClasses.text[level],
    bg: statusClasses.bg[level],
    ring: statusClasses.ring[level],
    label: STATUS_LABEL_TH[level],
  };
}

/** Map the overall CustomerStatus badge onto the single token scale. */
const CUSTOMER_STATUS_LEVEL: Record<CustomerStatus, StatusLevel> = {
  critical:   "danger",
  at_risk:    "warning",
  in_program: "caution",
  lapsed:     "caution",
  new:        "good",
  healthy:    "optimal",
};

export function customerStatusLevel(s: CustomerStatus): StatusLevel {
  return CUSTOMER_STATUS_LEVEL[s] ?? "caution";
}

/** Health-score (0–100) → status level, matching the score thresholds used server-side. */
export function scoreLevel(total: number | null | undefined): StatusLevel {
  if (total == null) return "caution";
  if (total >= 85) return "optimal";
  if (total >= 75) return "good";
  if (total >= 60) return "caution";
  if (total >= 40) return "warning";
  return "danger";
}
