/**
 * UP Labs v2 · Pulse module-local helpers (SPEC §7.6)
 * ────────────────────────────────────────────────────
 * Small presentational bits shared by the Pulse hub / master / assessment pages.
 * Clinical-warm only (Lucide, status tokens) — no .liquid / .aurora.
 *
 * Lives inside app/v2/pulse/ per the build constraints (module-local helper allowed
 * here; lib/v2/* is off-limits).
 */
import * as React from "react";
import { Wifi, WifiOff, CheckCircle2, CircleSlash } from "lucide-react";
import { statusTextClass } from "@/lib/v2/status";

/** Connection summary chip used in the picker rows + hub. */
export function ConnChip({ pulse }: { pulse: { provider: string; status: string; last_sync_at: string | null } | null }) {
  const connected = pulse?.status === "active";  // DB stores "active" (not "connected")
  return connected ? (
    <span className={`inline-flex items-center gap-1 rounded-full bg-status-bg-optimal px-2 py-0.5 text-[11px] font-semibold ${statusTextClass.optimal}`}>
      <Wifi size={11} strokeWidth={2.5} aria-hidden /> เชื่อมแล้ว
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink-5 px-2 py-0.5 text-[11px] font-semibold text-ink-40">
      <WifiOff size={11} strokeWidth={2.5} aria-hidden /> ยังไม่เชื่อม
    </span>
  );
}

/** Done / not-done dot used on workflow steps. */
export function StepState({ done, doneLabel, todoLabel }: { done: boolean; doneLabel: string; todoLabel: string }) {
  return done ? (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${statusTextClass.optimal}`}>
      <CheckCircle2 size={15} strokeWidth={2.25} aria-hidden /> {doneLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-40">
      <CircleSlash size={15} strokeWidth={2.25} aria-hidden /> {todoLabel}
    </span>
  );
}

/** th-TH date-time, safe on null. */
export const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "—";

/** Customer row shape from /api/customers/list (subset we use). */
export interface PulseListRow {
  id: string;
  name: string;
  gender: string | null;
  birth_year: number | null;
  birth_date: string | null;
  height: number | null;
  nickname?: string | null;
  stats: { bca: number; cgm: number; pulse: { provider: string; status: string; last_sync_at: string | null } | null };
}
