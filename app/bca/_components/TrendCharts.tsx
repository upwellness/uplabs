"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, LabelList, Legend,
} from "recharts";
import type { MeasurementWithDerived, Gender } from "@/lib/types";

interface TrendChartsProps {
  measurements: MeasurementWithDerived[];
  gender: Gender;
}

const PERIODS = [
  { key: 14,   label: "14 วัน" },
  { key: 30,   label: "1 เดือน" },
  { key: 90,   label: "3 เดือน" },
  { key: 180,  label: "6 เดือน" },
  { key: 365,  label: "1 ปี" },
  { key: 9999, label: "ทั้งหมด" },
] as const;

type PeriodKey = typeof PERIODS[number]["key"];

interface Visibility {
  weight:   boolean;
  fat:      boolean;
  muscle:   boolean;
  visceral: boolean;
  bodyAge:  boolean;
}

const DEFAULT_VIS: Visibility = { weight: true, fat: true, muscle: true, visceral: true, bodyAge: true };

const COLORS = {
  weight:   "#2563EB",  // blue
  fatMass:  "#EAB308",  // yellow
  fatPct:   "#F59E0B",  // amber (lighter)
  muscle:   "#16A34A",  // green
  visceral: "#DC2626",  // red
  bodyAge:  "#9333EA",  // purple
  trend:    "#9CA3AF",  // gray
};

/* ── Linear regression for trend line ── */
function linearRegression(values: (number | null)[]): (number | null)[] {
  const clean = values.map((v, i) => ({ x: i, y: v })).filter((p) => p.y != null) as { x: number; y: number }[];
  const n = clean.length;
  if (n < 2) return values.map(() => null);
  const sumX  = clean.reduce((a, p) => a + p.x, 0);
  const sumY  = clean.reduce((a, p) => a + p.y, 0);
  const sumXY = clean.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = clean.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) {
    const mean = sumY / n;
    return values.map(() => mean);
  }
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return values.map((_, i) => +(slope * i + intercept).toFixed(1));
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

const labelFmt = (v: any) => {
  if (v == null || v === 0) return "";
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".0", "");
};

const TOOLTIP_STYLE = {
  background: "#18151A",
  border: "none",
  borderRadius: 10,
  color: "white",
  fontSize: 12,
  fontFamily: "var(--font-jetbrains)",
};

