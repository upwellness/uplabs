"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceArea, ReferenceLine, Scatter,
} from "recharts";
import type { CGMReading, CGMMeal } from "@/lib/types-cgm";

interface GlucoseChartProps {
  readings: CGMReading[];
  meals:    CGMMeal[];
  height?:  number;
}

const TOOLTIP_STYLE = {
  background: "#18151A",
  border: "none",
  borderRadius: 10,
  color: "white",
  fontSize: 12,
  fontFamily: "var(--font-jetbrains)",
};

export function GlucoseChart({ readings, meals, height = 320 }: GlucoseChartProps) {
  // Build merged data: glucose readings + meal markers as scatter
  const { glucoseData, mealData, tickFmt, domain } = useMemo(() => {
    if (readings.length === 0) {
      return { glucoseData: [], mealData: [], tickFmt: (v: number) => "", domain: [0, 0] };
    }
    const minTs = readings[0].reading_timestamp;
    const maxTs = readings[readings.length - 1].reading_timestamp;
    const spanH = (maxTs - minTs) / (60 * 60 * 1000);

    // Choose tick format based on span
    const fmt = (v: number) => {
      const d = new Date(v);
      if (spanH < 36) return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
      if (spanH < 24 * 14) return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" }) + "\n" + d.toLocaleTimeString("th-TH", { hour: "2-digit" });
      return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
    };

    return {
      glucoseData: readings.map((r) => ({ ts: r.reading_timestamp, glucose: r.glucose })),
      mealData: meals.map((m) => ({ ts: m.meal_timestamp, glucose: 60, desc: m.description })),
      tickFmt: fmt,
      domain: [minTs, maxTs],
    };
  }, [readings, meals]);

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
        <ComposedChart data={glucoseData} margin={{ top: 10, right: 20, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="#F2F0F3" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="ts"
            domain={domain}
            tickFormatter={tickFmt}
            stroke="#8A838E"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: "#DDD9DF" }}
            minTickGap={50}
          />
          <YAxis
            stroke="#8A838E"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={[40, 220]}
            ticks={[60, 70, 110, 140, 180]}
            unit=""
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 4 }}
            labelFormatter={(v: any) => new Date(v).toLocaleString("th-TH")}
            formatter={(v: any, name: string) => {
              if (name === "glucose") return [`${v} mg/dL`, "Glucose"];
              return [v, name];
            }}
          />

          {/* Reference zones */}
          <ReferenceArea y1={70}  y2={110} fill="#16A34A" fillOpacity={0.08} />
          <ReferenceArea y1={110} y2={140} fill="#EAB308" fillOpacity={0.06} />
          <ReferenceArea y1={140} y2={220} fill="#DC2626" fillOpacity={0.05} />
          <ReferenceLine y={70}  stroke="#16A34A" strokeDasharray="4 3" strokeWidth={1} label={{ value: "70", fontSize: 10, fill: "#16A34A", position: "right" }} />
          <ReferenceLine y={110} stroke="#16A34A" strokeDasharray="4 3" strokeWidth={1} label={{ value: "110", fontSize: 10, fill: "#16A34A", position: "right" }} />
          <ReferenceLine y={140} stroke="#DC2626" strokeDasharray="4 3" strokeWidth={1} label={{ value: "140", fontSize: 10, fill: "#DC2626", position: "right" }} />

          {/* Glucose line */}
          <Line
            type="monotone"
            dataKey="glucose"
            stroke="#2563EB"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />

          {/* Meal markers as Scatter on bottom */}
          {mealData.length > 0 && (
            <Scatter
              data={mealData}
              dataKey="glucose"
              fill="#8C4C4C"
              shape="triangle"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
