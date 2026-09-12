/**
 * Population reference (SPEC-Health-Design §3.4) — "where am I among people my age and sex?"
 *
 * Layer 1 is NHANES 2017–March 2020 (US adults, CDC public domain), rebuilt from
 * microdata by scripts/build-reference.py; only survey-weighted percentiles are
 * shipped. It answers *position*, never *health*: the clinical bands in assess.ts
 * still decide good/watch/attention. Marked clearly as a US population until Thai
 * NHES percentiles are obtained (SPEC-Health-Design §7 Q1).
 */
import table from "./reference/nhanes-2017-2020";

export type Sex = "male" | "female";
export interface Percentile { percentile: number; band: string; n: number; source: string; note: string }

const PCTS: number[] = (table as any).percentiles;
export const REFERENCE_SOURCE: string = (table as any).source;
export const REFERENCE_METRICS: string[] = Object.keys((table as any).metrics);

export const ageBand = (age: number): string | null => (age < 20 ? null : age <= 39 ? "20-39" : age <= 59 ? "40-59" : "60+");

/** Interpolated percentile rank (1–99) of `value` in the sex × age cell; null when we have no cell. */
export function percentileOf(metric: string, value: number, sex: Sex | null, age: number | null): Percentile | null {
  const m = (table as any).metrics[metric];
  if (!m || !sex || age == null) return null;
  const band = ageBand(age); if (!band) return null;
  const cell = m.cells[`${sex}:${band}`]; if (!cell) return null;
  const p: number[] = cell.p;
  let pct: number;
  if (value <= p[0]) pct = PCTS[0] * (value / p[0]);                                   // below p5: scale toward 0
  else if (value >= p[p.length - 1]) pct = PCTS[PCTS.length - 1] + (100 - PCTS[PCTS.length - 1]) * Math.min(1, (value - p[p.length - 1]) / Math.max(1e-9, p[p.length - 1] * 0.5));
  else {
    let i = 0; while (value > p[i + 1]) i++;
    pct = PCTS[i] + (PCTS[i + 1] - PCTS[i]) * ((value - p[i]) / (p[i + 1] - p[i] || 1));
  }
  pct = Math.max(1, Math.min(99, Math.round(pct)));
  return { percentile: pct, band: `${sex === "male" ? "ชาย" : "หญิง"} ${band} ปี`, n: cell.n, source: "NHANES 2017–2020 (สหรัฐ)",
    note: `สูงกว่า ${pct}% ของ${sex === "male" ? "ชาย" : "หญิง"}อายุ ${band} ปีในฐานอ้างอิง (ประชากรสหรัฐ n=${cell.n}) — บอกตำแหน่ง ไม่ใช่เกณฑ์สุขภาพ` };
}
