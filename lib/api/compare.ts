/**
 * Pure lab-comparison maths — no database, no network.
 *
 * Split out of data.ts on purpose: this is the logic that decides what "เทียบ 3 รอบ"
 * actually means, and it earns a test suite that runs in milliseconds without a
 * Supabase connection. data.ts fetches; this file reasons.
 */

export interface LabValue {
  metric_key: string;
  metric_label_th: string | null;
  value: string | null;
  value_num: number | null;
  unit: string | null;
  status: string | null;
  category: string | null;
  ref_text: string | null;
  recorded_at: string;
}

export interface LabRound {
  recorded_at: string;
  source: string | null;
  notes: string | null;
  values: LabValue[];
}

export function ageFrom(birth: string | null | undefined): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

export interface LabRound {
  recorded_at: string;
  source: string | null;
  notes: string | null;
  values: LabValue[];
}

export interface CompareMetric {
  metric_key: string;
  label_th: string | null;
  unit: string | null;
  category: string | null;
  ref_text: string | null;
  /** Aligned 1:1 with `rounds`. `null` = not measured that round. */
  values: (number | string | null)[];
  status: (string | null)[];
  delta: { from: number; to: number; change: number; pct: number | null; direction: "up" | "down" | "same" } | null;
}

export function buildCompare(rounds: LabRound[]) {
  const keys: string[] = [];
  for (const r of rounds) for (const v of r.values) if (!keys.includes(v.metric_key)) keys.push(v.metric_key);

  const metrics: CompareMetric[] = keys.map((key) => {
    const per = rounds.map((r) => r.values.find((v) => v.metric_key === key) ?? null);
    const first = per.find(Boolean) as LabValue | undefined;
    const nums = per.map((v) => (v && v.value_num != null ? v.value_num : null));

    // delta = the last two rounds that actually have a number for this metric
    const idx: number[] = [];
    nums.forEach((n, i) => { if (n != null) idx.push(i); });
    let delta: CompareMetric["delta"] = null;
    if (idx.length >= 2) {
      const a = nums[idx[idx.length - 2]] as number;
      const b = nums[idx[idx.length - 1]] as number;
      const change = round2(b - a);
      delta = {
        from: a, to: b, change,
        pct: a === 0 ? null : round1(((b - a) / Math.abs(a)) * 100),
        direction: change > 0 ? "up" : change < 0 ? "down" : "same",
      };
    }

    return {
      metric_key: key,
      label_th: first?.metric_label_th ?? null,
      unit: first?.unit ?? null,
      category: first?.category ?? null,
      ref_text: first?.ref_text ?? null,
      values: per.map((v) => (v ? (v.value_num != null ? v.value_num : v.value) : null)),
      status: per.map((v) => v?.status ?? null),
      delta,
    };
  });

  const latest = rounds[rounds.length - 1];
  return {
    rounds: rounds.map((r) => ({ recorded_at: r.recorded_at, source: r.source, notes: r.notes, value_count: r.values.length })),
    metrics,
    summary: {
      rounds_returned: rounds.length,
      metrics_covered: metrics.length,
      abnormal_in_latest: (latest?.values ?? []).filter((v) => v.status && v.status !== "normal").length,
      improved: metrics.filter((m) => m.delta && isBetter(m, m.delta)).length,
      worsened: metrics.filter((m) => m.delta && isWorse(m, m.delta)).length,
    },
    note: "ค่า null = รอบนั้นไม่ได้ตรวจตัวนี้ (ไม่ใช่ค่าศูนย์ และไม่ได้ยกค่าจากรอบก่อนมาใส่)",
  };
}

/**
 * "Better" here is movement toward the reference range recorded on the lab slip —
 * not a clinical judgement. HDL going up is good, LDL going up is not, and the only
 * thing we can honestly infer is direction relative to the printed range.
 */
const HIGHER_IS_BETTER = new Set(["hdl", "egfr", "albumin", "hemoglobin", "lymphocyte"]);

function isBetter(m: CompareMetric, d: NonNullable<CompareMetric["delta"]>) {
  if (d.direction === "same") return false;
  return HIGHER_IS_BETTER.has(m.metric_key) ? d.direction === "up" : d.direction === "down";
}
function isWorse(m: CompareMetric, d: NonNullable<CompareMetric["delta"]>) {
  if (d.direction === "same") return false;
  return !isBetter(m, d);
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
