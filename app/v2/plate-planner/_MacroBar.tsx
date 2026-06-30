"use client";

/**
 * UP Labs v2 · Plate Planner — macro proportion bar (สัดส่วนสารอาหาร)
 * ──────────────────────────────────────────────────────────────────
 * Compact Carbs : Protein : Fat bar — grams + % of energy. DISPLAY ONLY: takes the
 * energy split computed in ./_macros from the engine's grams (no nutrition re-derivation).
 * Used on every meal, every day total, and the plan-level daily average.
 *
 * Colors are the brand/category swatches (graphics, 3:1 ok); the readout text uses the
 * dark ink tokens (≥4.5:1), never the bright segment hex — per v2 status-text rules.
 */

import type { MacroSplit } from "./_macros";
import { MACRO_HEX } from "./_macros";

export function MacroBar({
  split,
  size = "md",
  showGrams = true,
}: {
  split: MacroSplit;
  size?: "sm" | "md";
  /** true → "Ng · P%"; false → just "P%" (compact rows) */
  showGrams?: boolean;
}) {
  const segs = [
    { key: "C", label: "คาร์บ", pct: split.cPct, g: split.c, hex: MACRO_HEX.carb, text: "text-rose" },
    { key: "P", label: "โปรตีน", pct: split.pPct, g: split.p, hex: MACRO_HEX.protein, text: "text-wellness" },
    { key: "F", label: "ไขมัน", pct: split.fPct, g: split.f, hex: MACRO_HEX.fat, text: "text-amber" },
  ];
  const barH = size === "sm" ? "h-1.5" : "h-2";
  return (
    <div>
      {/* proportion bar */}
      <div
        className={`flex w-full ${barH} overflow-hidden rounded-full bg-ink-5`}
        role="img"
        aria-label={`สัดส่วนพลังงาน คาร์บ ${split.cPct}% โปรตีน ${split.pPct}% ไขมัน ${split.fPct}%`}
      >
        {segs.map((s) => (
          <span key={s.key} style={{ width: `${s.pct}%`, backgroundColor: s.hex }} title={`${s.label} ${s.pct}%`} />
        ))}
      </div>
      {/* readout */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-ink-60">
        {segs.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <span className="font-semibold text-ink-40">{s.label}</span>
            <b className={s.text}>{showGrams ? `${s.g}g` : ""}</b>
            <span className="text-ink-40">· {s.pct}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
