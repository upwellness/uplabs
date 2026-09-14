"use client";

/**
 * Portal primitives — glass card (`.liquid` from globals.css), chips, big numbers,
 * rows, the level dot. Every screen composes these so spacing and colour stay one
 * object across the app (SPEC-Mobile-Portal.md §5.3).
 */
import type { ReactNode } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { DomainKey, Level } from "@/lib/health-design/assess";
import { levelColor, levelShort } from "@/lib/health-design/portal-nav";

export function Card({ children, className = "", solid = false, onClick, as: Tag = "div" }: { children: ReactNode; className?: string; solid?: boolean; onClick?: () => void; as?: "div" | "button" }) {
  const base = solid ? "rounded-[22px] bg-wellness text-white shadow-[0_8px_28px_rgba(57,103,85,0.25)]" : "liquid rounded-[22px]";
  if (Tag === "button") return <button type="button" onClick={onClick} className={`${base} block w-full text-left ${className}`}>{children}</button>;
  return <div onClick={onClick} className={`${base} ${className}`}>{children}</div>;
}

export const Sub = ({ children, className = "", light = false }: { children: ReactNode; className?: string; light?: boolean }) =>
  <div className={`font-thai text-[13px] leading-snug ${light ? "text-white/75" : "text-ink-60"} ${className}`}>{children}</div>;

export function Dot({ level, size = 9 }: { level: Level | null | undefined; size?: number }) {
  return <span aria-hidden className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: levelColor(level) }} />;
}

export function LevelChip({ domain, level, text }: { domain: DomainKey | null; level: Level | null | undefined; text?: string }) {
  const l = level ?? null;
  const bg = l === "good" ? "rgba(62,124,89,.14)" : l === "watch" ? "rgba(201,146,43,.18)" : l === "attention" ? "rgba(180,65,60,.14)" : "rgba(31,30,27,.07)";
  const fg = l === "good" ? "#244438" : l === "watch" ? "#7A5410" : l === "attention" ? "#7A2823" : "#5F6B66";
  return <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 font-head text-[11.5px] font-bold" style={{ background: bg, color: fg }}>{text ?? levelShort(domain, l)}</span>;
}

export function Chip({ children, tone = "green", className = "" }: { children: ReactNode; tone?: "green" | "rose" | "gold" | "muted" | "white"; className?: string }) {
  const s = tone === "green" ? "bg-wellness/10 text-wellness-deep" : tone === "rose" ? "bg-rose/10 text-rose-deep" : tone === "gold" ? "bg-[rgba(201,146,43,.18)] text-[#7A5410]" : tone === "white" ? "bg-white/20 text-white" : "bg-ink-5 text-ink-60";
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 font-head text-[11.5px] font-bold ${s} ${className}`}>{children}</span>;
}

export function Big({ value, unit, className = "", light = false }: { value: ReactNode; unit?: ReactNode; className?: string; light?: boolean }) {
  return (
    <div className={`font-head text-[28px] font-extrabold leading-none tracking-[-0.02em] tabular-nums ${className}`}>
      {value}{unit && <small className={`ml-1 font-head text-[12px] font-semibold tracking-normal ${light ? "text-white/75" : "text-ink-60"}`}>{unit}</small>}
    </div>
  );
}

/** A tappable list row — label on the left, value/chip on the right, chevron. */
export function Row({ left, right, onClick, expanded, first = false, className = "" }: { left: ReactNode; right?: ReactNode; onClick?: () => void; expanded?: boolean; first?: boolean; className?: string }) {
  const inner = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-2 font-thai text-[15px] text-ink">{left}</span>
      <span className="flex shrink-0 items-center gap-2">{right}{onClick && (expanded == null ? <ChevronRight className="h-4 w-4 text-ink-40" /> : expanded ? <ChevronDown className="h-4 w-4 text-wellness" /> : <ChevronRight className="h-4 w-4 text-ink-40" />)}</span>
    </>
  );
  const cls = `flex w-full items-center justify-between gap-3 py-[11px] text-left ${first ? "" : "border-t border-ink-10"} ${className}`;
  return onClick ? <button type="button" onClick={onClick} className={`${cls} min-h-[44px]`}>{inner}</button> : <div className={cls}>{inner}</div>;
}

export function Val({ value, unit, className = "" }: { value: ReactNode; unit?: ReactNode; className?: string }) {
  return <span className={`whitespace-nowrap font-head text-[16px] font-extrabold tabular-nums text-ink ${className}`}>{value}{unit && <small className="ml-0.5 font-head text-[11px] font-semibold text-ink-60">{unit}</small>}</span>;
}

export const PrimaryBtn = ({ children, onClick, tone = "green", className = "", disabled = false }: { children: ReactNode; onClick?: () => void; tone?: "green" | "rose" | "ghost"; className?: string; disabled?: boolean }) => (
  <button type="button" onClick={onClick} disabled={disabled}
    className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full px-4 font-head text-[15px] font-bold transition active:scale-[0.99] disabled:opacity-50 ${
      tone === "green" ? "bg-wellness text-white shadow-[0_6px_18px_rgba(57,103,85,0.25)]" : tone === "rose" ? "bg-rose text-white shadow-[0_6px_18px_rgba(140,76,76,0.25)]" : "border border-wellness/35 bg-white/60 text-wellness"} ${className}`}>
    {children}
  </button>
);

export const Tag = ({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "rose" }) =>
  <div className={`font-head text-[11px] font-bold uppercase tracking-[0.1em] ${tone === "rose" ? "text-rose" : "text-wellness"}`}>{children}</div>;

export const Empty = ({ children }: { children: ReactNode }) => <p className="font-thai text-[14px] leading-relaxed text-ink-60">{children}</p>;
