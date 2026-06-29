"use client";

/**
 * UP Labs v2 · BCA trend charts (recharts) — split into its own module so the BCA
 * page can `next/dynamic` it (SPEC §8 "กราฟ lazy/conditional"). recharts (~100kB)
 * therefore stays out of the /v2/bca route's First-Load JS until ≥2 measurements
 * exist and this panel actually renders.
 */

import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Card } from "@/lib/v2/ui";
import type { Measurement } from "@/lib/types";

const TREND_METRICS: { key: keyof Measurement; label: string; color: string; unit: string }[] = [
  { key: "weight", label: "น้ำหนัก (kg)", color: "#8C4C4C", unit: "kg" },
  { key: "fat_pct", label: "Body fat %", color: "#C47A2A", unit: "%" },
  { key: "muscle_pct", label: "Muscle %", color: "#396755", unit: "%" },
  { key: "visceral", label: "Visceral", color: "#2A7B8F", unit: "lv" },
];

export function TrendPanel({ measurements }: { measurements: Measurement[] }) {
  const asc = useMemo(() => [...measurements].sort((a, b) => +new Date(a.recorded_at) - +new Date(b.recorded_at)), [measurements]);
  const labelOf = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

  return (
    <Card className="p-4 lg:p-5">
      <h2 className="mb-3 font-head text-[15px] font-bold text-ink">แนวโน้ม</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {TREND_METRICS.map((m) => {
          const points = asc
            .map((x) => ({ date: labelOf(x.recorded_at), value: x[m.key] as number | null }))
            .filter((p) => p.value != null);
          if (points.length < 2) return null;
          return (
            <div key={String(m.key)} className="rounded-xl border border-ink-10 bg-white p-3">
              <div className="mb-1 text-[13px] font-semibold text-ink">{m.label}</div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke="#F2F0F3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#5C5660" }} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#5C5660" }} tickLine={false} axisLine={false} width={36} domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #DDD9DF", fontSize: 12 }} labelStyle={{ color: "#5C5660" }} />
                    <Line type="monotone" dataKey="value" stroke={m.color} strokeWidth={2.25} dot={{ r: 2.5, fill: m.color }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
