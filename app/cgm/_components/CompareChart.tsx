"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import type { AnalyzedMeal } from "@/lib/cgm-analyze";
import { COMPARE_COLORS } from "@/lib/cgm-analyze";

interface CompareChartProps {
  meals: AnalyzedMeal[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="min-w-[200px] rounded-xl border border-ink-10 bg-white/95 p-3 shadow-lg backdrop-blur">
      <div className="mb-2 border-b border-ink-5 pb-1.5 font-mono text-[11px] font-bold text-ink-60">
        เวลาผ่านไป {label} นาที
      </div>
      <div className="space-y-1.5">
        {payload.map((entry: any, idx: number) => entry.value != null && (
          <div key={idx} className="flex items-center justify-between gap-4 text-[12px]">
            <span className="inline-flex items-center gap-1.5 truncate" title={entry.name}>
              <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
              <span className="truncate text-ink-60" style={{ maxWidth: 140 }}>{entry.name}</span>
            </span>
            <span className="font-mono text-[13px] font-bold text-ink">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompareChart({ meals }: CompareChartProps) {
  const data = useMemo(() => {
    if (meals.length === 0) return [];
    const rows: any[] = [];
    for (let min = 0; min <= 180; min += 5) {
      const row: any = { minute: min };
      meals.forEach((m) => {
        const r = m.windowData.find((d) => Math.abs(d.relativeMin - min) <= 2.5);
        row[`meal_${m.id}`] = r ? r.glucose : null;
      });
      rows.push(row);
    }
    return rows;
  }, [meals]);

  if (meals.length === 0) {
    return (
      <div className="rounded-2xl bg-surface py-10 text-center font-thai text-sm text-ink-40">
        เลือกอย่างน้อย 2 มื้อจากด้านล่าง เพื่อเปรียบเทียบ
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: 360 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 20, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis
            dataKey="minute" type="number" domain={[0, 180]}
            ticks={[0, 30, 60, 90, 120, 150, 180]}
            tickFormatter={(v) => `${v}`}
            stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={{ stroke: "#DDD9DF" }}
            label={{ value: "นาที หลังเริ่มมื้อ", position: "insideBottom", offset: -5, fontSize: 10, fill: "#94A3B8" }}
          />
          <YAxis domain={["auto", "auto"]} stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} tickCount={6} width={40} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#94A3B8", strokeWidth: 1, strokeDasharray: "3 3" }} />
          <Legend wrapperStyle={{ paddingTop: 18, fontSize: 11 }} />

          <ReferenceLine x={60}  stroke="#94A3B8" strokeDasharray="3 3" label={{ position: "insideTopLeft", value: "1 ชม.", fill: "#94A3B8", fontSize: 10 }} />
          <ReferenceLine x={120} stroke="#94A3B8" strokeDasharray="3 3" label={{ position: "insideTopLeft", value: "2 ชม.", fill: "#94A3B8", fontSize: 10 }} />
          <ReferenceLine x={180} stroke="#94A3B8" strokeDasharray="3 3" label={{ position: "insideTopLeft", value: "3 ชม.", fill: "#94A3B8", fontSize: 10 }} />

          {meals.map((m, idx) => (
            <Line
              key={m.id}
              type="monotone"
              dataKey={`meal_${m.id}`}
              name={m.description}
              stroke={COMPARE_COLORS[idx % COMPARE_COLORS.length]}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
