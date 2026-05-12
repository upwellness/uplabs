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
  hr:    "#DC2626",   // red
  steps: "#2563EB",   // blue
  sleep: "#9333EA",   // purple
  trend: "#9CA3AF",
};

const TOOLTIP_STYLE = {
  background: "#fff", border: "1px solid #E2E8F0",
  borderRadius: 10, fontSize: 12,
};

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

/* Group readings by day → { day, hr_avg, steps, sleep_minutes } */
function aggregateDaily(readings: Reading[]) {
  const buckets = new Map<string, {
    day: string;
    hr_values: number[];
    steps: number;
    sleep_minutes: number;
  }>();

  for (const r of readings) {
    const day = r.recorded_at.slice(0, 10); // yyyy-mm-dd
    let b = buckets.get(day);
    if (!b) {
      b = { day, hr_values: [], steps: 0, sleep_minutes: 0 };
      buckets.set(day, b);
    }
    if (r.metric_type === "hr_bpm" || r.metric_type === "rhr") b.hr_values.push(r.value);
    else if (r.metric_type === "steps")        b.steps += r.value;
    else if (r.metric_type === "sleep_minutes") b.sleep_minutes += r.value;
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((b) => ({
      day: fmtDay(b.day),
      hr_avg: b.hr_values.length ? +(b.hr_values.reduce((a, x) => a + x, 0) / b.hr_values.length).toFixed(1) : null,
      steps: b.steps,
      sleep_hours: +(b.sleep_minutes / 60).toFixed(1),
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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartPanel title="Heart Rate (avg bpm)" color={COLOR.hr}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
            <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} unit=" bpm" domain={["dataMin - 5", "dataMax + 5"]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v} bpm`, "HR"]} />
            <Line type="monotone" dataKey="hr_avg" stroke={COLOR.hr} strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartPanel>

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

      <ChartPanel title="Sleep (hours)" color={COLOR.sleep} fullWidth>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
            <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} unit="h" domain={[0, "dataMax + 1"]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [`${v} ชม.`, "Sleep"]} />
            <ReferenceLine y={7} stroke="#16A34A" strokeDasharray="4 3" strokeWidth={1} label={{ value: "7h optimal", fontSize: 10, fill: "#16A34A", position: "right" }} />
            <Bar dataKey="sleep_hours" fill={COLOR.sleep} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>
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
