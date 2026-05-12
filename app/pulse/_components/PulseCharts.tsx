"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, BarChart, Line, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";

interface Reading {
  recorded_at: string;
  metric_type: string;
  value: number;
  unit: string;
}

interface PulseChartsProps {
  readings: Reading[];
}

const COLOR = {
  hr:       "#DC2626",   // red
  steps:    "#2563EB",   // blue
  sleep:    "#9333EA",   // purple
  active:   "#16A34A",   // green
  calories: "#F97316",   // orange
  weight:   "#0EA5E9",   // sky
  fat:      "#EAB308",   // yellow
  trend:    "#9CA3AF",
};

const TOOLTIP_STYLE = {
  background: "#fff", border: "1px solid #E2E8F0",
  borderRadius: 10, fontSize: 12,
};

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

/* Group readings by day */
interface DailyBucket {
  day: string;
  hr_avg: number | null;
  rhr: number | null;
  hr_max: number | null;
  steps: number;
  sleep_total: number;       // minutes (sum of total/sleep/mixed)
  sleep_deep: number;
  sleep_rem: number;
  active_minutes: number;
  calories_expended: number;
  bmr: number;
  heart_minutes: number;
  weight: number | null;
  body_fat_pct: number | null;
  distance_km: number;
}

function aggregateDaily(readings: Reading[]) {
  const buckets = new Map<string, any>();

  for (const r of readings) {
    const day = r.recorded_at.slice(0, 10);
    let b = buckets.get(day);
    if (!b) {
      b = {
        day,
        hr_avg: null, rhr: null, hr_max: null,
        steps: 0, sleep_total: 0, sleep_deep: 0, sleep_rem: 0,
        active_minutes: 0, calories_expended: 0, bmr: 0, heart_minutes: 0,
        weight: null, body_fat_pct: null, distance_km: 0,
      };
      buckets.set(day, b);
    }
    switch (r.metric_type) {
      case "hr_bpm":            b.hr_avg = r.value; break;
      case "rhr":               b.rhr = r.value; break;
      case "hr_max":            b.hr_max = r.value; break;
      case "steps":             b.steps += r.value; break;
      case "sleep_total":
      case "sleep_minutes":     b.sleep_total += r.value; break;
      case "sleep_light":       b.sleep_total += r.value; break;
      case "sleep_deep":        b.sleep_deep += r.value; b.sleep_total += r.value; break;
      case "sleep_rem":         b.sleep_rem += r.value;  b.sleep_total += r.value; break;
      case "active_minutes":    b.active_minutes += r.value; break;
      case "calories_expended": b.calories_expended += r.value; break;
      case "bmr":               b.bmr = Math.max(b.bmr, r.value); break;
      case "heart_minutes":     b.heart_minutes += r.value; break;
      case "weight":            b.weight = r.value; break;
      case "body_fat_pct":      b.body_fat_pct = r.value; break;
      case "distance_km":       b.distance_km += r.value; break;
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((b) => ({
      ...b,
      day: fmtDay(b.day),
      sleep_hours: +(b.sleep_total / 60).toFixed(1),
      sleep_deep_hours: +(b.sleep_deep / 60).toFixed(1),
      sleep_rem_hours: +(b.sleep_rem / 60).toFixed(1),
    }));
}

export function PulseCharts({ readings }: PulseChartsProps) {
  const data = useMemo(() => aggregateDaily(readings), [readings]);

  if (data.length === 0) {
    return (
      <div className="rounded-2xl bg-surface py-12 text-center font-thai text-sm text-ink-40">
        ยังไม่มีข้อมูล — กด "Sync Now" หรือรอลูกค้าใส่นาฬิกาวัด
      </div>
    );
  }

  // Detect which metrics have data so we don't show empty charts
  const has = {
    hr:        data.some((d) => d.hr_avg != null || d.rhr != null),
    steps:     data.some((d) => d.steps > 0),
    sleep:     data.some((d) => d.sleep_total > 0),
    active:    data.some((d) => d.active_minutes > 0),
    calories:  data.some((d) => d.calories_expended > 0 || d.bmr > 0),
    weight:    data.some((d) => d.weight != null),
    fat:       data.some((d) => d.body_fat_pct != null),
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {has.hr && (
        <ChartPanel title="Heart Rate (avg · resting · max)" color={COLOR.hr}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 16, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} unit=" bpm" domain={["dataMin - 5", "dataMax + 5"]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="hr_avg" name="Avg" stroke={COLOR.hr} strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="rhr"    name="Resting" stroke="#0D9488" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="hr_max" name="Max" stroke="#EAB308" strokeWidth={1.5} strokeDasharray="2 2" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      )}

      {has.steps && (
        <ChartPanel title="Steps (per day)" color={COLOR.steps}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [v.toLocaleString(), "Steps"]} />
              <ReferenceLine y={10000} stroke="#16A34A" strokeDasharray="4 3" strokeWidth={1} label={{ value: "10k", fontSize: 10, fill: "#16A34A", position: "right" }} />
              <Bar dataKey="steps" fill={COLOR.steps} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      )}

      {has.sleep && (
        <ChartPanel title="Sleep · Total · Deep · REM (hours)" color={COLOR.sleep}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} unit="h" domain={[0, "dataMax + 1"]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v} ชม.`, ""]} />
              <ReferenceLine y={7} stroke="#16A34A" strokeDasharray="4 3" strokeWidth={1} label={{ value: "7h", fontSize: 10, fill: "#16A34A", position: "right" }} />
              <Bar dataKey="sleep_hours"      name="Total" fill={COLOR.sleep} radius={[6, 6, 0, 0]} />
              <Bar dataKey="sleep_deep_hours" name="Deep"  fill="#6366F1"    radius={[6, 6, 0, 0]} />
              <Bar dataKey="sleep_rem_hours"  name="REM"   fill="#A78BFA"    radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      )}

      {has.active && (
        <ChartPanel title="Active Minutes · Heart Minutes" color={COLOR.active}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} unit=" min" />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v} min`, ""]} />
              <ReferenceLine y={30} stroke="#16A34A" strokeDasharray="4 3" strokeWidth={1} label={{ value: "30min", fontSize: 10, fill: "#16A34A", position: "right" }} />
              <Bar dataKey="active_minutes" name="Active" fill={COLOR.active}  radius={[6, 6, 0, 0]} />
              <Bar dataKey="heart_minutes"  name="Heart"  fill="#86EFAC"      radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      )}

      {has.calories && (
        <ChartPanel title="Calories · Expended vs BMR" color={COLOR.calories}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} unit=" kcal" />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v} kcal`, ""]} />
              <Bar dataKey="calories_expended" name="Burned" fill={COLOR.calories} radius={[6, 6, 0, 0]} />
              <Bar dataKey="bmr"               name="BMR"    fill="#FED7AA"        radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      )}

      {(has.weight || has.fat) && (
        <ChartPanel title="Body Composition · Weight + Fat%" color={COLOR.weight} fullWidth={!has.calories}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 16, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
              <YAxis yAxisId="left"  stroke={COLOR.weight} fontSize={11} tickLine={false} axisLine={false} unit=" kg" domain={["dataMin - 0.5", "dataMax + 0.5"]} />
              <YAxis yAxisId="right" stroke={COLOR.fat}    fontSize={11} tickLine={false} axisLine={false} unit="%"   orientation="right" domain={["dataMin - 1", "dataMax + 1"]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line yAxisId="left"  type="monotone" dataKey="weight"       name="Weight (kg)" stroke={COLOR.weight} strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
              <Line yAxisId="right" type="monotone" dataKey="body_fat_pct" name="Body Fat %"  stroke={COLOR.fat}    strokeWidth={2}  strokeDasharray="4 3" dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      )}
    </div>
  );
}

function ChartPanel({ title, color, children, fullWidth }: {
  title: string; color: string; children: React.ReactNode; fullWidth?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-ink-10 bg-white p-5 ${fullWidth ? "lg:col-span-2" : ""}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        <h3 className="font-thai text-[13px] font-bold text-ink">{title}</h3>
      </div>
      <div className="h-56 w-full">{children}</div>
    </div>
  );
}
