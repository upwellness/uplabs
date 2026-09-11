/**
 * CGM summary metrics — the numbers an assistant needs to talk about a person's glucose.
 *
 * Definitions follow the International Consensus on Time in Range (Battelino et al.,
 * Diabetes Care 2019) and ADA Standards of Care: time-in-range bands, %CV, GMI, and
 * the 14-day / ≥70% data rule before any of it should be trusted.
 *
 * Pure. Readings in, numbers out. Every percentage is share-of-readings, which for a
 * 5-minute sensor is share-of-time to well within rounding.
 */

export interface Point { t: number; v: number }   // epoch ms · mg/dL

export const TARGETS = {
  tir_70_180: { min: 70 },
  tbr_below_70: { max: 4 },
  tbr_below_54: { max: 1 },
  tar_above_180: { max: 25 },
  tar_above_250: { max: 5 },
  cv: { max: 36 },
  days_min: 14,
  completeness_min: 70,
} as const;

export interface DayMetrics {
  date: string; n: number; mean: number; min: number; max: number;
  tir_70_180: number; titr_70_140: number; tbr_below_70: number; tar_above_180: number;
}

export interface CgmMetrics {
  n: number;
  from: string | null;
  to: string | null;
  days: number;
  completeness_pct: number;
  reliable: boolean;                // ≥14 days AND ≥70% — per ADA/consensus
  mean: number | null;
  sd: number | null;
  cv: number | null;
  gmi: number | null;               // 3.31 + 0.02392 × mean (Bergenstal 2018)
  min: number | null;
  max: number | null;
  tir_70_180: number | null;
  titr_70_140: number | null;
  tar_above_180: number | null;
  tar_above_250: number | null;
  tbr_below_70: number | null;
  tbr_below_54: number | null;
  /** Nightly (00:00–06:00 local) share below 70 — the low nobody feels. */
  nocturnal_tbr_below_70: number | null;
  low_events: number;               // runs of ≥15 min below 70
  meets: Record<string, boolean | null>;
  per_day: DayMetrics[];
  caveats: string[];
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const pct = (k: number, n: number) => (n ? r1((k / n) * 100) : 0);
const BKK_MS = 7 * 3_600_000;
const localDate = (ms: number) => new Date(ms + BKK_MS).toISOString().slice(0, 10);
const localHour = (ms: number) => new Date(ms + BKK_MS).getUTCHours();

/** Count separate episodes of ≥15 consecutive minutes below 70 mg/dL. */
export function countLowEvents(pts: Point[], threshold = 70, minMinutes = 15): number {
  let events = 0, runStart: number | null = null, prev: Point | null = null;
  for (const p of pts) {
    const low = p.v < threshold;
    // A gap > 20 min breaks a run — we cannot claim continuity across missing data.
    if (prev && p.t - prev.t > 20 * 60_000) runStart = null;
    if (low) {
      if (runStart === null) runStart = p.t;
      else if (p.t - runStart >= minMinutes * 60_000 && runStart !== -1) { events++; runStart = -1; }
    } else runStart = null;
    prev = p;
  }
  return events;
}

export function computeMetrics(input: Point[]): CgmMetrics {
  const pts = input.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v)).sort((a, b) => a.t - b.t);
  const n = pts.length;
  const base: CgmMetrics = {
    n, from: null, to: null, days: 0, completeness_pct: 0, reliable: false,
    mean: null, sd: null, cv: null, gmi: null, min: null, max: null,
    tir_70_180: null, titr_70_140: null, tar_above_180: null, tar_above_250: null,
    tbr_below_70: null, tbr_below_54: null, nocturnal_tbr_below_70: null, low_events: 0,
    meets: {}, per_day: [], caveats: [],
  };
  if (n === 0) { base.caveats.push("ไม่มีข้อมูล"); return base; }

  const vals = pts.map((p) => p.v);
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1)) : 0;
  const cv = mean ? (sd / mean) * 100 : 0;

  const byDay = new Map<string, Point[]>();
  for (const p of pts) { const d = localDate(p.t); (byDay.get(d) ?? byDay.set(d, []).get(d)!).push(p); }
  const days = byDay.size;
  const spanMin = (pts[n - 1].t - pts[0].t) / 60_000;
  const expected = Math.max(1, Math.round(spanMin / 5) + 1);
  const completeness = Math.min(100, r1((n / expected) * 100));

  const c = (f: (v: number) => boolean) => vals.filter(f).length;
  const night = pts.filter((p) => localHour(p.t) < 6);

  const m: CgmMetrics = {
    ...base,
    from: new Date(pts[0].t + BKK_MS).toISOString().slice(0, 16).replace("T", " "),
    to: new Date(pts[n - 1].t + BKK_MS).toISOString().slice(0, 16).replace("T", " "),
    days, completeness_pct: completeness,
    reliable: days >= TARGETS.days_min && completeness >= TARGETS.completeness_min,
    mean: r1(mean), sd: r1(sd), cv: r1(cv), gmi: r1(3.31 + 0.02392 * mean),
    min: Math.min(...vals), max: Math.max(...vals),
    tir_70_180: pct(c((v) => v >= 70 && v <= 180), n),
    titr_70_140: pct(c((v) => v >= 70 && v <= 140), n),
    tar_above_180: pct(c((v) => v > 180), n),
    tar_above_250: pct(c((v) => v > 250), n),
    tbr_below_70: pct(c((v) => v < 70), n),
    tbr_below_54: pct(c((v) => v < 54), n),
    nocturnal_tbr_below_70: night.length ? pct(night.filter((p) => p.v < 70).length, night.length) : null,
    low_events: countLowEvents(pts),
    per_day: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, dp]) => {
      const dv = dp.map((p) => p.v); const dn = dv.length;
      return {
        date, n: dn, mean: r1(dv.reduce((a, b) => a + b, 0) / dn), min: Math.min(...dv), max: Math.max(...dv),
        tir_70_180: pct(dv.filter((v) => v >= 70 && v <= 180).length, dn),
        titr_70_140: pct(dv.filter((v) => v >= 70 && v <= 140).length, dn),
        tbr_below_70: pct(dv.filter((v) => v < 70).length, dn),
        tar_above_180: pct(dv.filter((v) => v > 180).length, dn),
      };
    }),
  };

  m.meets = {
    tir_70_180: m.tir_70_180! >= TARGETS.tir_70_180.min,
    tbr_below_70: m.tbr_below_70! < TARGETS.tbr_below_70.max,
    tbr_below_54: m.tbr_below_54! < TARGETS.tbr_below_54.max,
    tar_above_180: m.tar_above_180! < TARGETS.tar_above_180.max,
    tar_above_250: m.tar_above_250! < TARGETS.tar_above_250.max,
    cv: m.cv! <= TARGETS.cv.max,
  };

  if (!m.reliable) {
    m.caveats.push(
      `ข้อมูล ${days} วัน · ครบ ${completeness}% — เกณฑ์สากลให้เชื่อตัวเลขสรุปเมื่อมีอย่างน้อย ${TARGETS.days_min} วันและข้อมูล ≥${TARGETS.completeness_min}% (ADA/Battelino 2019) · ตอนนี้ใช้ดูแนวโน้มได้ แต่อย่าเทียบเกณฑ์`,
    );
  }
  if (m.tbr_below_54! > 0) m.caveats.push("มีค่าต่ำกว่า 54 mg/dL — ค่าต่ำจากเซ็นเซอร์ (โดยเฉพาะตอนนอนทับ) ต้องยืนยันด้วยการเจาะปลายนิ้วก่อนสรุป");
  m.caveats.push("เป้า 70–180 / TBR / CV ข้างต้นเป็นเกณฑ์สำหรับผู้เป็นเบาหวาน · ยังไม่มีเกณฑ์ทางการสำหรับคนไม่เป็นเบาหวาน · GMI เป็นค่าประมาณ ไม่ใช่ HbA1c จากการเจาะเลือด");
  return m;
}
