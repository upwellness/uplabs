/**
 * UP Labs v2 · Clinical-warm UI primitives (SPEC §5)
 * ──────────────────────────────────────────────────
 * White cards · rounded-2xl · soft shadow · Lucide icons · sentence-case ·
 * text ≥12px · one status system. NO .liquid / .aurora classes.
 *
 * Pure presentational (no hooks) so they're usable from server or client trees.
 */
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2, Inbox, AlertTriangle, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { StatusLevel } from "@/lib/medical-status";
import { STATUS_LABEL_TH, statusClasses, statusHex } from "@/lib/medical-status";
import { statusTextClass } from "@/lib/v2/status";
import { cn } from "@/lib/utils";

/** Soft clinical-warm card surface. */
export const CARD =
  "rounded-2xl border border-ink-10 bg-white shadow-[0_1px_2px_rgba(24,21,26,0.04),0_12px_32px_-20px_rgba(24,21,26,0.22)]";

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(CARD, className)} {...rest}>
      {children}
    </div>
  );
}

/** Small section label — sentence-case, not mono-UPPERCASE. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-[12px] font-semibold text-ink-60", className)}>{children}</div>
  );
}

/** Status pill driven by the single token scale (metric level). */
export function LevelBadge({ level, label, className }: { level: StatusLevel; label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold",
        statusClasses.bg[level],
        statusTextClass[level], // ★ AA-contrast text (≥4.5:1); dot keeps bright statusHex
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusHex[level] }} aria-hidden />
      {label ?? STATUS_LABEL_TH[level]}
    </span>
  );
}

/** Icon chip with a soft tinted background (brand tones, not status). */
export type Tone = "rose" | "wellness" | "science" | "amber" | "ink";
const TONE_BG: Record<Tone, string> = {
  rose: "bg-rose-ultra text-rose",
  wellness: "bg-wellness-ultra text-wellness",
  science: "bg-science-ultra text-science",
  amber: "bg-amber-ultra text-amber",
  ink: "bg-ink-5 text-ink-60",
};

export function IconChip({ icon: Icon, tone = "rose", size = 18, className }: { icon: LucideIcon; tone?: Tone; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center justify-center rounded-xl", TONE_BG[tone], className)}>
      <Icon size={size} strokeWidth={2} aria-hidden />
    </span>
  );
}

/* ── Standard async states (SPEC §5: present everywhere) ── */

export function LoadingState({ label = "กำลังโหลดข้อมูล…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <Loader2 size={26} className="animate-spin text-rose" aria-hidden />
      <div className="font-thai text-[13px] text-ink-60">{label}</div>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  hint,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-5 text-ink-40">
        <Icon size={22} strokeWidth={2} aria-hidden />
      </span>
      <div className="mt-1 font-head text-[16px] font-bold text-ink">{title}</div>
      {hint && <p className="max-w-sm font-thai text-[13px] leading-[1.6] text-ink-60">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-status-bg-danger text-status-danger">
        <AlertTriangle size={22} strokeWidth={2} aria-hidden />
      </span>
      <div className="font-head text-[15px] font-bold text-ink">โหลดข้อมูลไม่สำเร็จ</div>
      <p className="max-w-md font-thai text-[13px] leading-[1.6] text-ink-60">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-1.5 text-[12px] font-semibold text-ink-80 transition-colors hover:border-rose hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
        >
          <RefreshCw size={13} strokeWidth={2.25} aria-hidden /> ลองใหม่อีกครั้ง
        </button>
      )}
    </div>
  );
}

/* ── Trend arrow ── */
export function TrendArrow({
  dir,
  className,
  size = 13,
}: {
  dir: "up" | "down" | "flat";
  className?: string;
  size?: number;
}) {
  if (dir === "up") return <TrendingUp size={size} strokeWidth={2.25} className={className} aria-hidden />;
  if (dir === "down") return <TrendingDown size={size} strokeWidth={2.25} className={className} aria-hidden />;
  return <Minus size={size} strokeWidth={2.25} className={className} aria-hidden />;
}

/* ── Metric gauge — radial 0..1 ring tinted by status level ── */
export function MetricGauge({
  value,
  display,
  unit,
  label,
  level,
  size = 96,
}: {
  /** fraction 0..1 of the ring to fill */
  value: number;
  /** big centre text (already formatted) */
  display: string;
  unit?: string;
  label: string;
  level: StatusLevel;
  size?: number;
}) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const dash = c * pct;
  const hex = statusHex[level];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${label}: ${display}${unit ? " " + unit : ""}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F2F0F3" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={hex}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-head text-[19px] font-extrabold leading-none text-ink">{display}</span>
          {unit && <span className="mt-0.5 font-mono text-[10px] text-ink-60">{unit}</span>}
        </div>
      </div>
      <div className="text-center">
        <div className="font-thai text-[12px] font-semibold text-ink-80">{label}</div>
      </div>
    </div>
  );
}
