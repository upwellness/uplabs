/**
 * Health Score · Composite 0-100 for Customer 360 View
 * ─────────────────────────────────────────────────────
 * Formula (locked 24/5/26):
 *   score = BCA × 0.4 + Lab × 0.4 + Recency × 0.2
 *
 * Each sub-score returns 0-100 · gracefully handles missing data.
 * Pure functions · no side effects · easy to test.
 */

export interface BcaInput {
  visceral?:    number | null;
  fat_pct?:     number | null;
  body_age?:    number | null;
  chrono_age?:  number | null;
  gender?:      "male" | "female" | string | null;
}

export interface LabInput {
  hba1c?:       number | null;  // %
  ldl?:         number | null;  // mg/dL
  triglyceride?:number | null;  // mg/dL
  hdl?:         number | null;  // mg/dL
  alt?:         number | null;  // U/L  (ULN = 40)
  ast?:         number | null;  // U/L  (ULN = 40)
}

export interface RecencyInput {
  bca_days?:    number | null;  // days since last BCA
  lab_days?:    number | null;  // days since last lab
  order_days?:  number | null;  // days since last order
}

/* ─── BCA score ──────────────────────────────────────── */
export function bcaScore(input: BcaInput): number | null {
  const subs: number[] = [];

  // Visceral (Omron scale · UP Wellness)
  if (input.visceral != null) {
    const v = input.visceral;
    if (v <= 2)  subs.push(100);
    else if (v <= 5)  subs.push(80);
    else if (v <= 9)  subs.push(60);
    else if (v <= 15) subs.push(35);
    else              subs.push(10);
  }

  // Body fat % vs gender norm
  if (input.fat_pct != null) {
    const f = input.fat_pct;
    const female = input.gender !== "male";
    // Athletic / Fitness / Average / Overweight / Obese
    if (female) {
      if (f < 14)      subs.push(60);      // too low
      else if (f <= 20) subs.push(100);
      else if (f <= 24) subs.push(85);
      else if (f <= 31) subs.push(65);
      else if (f <= 36) subs.push(40);
      else              subs.push(20);
    } else {
      if (f < 6)       subs.push(60);
      else if (f <= 13) subs.push(100);
      else if (f <= 17) subs.push(85);
      else if (f <= 24) subs.push(65);
      else if (f <= 29) subs.push(40);
      else              subs.push(20);
    }
  }

  // Body Age − Chrono Age delta
  if (input.body_age != null && input.chrono_age != null) {
    const d = input.body_age - input.chrono_age;
    if (d <= -5) subs.push(100);
    else if (d <= -2) subs.push(85);
    else if (d <=  2) subs.push(70);
    else if (d <=  5) subs.push(50);
    else              subs.push(25);
  }

  if (subs.length === 0) return null;
  return Math.round(subs.reduce((a, b) => a + b, 0) / subs.length);
}

/* ─── Lab score ──────────────────────────────────────── */
export function labScore(input: LabInput): number | null {
  const subs: number[] = [];

  if (input.hba1c != null) {
    const v = input.hba1c;
    if (v < 5.7) subs.push(100);
    else if (v <= 6.4) subs.push(60);
    else if (v <= 7.5) subs.push(35);
    else               subs.push(15);
  }

  if (input.ldl != null) {
    const v = input.ldl;
    if (v < 100) subs.push(100);
    else if (v <= 130) subs.push(80);
    else if (v <= 160) subs.push(50);
    else               subs.push(25);
  }

  if (input.triglyceride != null) {
    const v = input.triglyceride;
    if (v < 150) subs.push(100);
    else if (v <= 200) subs.push(70);
    else if (v <= 300) subs.push(40);
    else               subs.push(20);
  }

  if (input.hdl != null) {
    const v = input.hdl;
    if (v > 60) subs.push(100);
    else if (v >= 50) subs.push(80);
    else if (v >= 40) subs.push(60);
    else              subs.push(35);
  }

  if (input.alt != null) {
    const ratio = input.alt / 40;  // ULN ≈ 40
    if (ratio <= 1) subs.push(100);
    else if (ratio <= 2) subs.push(60);
    else                 subs.push(25);
  }
  if (input.ast != null) {
    const ratio = input.ast / 40;
    if (ratio <= 1) subs.push(100);
    else if (ratio <= 2) subs.push(60);
    else                 subs.push(25);
  }

  if (subs.length === 0) return null;
  return Math.round(subs.reduce((a, b) => a + b, 0) / subs.length);
}

/* ─── Recency score ──────────────────────────────────── */
export function recencyScore(input: RecencyInput): number | null {
  const subs: number[] = [];

  if (input.bca_days != null) {
    const d = input.bca_days;
    if (d < 30)  subs.push(100);
    else if (d < 60)  subs.push(80);
    else if (d < 90)  subs.push(60);
    else if (d < 180) subs.push(35);
    else              subs.push(15);
  }

  if (input.lab_days != null) {
    const d = input.lab_days;
    if (d < 90)  subs.push(100);
    else if (d < 180) subs.push(80);
    else if (d < 365) subs.push(50);
    else              subs.push(25);
  }

  if (input.order_days != null) {
    const d = input.order_days;
    if (d < 30)  subs.push(100);
    else if (d < 60)  subs.push(85);
    else if (d < 90)  subs.push(65);
    else if (d < 180) subs.push(40);
    else              subs.push(20);
  }

  if (subs.length === 0) return null;
  return Math.round(subs.reduce((a, b) => a + b, 0) / subs.length);
}

/* ─── Composite ──────────────────────────────────────── */
export interface HealthScoreInput {
  bca?:     BcaInput;
  lab?:     LabInput;
  recency?: RecencyInput;
}

export interface HealthScoreResult {
  total:   number | null;   // 0-100 · null if no data at all
  bca:     number | null;
  lab:     number | null;
  recency: number | null;
  sources: { bca: boolean; lab: boolean; recency: boolean };
}

export function healthScore(input: HealthScoreInput): HealthScoreResult {
  const bca     = input.bca     ? bcaScore(input.bca)         : null;
  const lab     = input.lab     ? labScore(input.lab)         : null;
  const recency = input.recency ? recencyScore(input.recency) : null;

  const sources = { bca: bca != null, lab: lab != null, recency: recency != null };

  // Weighted average · skip null sources · re-normalize weights
  const items: { v: number; w: number }[] = [];
  if (bca     != null) items.push({ v: bca,     w: 0.4 });
  if (lab     != null) items.push({ v: lab,     w: 0.4 });
  if (recency != null) items.push({ v: recency, w: 0.2 });

  if (items.length === 0) {
    return { total: null, bca, lab, recency, sources };
  }

  const totalWeight = items.reduce((a, x) => a + x.w, 0);
  const weighted    = items.reduce((a, x) => a + x.v * x.w, 0);
  const total       = Math.round(weighted / totalWeight);

  return { total, bca, lab, recency, sources };
}