export function TrendCharts({ measurements, gender }: TrendChartsProps) {
  const [period, setPeriod] = useState<PeriodKey>(180);
  const [vis,    setVis]    = useState<Visibility>(DEFAULT_VIS);

  /* ── Filter by period + reverse (oldest → newest) ── */
  const data = useMemo(() => {
    const cutoff = period === 9999 ? null : Date.now() - period * 24 * 60 * 60 * 1000;
    const filtered = cutoff
      ? measurements.filter((m) => new Date(m.recorded_at).getTime() >= cutoff)
      : measurements;

    const sorted = [...filtered].reverse(); // measurements come desc; reverse → asc

    const rows = sorted.map((m) => ({
      date:       fmtDate(m.recorded_at),
      weight:     m.weight,
      fat_pct:    m.fat_pct,
      fat_mass:   m.fat_mass,
      muscle_pct: m.muscle_pct,
      visceral:   m.visceral,
      body_age:   m.body_age,
      chrono_age: m.chrono_age,
    }));

    // Compute trend lines
    const wTrend  = linearRegression(rows.map((r) => r.weight));
    const fmTrend = linearRegression(rows.map((r) => r.fat_mass));
    const muTrend = linearRegression(rows.map((r) => r.muscle_pct));
    const viTrend = linearRegression(rows.map((r) => r.visceral));
    const baTrend = linearRegression(rows.map((r) => r.body_age));

    return rows.map((r, i) => ({
      ...r,
      weight_trend:   wTrend[i],
      fat_mass_trend: fmTrend[i],
      muscle_trend:   muTrend[i],
      visceral_trend: viTrend[i],
      body_age_trend: baTrend[i],
    }));
  }, [measurements, period]);

  const toggle = (k: keyof Visibility) => setVis((v) => ({ ...v, [k]: !v[k] }));

  return (
    <div>
      {/* ── Period filter ── */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-full border px-3.5 py-1 text-[11px] font-semibold transition-all ${
              period === p.key
                ? "border-rose bg-rose text-white"
                : "border-ink-10 bg-white text-ink-60 hover:border-ink-20"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Visibility toggles ── */}
      <div className="mb-6 flex flex-wrap gap-x-4 gap-y-2 border-b border-ink-5 pb-4">
        <VisCheck label="น้ำหนัก"     color={COLORS.weight}   checked={vis.weight}   onChange={() => toggle("weight")} />
        <VisCheck label="ไขมัน"        color={COLORS.fatMass}  checked={vis.fat}      onChange={() => toggle("fat")} />
        <VisCheck label="กล้ามเนื้อ"  color={COLORS.muscle}   checked={vis.muscle}   onChange={() => toggle("muscle")} />
        <VisCheck label="Visceral"    color={COLORS.visceral} checked={vis.visceral} onChange={() => toggle("visceral")} />
        <VisCheck label="Body Age"    color={COLORS.bodyAge}  checked={vis.bodyAge}  onChange={() => toggle("bodyAge")} />
      </div>

      {data.length === 0 ? (
        <div className="py-16 text-center font-thai text-sm text-ink-40">
          ไม่มีข้อมูลในช่วงเวลานี้
        </div>
      ) : (
        <div className="space-y-5">
          {vis.weight   && <ChartPanel title="น้ำหนัก (kg)"><WeightChart data={data} /></ChartPanel>}
          {vis.fat      && <ChartPanel title="ไขมัน — Fat Mass & % Fat"><FatChart data={data} /></ChartPanel>}
          {vis.muscle   && <ChartPanel title="กล้ามเนื้อ (%)"><MuscleChart data={data} /></ChartPanel>}
          {vis.visceral && <ChartPanel title="Visceral Fat (level)"><VisceralChart data={data} /></ChartPanel>}
          {vis.bodyAge  && <ChartPanel title="Body Age (ปี)"><BodyAgeChart data={data} /></ChartPanel>}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────── */

function VisCheck({ label, color, checked, onChange }: {
  label: string; color: string; checked: boolean; onChange: () => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-ink-60">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded border-ink-20 accent-current"
        style={{ accentColor: color }}
      />
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </label>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-ink-10 bg-white p-5">
      <div className="mb-3 font-thai text-[14px] font-bold text-ink">{title}</div>
      <div className="h-72 w-full">{children}</div>
    </div>
  );
}

/* ── Individual charts ──────────────────────────── */

function WeightChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 24, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#F2F0F3" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#8A838E" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
        <YAxis stroke="#8A838E" fontSize={11} tickLine={false} axisLine={false} unit=" kg" domain={["dataMin - 1", "dataMax + 1"]} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 4 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="weight_trend" name="แนวโน้ม" stroke={COLORS.trend} strokeWidth={1} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="weight" name="น้ำหนัก" stroke={COLORS.weight} strokeWidth={2.5}
          dot={{ r: 4, fill: COLORS.weight, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls>
          <LabelList dataKey="weight" position="top" formatter={labelFmt} fontSize={10} fill={COLORS.weight} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function FatChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 24, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#F2F0F3" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#8A838E" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
        <YAxis yAxisId="left"  stroke={COLORS.fatMass} fontSize={11} tickLine={false} axisLine={false} unit=" kg" domain={["dataMin - 1", "dataMax + 1"]} />
        <YAxis yAxisId="right" stroke={COLORS.fatPct}  fontSize={11} tickLine={false} axisLine={false} unit="%"   orientation="right" domain={["dataMin - 1", "dataMax + 1"]} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 4 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line yAxisId="left" type="monotone" dataKey="fat_mass_trend" name="แนวโน้ม Fat Mass" stroke={COLORS.trend} strokeWidth={1} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
        <Line yAxisId="left" type="monotone" dataKey="fat_mass" name="Fat Mass (kg)" stroke={COLORS.fatMass} strokeWidth={2.5}
          dot={{ r: 4, fill: COLORS.fatMass, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls>
          <LabelList dataKey="fat_mass" position="top" formatter={labelFmt} fontSize={10} fill={COLORS.fatMass} />
        </Line>
        <Line yAxisId="right" type="monotone" dataKey="fat_pct" name="% Fat" stroke={COLORS.fatPct} strokeWidth={2}
          strokeDasharray="3 3" dot={{ r: 3, fill: COLORS.fatPct, strokeWidth: 0 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function MuscleChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 24, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#F2F0F3" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#8A838E" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
        <YAxis stroke="#8A838E" fontSize={11} tickLine={false} axisLine={false} unit="%" domain={["dataMin - 1", "dataMax + 1"]} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 4 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="muscle_trend" name="แนวโน้ม" stroke={COLORS.trend} strokeWidth={1} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="muscle_pct" name="กล้ามเนื้อ %" stroke={COLORS.muscle} strokeWidth={2.5}
          dot={{ r: 4, fill: COLORS.muscle, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls>
          <LabelList dataKey="muscle_pct" position="top" formatter={labelFmt} fontSize={10} fill={COLORS.muscle} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function VisceralChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 24, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#F2F0F3" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#8A838E" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
        <YAxis stroke="#8A838E" fontSize={11} tickLine={false} axisLine={false} domain={[0, "dataMax + 2"]} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 4 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="visceral_trend" name="แนวโน้ม" stroke={COLORS.trend} strokeWidth={1} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="visceral" name="Visceral" stroke={COLORS.visceral} strokeWidth={2.5}
          dot={{ r: 4, fill: COLORS.visceral, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls>
          <LabelList dataKey="visceral" position="top" formatter={labelFmt} fontSize={10} fill={COLORS.visceral} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function BodyAgeChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 24, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#F2F0F3" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#8A838E" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
        <YAxis stroke="#8A838E" fontSize={11} tickLine={false} axisLine={false} unit=" yr" domain={["dataMin - 2", "dataMax + 2"]} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 4 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="chrono_age" name="อายุจริง" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="3 3" dot={false} connectNulls />
        <Line type="monotone" dataKey="body_age_trend" name="แนวโน้ม" stroke={COLORS.trend} strokeWidth={1} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="body_age" name="Body Age" stroke={COLORS.bodyAge} strokeWidth={2.5}
          dot={{ r: 4, fill: COLORS.bodyAge, strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls>
          <LabelList dataKey="body_age" position="top" formatter={labelFmt} fontSize={10} fill={COLORS.bodyAge} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
