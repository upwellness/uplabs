/**
 * UP Labs v2 · Plate Planner — macro proportion display helpers (module-local)
 * ────────────────────────────────────────────────────────────────────────────
 * DISPLAY ONLY. These do NOT re-derive the nutrition plan — they read the grams the
 * engine already returns (`meal.tot.{p,c,f}`, `meal.items[].{p,c,f}`, day sums) and
 * convert to the energy split for the proportion bars. Same Atwater factors the rest
 * of the app uses (protein·carb = 4 kcal/g, fat = 9 kcal/g), mirroring nutriscan's
 * macroBreakdown and the v1 planner's eSplit. The engine stays the single source of
 * truth for the grams; this just presents them.
 */

import type { DayPlan, Meal, MealItem, Targets } from "@/lib/plate-planner/engine";

export interface MacroGrams { p: number; c: number; f: number; kcal: number }
export interface MacroSplit {
  /** rounded grams */
  p: number; c: number; f: number;
  /** kcal from each macro */
  pKcal: number; cKcal: number; fKcal: number;
  /** total kcal from macros (Atwater) */
  totalKcal: number;
  /** % of energy (integers, summed to ~100) */
  pPct: number; cPct: number; fPct: number;
}

/** Carbs : Protein : Fat energy split from grams (Atwater 4/4/9). Order-agnostic. */
export function energySplit(g: { p: number; c: number; f: number }): MacroSplit {
  const pKcal = g.p * 4, cKcal = g.c * 4, fKcal = g.f * 9;
  const totalKcal = pKcal + cKcal + fKcal || 1;
  return {
    p: Math.round(g.p), c: Math.round(g.c), f: Math.round(g.f),
    pKcal: Math.round(pKcal), cKcal: Math.round(cKcal), fKcal: Math.round(fKcal),
    totalKcal: Math.round(pKcal + cKcal + fKcal),
    pPct: Math.round((pKcal / totalKcal) * 100),
    cPct: Math.round((cKcal / totalKcal) * 100),
    fPct: Math.round((fKcal / totalKcal) * 100),
  };
}

/** Energy split for one meal (reads meal.tot — engine-provided grams). */
export function mealSplit(m: Meal): MacroSplit {
  return energySplit({ p: m.tot.p, c: m.tot.c, f: m.tot.f });
}

/** Sum a day's per-meal totals (engine-provided) into one MacroGrams. */
export function sumDay(day: DayPlan): MacroGrams {
  return day.reduce<MacroGrams>(
    (s, m) => ({ p: s.p + m.tot.p, c: s.c + m.tot.c, f: s.f + m.tot.f, kcal: s.kcal + m.tot.kcal }),
    { p: 0, c: 0, f: 0, kcal: 0 },
  );
}

/** Plan-level DAILY AVERAGE grams across all days (engine-provided per-meal sums). */
export function planDailyAverage(plan: DayPlan[]): MacroGrams {
  if (!plan.length) return { p: 0, c: 0, f: 0, kcal: 0 };
  const tot = plan.reduce<MacroGrams>(
    (s, day) => {
      const d = sumDay(day);
      return { p: s.p + d.p, c: s.c + d.c, f: s.f + d.f, kcal: s.kcal + d.kcal };
    },
    { p: 0, c: 0, f: 0, kcal: 0 },
  );
  const n = plan.length;
  return { p: tot.p / n, c: tot.c / n, f: tot.f / n, kcal: tot.kcal / n };
}

/** Per-item energy split (for the food rows) — reads item.{p,c,f}, display only. */
export function itemSplit(it: MealItem): { pPct: number; cPct: number; fPct: number } {
  const s = energySplit({ p: it.p, c: it.c, f: it.f });
  return { pPct: s.pPct, cPct: s.cPct, fPct: s.fPct };
}

/** Signed delta of an average vs the daily target, for the "avg vs target" readout. */
export function avgVsTarget(avg: MacroGrams, t: Targets) {
  return {
    kcal: Math.round(avg.kcal - t.kcal),
    p: Math.round(avg.p - t.p),
    c: Math.round(avg.c - t.c),
    f: Math.round(avg.f - t.f),
  };
}

/* ── Brand-token hex for the macro proportion bar segments (graphics, not text) ── */
/* C = carb/rose · P = protein/wellness · F = fat/amber — unified with NutriScan's
 * macro colors (app-wide single system, = CPFPie default). */
export const MACRO_HEX = {
  carb: "#8C4C4C",    // rose
  protein: "#396755", // wellness
  fat: "#C47A2A",     // amber
} as const;
