/**
 * Macro calorie math helpers.
 * Carb · Protein = 4 kcal/g · Fat = 9 kcal/g · Fiber = 0 kcal (not counted in energy)
 */

export interface Macros {
  carb_g:    number | null | undefined;
  protein_g: number | null | undefined;
  fat_g:     number | null | undefined;
  fiber_g?:  number | null;
}

export interface MacroBreakdown {
  carb_kcal:    number;
  protein_kcal: number;
  fat_kcal:     number;
  total_kcal:   number;
  carb_pct:     number;
  protein_pct:  number;
  fat_pct:      number;
}

const CARB_KCAL_PER_G    = 4;
const PROTEIN_KCAL_PER_G = 4;
const FAT_KCAL_PER_G     = 9;

export function macroBreakdown(m: Macros): MacroBreakdown {
  const c = Number(m.carb_g    ?? 0);
  const p = Number(m.protein_g ?? 0);
  const f = Number(m.fat_g     ?? 0);
  const carb_kcal    = c * CARB_KCAL_PER_G;
  const protein_kcal = p * PROTEIN_KCAL_PER_G;
  const fat_kcal     = f * FAT_KCAL_PER_G;
  const total_kcal   = carb_kcal + protein_kcal + fat_kcal;

  if (total_kcal === 0) {
    return { carb_kcal: 0, protein_kcal: 0, fat_kcal: 0, total_kcal: 0, carb_pct: 0, protein_pct: 0, fat_pct: 0 };
  }

  return {
    carb_kcal, protein_kcal, fat_kcal, total_kcal,
    carb_pct:    Math.round((carb_kcal    / total_kcal) * 100),
    protein_pct: Math.round((protein_kcal / total_kcal) * 100),
    fat_pct:     Math.round((fat_kcal     / total_kcal) * 100),
  };
}

export interface DayAggregate {
  count:     number;
  total_kcal:    number;
  total_carb_g:    number;
  total_protein_g: number;
  total_fat_g:     number;
  total_fiber_g:   number;
  carb_pct:    number;
  protein_pct: number;
  fat_pct:     number;
  avg_glucose_impact: number;
  avg_health_score:   number;
}

export function aggregateDay(rows: Array<{
  calories_estimate: number | null;
  carb_g:    number | null;
  protein_g: number | null;
  fat_g:     number | null;
  fiber_g:   number | null;
  glucose_impact_score: number | null;
  health_score:         number | null;
}>): DayAggregate {
  let total_kcal = 0, total_carb_g = 0, total_protein_g = 0, total_fat_g = 0, total_fiber_g = 0;
  let gi_sum = 0, gi_count = 0, hs_sum = 0, hs_count = 0;

  for (const r of rows) {
    total_kcal      += Number(r.calories_estimate ?? 0);
    total_carb_g    += Number(r.carb_g    ?? 0);
    total_protein_g += Number(r.protein_g ?? 0);
    total_fat_g     += Number(r.fat_g     ?? 0);
    total_fiber_g   += Number(r.fiber_g   ?? 0);
    if (r.glucose_impact_score != null) { gi_sum += r.glucose_impact_score; gi_count++; }
    if (r.health_score         != null) { hs_sum += r.health_score;         hs_count++; }
  }

  const b = macroBreakdown({ carb_g: total_carb_g, protein_g: total_protein_g, fat_g: total_fat_g });

  return {
    count: rows.length,
    total_kcal: Math.round(total_kcal),
    total_carb_g: Math.round(total_carb_g),
    total_protein_g: Math.round(total_protein_g),
    total_fat_g: Math.round(total_fat_g),
    total_fiber_g: Math.round(total_fiber_g * 10) / 10,
    carb_pct: b.carb_pct,
    protein_pct: b.protein_pct,
    fat_pct: b.fat_pct,
    avg_glucose_impact: gi_count > 0 ? Math.round((gi_sum / gi_count) * 10) / 10 : 0,
    avg_health_score:   hs_count > 0 ? Math.round((hs_sum / hs_count) * 10) / 10 : 0,
  };
}
