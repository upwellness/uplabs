/**
 * Wearable window — daily rows + the 14-day summary the assessment engine reads.
 * Whoop daily rows first (richest); otherwise generic pulse_readings (Apple Health /
 * Google Fit imports). No grading here — assess.ts decides.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { shiftDate, todayBangkok } from "@/lib/api/cgm-data";
import type { WearableSummary } from "./assess";

export interface WearableDay { date: string; sleep_min: number | null; hrv: number | null; rhr: number | null; steps: number | null; recovery_pct: number | null; strain?: number | null }

const avg = (xs: (number | null | undefined)[]): number | null => {
  const v = xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};

export async function wearableWindow(customerId: string, days: number, sinceDate?: string): Promise<{ from: string; to: string; source: string | null; days: WearableDay[]; summary: WearableSummary | null }> {
  const admin = createAdminClient();
  const today = todayBangkok();
  const since = sinceDate ?? shiftDate(today, -days);

  const { data: whoop } = await admin.from("whoop_daily")
    .select("cycle_date, recovery, rhr, hrv, asleep_min, strain").eq("customer_id", customerId)
    .gte("cycle_date", since).order("cycle_date", { ascending: true }).limit(days + 1);
  if (whoop && whoop.length) {
    const rows: WearableDay[] = (whoop as any[]).map((x) => ({ date: x.cycle_date, sleep_min: x.asleep_min, hrv: x.hrv == null ? null : Number(x.hrv), rhr: x.rhr == null ? null : Number(x.rhr), steps: null, recovery_pct: x.recovery == null ? null : Number(x.recovery), strain: x.strain == null ? null : Number(x.strain) }));
    return { from: since, to: today, source: "Whoop", days: rows, summary: {
      source: "Whoop", days: rows.length, from: rows[0].date, to: rows[rows.length - 1].date,
      avg_sleep_min: avg(rows.map((r) => r.sleep_min)), avg_hrv: avg(rows.map((r) => r.hrv)), avg_rhr: avg(rows.map((r) => r.rhr)),
      avg_steps: null, avg_recovery_pct: avg(rows.map((r) => r.recovery_pct)),
    } };
  }

  const { data: pr } = await admin.from("pulse_readings").select("recorded_at, metric_type, value")
    .eq("customer_id", customerId).gte("recorded_at", `${since}T00:00:00Z`).order("recorded_at", { ascending: true }).limit(3000);
  if (!pr || pr.length === 0) return { from: since, to: today, source: null, days: [], summary: null };

  const byDay = new Map<string, Record<string, number[]>>();
  for (const x of pr as any[]) {
    const d = String(x.recorded_at).slice(0, 10);
    const rec = byDay.get(d) ?? byDay.set(d, {}).get(d)!;
    (rec[x.metric_type] ??= []).push(Number(x.value));
  }
  const rows: WearableDay[] = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, m]) => ({
    date, sleep_min: m.sleep_minutes ? Math.max(...m.sleep_minutes) : null, hrv: avg(m.hrv_rmssd ?? []), rhr: avg(m.rhr ?? []),
    steps: m.steps ? Math.max(...m.steps) : null, recovery_pct: null,
  }));
  return { from: since, to: today, source: "wearable", days: rows, summary: {
    source: "wearable", days: rows.length, from: rows[0].date, to: rows[rows.length - 1].date,
    avg_sleep_min: avg(rows.map((r) => r.sleep_min)), avg_hrv: avg(rows.map((r) => r.hrv)), avg_rhr: avg(rows.map((r) => r.rhr)),
    avg_steps: avg(rows.map((r) => r.steps)), avg_recovery_pct: null,
  } };
}
