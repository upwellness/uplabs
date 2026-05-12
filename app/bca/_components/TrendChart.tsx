"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { MeasurementWithDerived } from "@/lib/types";

interface TrendChartProps {
  measurements: MeasurementWithDerived[];
}

export function TrendChart({ measurements }: TrendChartProps) {
  const data = [...measurements]
    .reverse()
    .map((m) => ({
      date: new Date(m.recorded_at).toLocaleDateString("th-TH", { day: "2-digit", month: "short" }),
      weight: m.weight,
      fat: m.fat_pct,
      muscle: m.muscle_pct,
    }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="#F2F0F3" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#8A838E" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
          <YAxis stroke="#8A838E" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: "#18151A",
              border: "none",
              borderRadius: 10,
              color: "white",
              fontSize: 12,
              fontFamily: "var(--font-jetbrains)",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 4 }}
          />
          <Line type="monotone" dataKey="weight" name="Weight" stroke="#8C4C4C" strokeWidth={2.5} dot={{ r: 4, fill: "#8C4C4C", strokeWidth: 0 }} />
          <Line type="monotone" dataKey="fat"    name="Fat %"   stroke="#DC2626" strokeWidth={2}  dot={{ r: 3, fill: "#DC2626", strokeWidth: 0 }} />
          <Line type="monotone" dataKey="muscle" name="Muscle %" stroke="#16A34A" strokeWidth={2}  dot={{ r: 3, fill: "#16A34A", strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
