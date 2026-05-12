"use client";

import { useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine, ReferenceArea,
} from "recharts";
import type { MeasurementWithDerived } from "@/lib/types";
import type { Gender } from "@/lib/types";

interface TrendChartsProps {
  measurements: MeasurementWithDerived[];
  gender: Gender;
}

const TABS = [
  { key: "weight",   label: "น้ำหนัก" },
  { key: "fat",      label: "ไขมัน" },
  { key: "muscle",   label: "กล้ามเนื้อ" },
  { key: "visceral", label: "Visceral Fat" },
  { key: "bodyage",  label: "Body Age" },
] as const;

type TabKey = typeof TABS[number]["key"];

const TOOLTIP_STYLE = {
  background: "#18151A",
  border: "none",
  borderRadius: 10,
  color: "white",
  fontSize: 12,
  fontFamily: "var(--font-jetbrains)",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "2-digit", month: "short" });
}

export function TrendCharts({ measurements, gender }: TrendChartsProps) {
  const [active, setActive] = useState<TabKey>("weight");

  const data = [...measurements].reverse().map((m) => ({
    date:       fmtDate(m.recorded_at),
    weight:     m.weight,
    fat_pct:    m.fat_pct,
    fat_mass:   m.fat_mass,
    muscle_pct: m.muscle_pct,
    visceral:   m.visceral,
    body_age:   m.body_age,
    chrono_age: m.chrono_age,
  }));

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 flex gap-1 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition-all ${
              active === t.key
                ? "bg-ink text-white"
                : "bg-ink-5 text-ink-60 hover:bg-ink-10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="h-72 w-full">
        {active === "weight" && <WeightChart data={data} />}
        {active === "fat"    && <FatChart data={data} gender={gender} />}
        {active === "muscle" && <MuscleChart data={data} gender={gender} />}
        {active === "visceral" && <VisceralChart data={data} />}
        {active === "bodyage"  && <BodyAgeChart data={data} />}
      </div>
    </div>
  );
}

/* ── Panel: Weight ─────────────────────────────────── */
function WeightChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#F2F0F3" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#8A838E" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
        <YAxis stroke="#8A838E" fontSize={11} tickLine={false} axisLine={false} unit=" kg" domain={["auto", "auto"]} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 4 }} formatter={(v: any) => [`${v} kg`, "น้ำหนัก"]} />
        <Line type="monotone" dataKey="weight" name="Weight" stroke="#8C4C4C" strokeWidth={2.5}
          dot={{ r: 4, fill: "#8C4C4C", strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Panel: Fat ────────────────────────────────────── */
function FatChart({ data, gender }: { data: any[]; gender: Gender }) {
  // ACE healthy fat % range
  const [optLow, optHigh] = gender === "male" ? [14, 24] : [21, 31];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#F2F0F3" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#8A838E" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
        <YAxis stroke="#8A838E" fontSize={11} tickLine={false} axisLine={false} unit="%" domain={[0, gender === "male" ? 40 : 50]} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 4 }}
          formatter={(v: any, name: string) => [name === "fat_pct" ? `${v}%` : `${v} kg`, name === "fat_pct" ? "Body Fat %" : "Fat Mass"]} />
        {/* Healthy range shading */}
        <ReferenceArea y1={optLow} y2={optHigh} fill="#16A34A" fillOpacity={0.07} />
        <ReferenceLine y={optHigh} stroke="#16A34A" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Healthy max", fontSize: 10, fill: "#16A34A", position: "right" }} />
        <Line type="monotone" dataKey="fat_pct" name="fat_pct" stroke="#DC2626" strokeWidth={2.5}
          dot={{ r: 4, fill: "#DC2626", strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
        <Line type="monotone" dataKey="fat_mass" name="fat_mass" stroke="#F97316" strokeWidth={1.5}
          strokeDasharray="5 3" dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Panel: Muscle ─────────────────────────────────── */
function MuscleChart({ data, gender }: { data: any[]; gender: Gender }) {
  const [normLow, normHigh] = gender === "male" ? [40, 44] : [31, 35];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#F2F0F3" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#8A838E" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
        <YAxis stroke="#8A838E" fontSize={11} tickLine={false} axisLine={false} unit="%" domain={[gender === "male" ? 25 : 18, gender === "male" ? 55 : 45]} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 4 }}
          formatter={(v: any) => [`${v}%`, "Muscle %"]} />
        <ReferenceArea y1={normLow} y2={normHigh} fill="#2A7B8F" fillOpacity={0.08} />
        <ReferenceLine y={normLow} stroke="#2A7B8F" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Normal low", fontSize: 10, fill: "#2A7B8F", position: "right" }} />
        <Line type="monotone" dataKey="muscle_pct" name="Muscle %" stroke="#2A7B8F" strokeWidth={2.5}
          dot={{ r: 4, fill: "#2A7B8F", strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Panel: Visceral Fat ───────────────────────────── */
function VisceralChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#F2F0F3" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#8A838E" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
        <YAxis stroke="#8A838E" fontSize={11} tickLine={false} axisLine={false} domain={[1, 20]} ticks={[1, 3, 5, 7, 9, 12, 14, 17, 20]} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 4 }}
          formatter={(v: any) => [`Lv. ${v}`, "Visceral Fat"]} />
        {/* Safe zone */}
        <ReferenceArea y1={1} y2={9} fill="#16A34A" fillOpacity={0.07} />
        <ReferenceLine y={9}  stroke="#16A34A" strokeDasharray="4 3" strokeWidth={1} label={{ value: "Optimal ≤9", fontSize: 10, fill: "#16A34A", position: "right" }} />
        <ReferenceLine y={12} stroke="#EAB308" strokeDasharray="4 3" strokeWidth={1} label={{ value: "High >12", fontSize: 10, fill: "#EAB308", position: "right" }} />
        <Line type="monotone" dataKey="visceral" name="Visceral" stroke="#F97316" strokeWidth={2.5}
          dot={{ r: 4, fill: "#F97316", strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Panel: Body Age ───────────────────────────────── */
function BodyAgeChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#F2F0F3" strokeDasharray="3 3" />
        <XAxis dataKey="date" stroke="#8A838E" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
        <YAxis stroke="#8A838E" fontSize={11} tickLine={false} axisLine={false} unit=" yr" domain={["auto", "auto"]} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 4 }}
          formatter={(v: any, name: string) => [`${v} yr`, name === "body_age" ? "Body Age" : "อายุจริง"]} />
        <Line type="monotone" dataKey="chrono_age" name="chrono_age" stroke="#9CA3AF" strokeWidth={1.5}
          strokeDasharray="5 3" dot={false} connectNulls />
        <Line type="monotone" dataKey="body_age" name="body_age" stroke="#8C4C4C" strokeWidth={2.5}
          dot={{ r: 4, fill: "#8C4C4C", strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
