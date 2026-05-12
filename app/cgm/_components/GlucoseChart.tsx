"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceArea, ReferenceLine,
} from "recharts";
import type { CGMReading, CGMMeal } from "@/lib/types-cgm";

interface GlucoseChartProps {
  readings: CGMReading[];
  meals:    CGMMeal[];
  height?:  number;
}

/* ── Formatters ─────────────────────────────────── */
const fmtTime = (d: Date) =>
  d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
const fmtDateTime = (d: Date) =>
  d.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

/* ── Custom Tooltip ─────────────────────────────── */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0].value;
  return (
    <div className="rounded-xl border border-ink-10 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
      <div className="font-mono text-[11px] text-ink-40">{fmtDateTime(new Date(label))}</div>
      <div className="mt-0.5">
        <span className="font-head text-[20px] font-extrabold text-teal-600">{value}</span>
        <span className="ml-1 font-mono text-[10px] text-ink-40">mg/dL</span>
      </div>
    </div>
  );
}

export function GlucoseChart({ readings, meals, height = 380 }: GlucoseChartProps) {
  const { data, domainX, domainY, useShortTime } = useMemo(() => {
    if (readings.length === 0) {
      return { data: [], domainX: [0, 1] as [number, number], domainY: [40, 200] as [number, number], useShortTime: true };
    }
    const rows = readings.map((r) => ({ timestamp: r.reading_timestamp, glucose: r.glucose }));
    const minTs = rows[0].timestamp;
    const maxTs = rows[rows.length - 1].timestamp;
    const spanH = (maxTs - minTs) / (3600 * 1000);
    const maxG  = Math.max(...readings.map((r) => r.glucose));
    return {
      data: rows,
      domainX: [minTs, maxTs] as [number, number],
      domainY: [40, Math.max(200, maxG + 20)] as [number, number],
      useShortTime: spanH < 24,
    };
  }, [readings]);

  if (readings.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="font-thai text-sm text-ink-40">ไม่มีข้อมูล glucose ในช่วงเวลานี้</div>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={domainX}
            tickFormatter={(v) => useShortTime ? fmtTime(new Date(v)) : fmtDateTime(new Date(v))}
            stroke="#94A3B8"
            fontSize={11}
            tickLine={false}
            minTickGap={50}
            axisLine={{ stroke: "#DDD9DF" }}
          />
          <YAxis
            domain={domainY}
            stroke="#94A3B8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickCount={6}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#94A3B8", strokeWidth: 1, strokeDasharray: "3 3" }} />

          {/* Subtle optimal zone shading */}
          <ReferenceArea y1={70} y2={110} fill="#10B981" fillOpacity={0.06} />
          {/* High threshold line (140) */}
          <ReferenceLine y={140} stroke="#F59E0B" strokeDasharray="3 3" opacity={0.5} />
          {/* Low threshold line (70) */}
          <ReferenceLine y={70}  stroke="#EF4444" strokeDasharray="3 3" opacity={0.3} />

          {/* Meal markers as vertical lines */}
          {meals.map((m) => (
            <ReferenceLine
              key={m.id}
              x={m.meal_timestamp}
              stroke="#FB7185"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              label={{ position: "insideTopLeft", value: "🍽️", fill: "#FB7185", fontSize: 14 }}
            />
          ))}

          {/* Glucose line — teal, clean, no per-point dots */}
          <Line
            type="monotone"
            dataKey="glucose"
            stroke="#14B8A6"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: "#0D9488", strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
