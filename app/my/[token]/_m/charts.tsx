"use client";

/**
 * Hand-drawn SVG charts for the portal — no chart library (payload budget §7).
 * Curves are monotone cubic (no overshoot), bars are plain rects, and every chart
 * labels the values it actually reaches.
 */
import { monotonePath, scaleSeries, fmtNum } from "@/lib/health-design/portal-nav";
import type { Band } from "@/lib/health-design/glossary";
import { barPosition, barSegments } from "@/lib/health-design/glossary";
import { LEVEL_COLOR } from "@/lib/health-design/portal-nav";

const GREEN = "#396755", GOLD = "#C9922B", ROSE = "#8C4C4C", MUTED = "#5F6B66";

/** Small trend line with first/last labels and an optional dashed target. */
export function Sparkline({ values, labels, target, height = 64, unitDigits = 1 }: { values: number[]; labels?: string[]; target?: number | null; height?: number; unitDigits?: number }) {
  if (!values.length) return null;
  const W = 300, H = height;
  const all = target != null ? [...values, target] : values;
  const { pts, lo, hi } = scaleSeries(values, W, H - 16, 6, Math.min(...all), Math.max(...all));
  const yOf = (v: number) => 6 + (1 - (v - lo) / (hi - lo || 1)) * (H - 16 - 12);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="แนวโน้ม">
      {target != null && <line x1={6} x2={W - 6} y1={yOf(target)} y2={yOf(target)} stroke={GOLD} strokeDasharray="4 4" strokeWidth={1} />}
      <path d={monotonePath(pts)} fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4.5 : 3} fill={GREEN} stroke={i === pts.length - 1 ? "#fff" : "none"} strokeWidth={2} />)}
      <text x={pts[0].x} y={H - 2} fontSize={10} fill={MUTED} fontFamily="Manrope, sans-serif" textAnchor="start">{fmtNum(values[0], unitDigits)}{labels?.[0] ? ` · ${labels[0]}` : ""}</text>
      {values.length > 1 && <text x={pts[pts.length - 1].x} y={H - 2} fontSize={10} fill={MUTED} fontFamily="Manrope, sans-serif" textAnchor="end">{labels?.[labels.length - 1] ? `${labels[labels.length - 1]} · ` : ""}{fmtNum(values[values.length - 1], unitDigits)}</text>}
    </svg>
  );
}

/** Daily bars; days below `low` are gold. */
export function Bars({ values, low, height = 56 }: { values: (number | null)[]; low?: number; height?: number }) {
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  return (
    <div className="flex items-end gap-[3px]" style={{ height }} role="img" aria-label="รายวัน">
      {values.map((v, i) => (
        <span key={i} className="flex-1 rounded-t-[4px]" style={{ height: v == null ? 2 : `${Math.max(4, (v / max) * 100)}%`, background: v == null ? "#D5DED9" : low != null && v < low ? GOLD : GREEN, opacity: v == null ? 1 : 0.85 }} />
      ))}
    </div>
  );
}

/** The range bar for a metric: engine cut-points as coloured segments, the value as a marker. */
export function RangeBar({ value, bands }: { value: number; bands: Band[] }) {
  const segs = barSegments(bands);
  const pos = barPosition(value, bands);
  return (
    <div>
      <div className="relative h-[7px] w-full overflow-visible rounded-full" style={{ background: `linear-gradient(90deg, ${segs.map((s) => `${LEVEL_COLOR[s.level]} ${s.from * 100}% ${s.to * 100}%`).join(", ")})` }}>
        <span aria-hidden className="absolute top-1/2 h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ink bg-white" style={{ left: `${pos * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between font-head text-[10.5px] text-ink-60">
        {bands.map((b, i) => <span key={i}>{i === 0 && b.to != null ? `<${b.to} ` : i > 0 && bands[i - 1].to != null ? `${b.to != null ? `${bands[i - 1].to}–${b.to} ` : `≥${bands[i - 1].to} `}` : ""}{b.label_th}</span>)}
      </div>
    </div>
  );
}

/** One civil day of CGM: minute-of-day → mg/dL, target band 70–140 shaded, meals as rose dots. */
export function CgmDay({ points, meals }: { points: { m: number; v: number }[]; meals: { m: number; label: string }[] }) {
  const W = 320, H = 130, L = 26, R = 6, T = 8, B = 22;
  if (!points.length) return null;
  const vals = points.map((p) => p.v);
  const lo = Math.min(60, ...vals), hi = Math.max(180, ...vals);
  const x = (m: number) => L + (m / 1440) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const pts = points.map((p) => ({ x: x(p.m), y: y(p.v) }));
  const peak = points.reduce((a, p) => (p.v > a.v ? p : a), points[0]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="น้ำตาลตลอดวัน">
      <rect x={L} y={y(140)} width={W - L - R} height={y(70) - y(140)} fill="rgba(57,103,85,0.10)" />
      {[70, 140].map((g) => <g key={g}><line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="#D5DED9" strokeWidth={1} /><text x={L - 4} y={y(g) + 3.5} fontSize={9.5} fill={MUTED} textAnchor="end" fontFamily="Manrope, sans-serif">{g}</text></g>)}
      <path d={monotonePath(pts)} fill="none" stroke={GREEN} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {meals.map((mm, i) => { const near = points.reduce((a, p) => (Math.abs(p.m - mm.m) < Math.abs(a.m - mm.m) ? p : a), points[0]); return <circle key={i} cx={x(mm.m)} cy={y(near.v)} r={4} fill={ROSE} stroke="#fff" strokeWidth={1.5}><title>{mm.label}</title></circle>; })}
      <circle cx={x(peak.m)} cy={y(peak.v)} r={3} fill={GOLD} />
      <text x={Math.min(W - R - 24, x(peak.m) + 5)} y={Math.max(T + 8, y(peak.v) - 5)} fontSize={9.5} fill={MUTED} fontFamily="Manrope, sans-serif">{peak.v}</text>
      {[0, 6, 12, 18, 24].map((h) => <text key={h} x={x(h * 60)} y={H - 6} fontSize={9.5} fill={MUTED} textAnchor={h === 0 ? "start" : h === 24 ? "end" : "middle"} fontFamily="Manrope, sans-serif">{String(h).padStart(2, "0")}:00</text>)}
    </svg>
  );
}

/** C:P:F ring — grams eaten as arcs, centre shows kcal. */
export function CpfRing({ carb, protein, fat, kcal }: { carb: number; protein: number; fat: number; kcal: number }) {
  const total = Math.max(1, carb + protein + fat);
  const c = (carb / total) * 100, p = (protein / total) * 100;
  return (
    <div className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${GOLD} 0 ${c}%, ${GREEN} ${c}% ${c + p}%, ${ROSE} ${c + p}% 100%)` }} role="img" aria-label="สัดส่วนคาร์บ โปรตีน ไขมัน">
      <div className="grid h-[48px] w-[48px] place-items-center rounded-full bg-white font-head text-[13px] font-extrabold tabular-nums text-ink">{fmtNum(Math.round(kcal), 0)}</div>
    </div>
  );
}
