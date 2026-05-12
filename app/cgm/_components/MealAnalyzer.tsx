"use client";

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import type { AnalyzedMeal } from "@/lib/cgm-analyze";
import { CURVE_LABEL } from "@/lib/cgm-analyze";

interface MealAnalyzerProps {
  meals: AnalyzedMeal[];
  selected: Set<number>;
  onToggleSelect: (id: number) => void;
}

const GRADE_COLOR: Record<string, { fg: string; bg: string }> = {
  A: { fg: "#16A34A", bg: "#DCFCE7" },
  B: { fg: "#EAB308", bg: "#FEF9C3" },
  C: { fg: "#DC2626", bg: "#FEE2E2" },
};

const TONE_COLOR: Record<string, string> = {
  good:    "#16A34A",
  warn:    "#EAB308",
  danger:  "#DC2626",
  neutral: "#64748B",
};

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export function MealAnalyzer({ meals, selected, onToggleSelect }: MealAnalyzerProps) {
  if (meals.length === 0) {
    return (
      <div className="rounded-2xl bg-surface py-10 text-center font-thai text-sm text-ink-40">
        ไม่มีมื้อในช่วงเวลานี้
      </div>
    );
  }

  const valid = meals.filter((m) => m.valid);
  const invalid = meals.filter((m) => !m.valid);

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {valid.map((m) => <MealCard key={m.id} meal={m} checked={selected.has(m.id)} onToggle={() => onToggleSelect(m.id)} />)}
      </div>

      {invalid.length > 0 && (
        <div className="mt-6 rounded-2xl border border-ink-10 bg-surface px-5 py-4">
          <div className="font-thai text-[13px] font-semibold text-ink-60">
            มื้อที่วิเคราะห์ไม่ได้ ({invalid.length})
          </div>
          <p className="mt-1 font-thai text-[12px] text-ink-40">
            ไม่พบข้อมูล glucose ในช่วง 3 ชม. หลังมื้อ — ต้องมี baseline ก่อนมื้อด้วย
          </p>
          <ul className="mt-2 space-y-1 font-mono text-[11px] text-ink-60">
            {invalid.map((m) => (
              <li key={m.id}>· {fmtTime(m.meal_timestamp)} — {m.description}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Single Meal Card ───────────────────────────── */
function MealCard({ meal, checked, onToggle }: { meal: AnalyzedMeal; checked: boolean; onToggle: () => void }) {
  const g = GRADE_COLOR[meal.grade];
  const curve = CURVE_LABEL[meal.curveShape];

  return (
    <div className={`rounded-2xl border bg-white p-5 transition-all ${checked ? "border-rose ring-2 ring-rose-ultra" : "border-ink-10"}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-40">
            {fmtTime(meal.meal_timestamp)}
          </div>
          <div className="mt-1 font-thai text-[15px] font-bold text-ink truncate" title={meal.description}>
            {meal.description}
          </div>
          {(meal.carbs != null || meal.protein != null || meal.fat != null) && (
            <div className="mt-1 font-mono text-[10px] text-ink-40">
              {meal.carbs != null && `C ${meal.carbs}`}
              {meal.protein != null && ` · P ${meal.protein}`}
              {meal.fat != null && ` · F ${meal.fat}`}
            </div>
          )}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-head text-lg font-extrabold"
          style={{ background: g.bg, color: g.fg }}
        >
          {meal.grade}
        </div>
      </div>

      {/* Curve shape pill */}
      <div className="mt-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
        style={{ background: TONE_COLOR[curve.tone] + "20", color: TONE_COLOR[curve.tone] }}
      >
        {curve.th}
      </div>

      {/* Mini chart 0-3hr */}
      <div className="mt-3 h-32 w-full">
        <ResponsiveContainer>
          <LineChart data={meal.windowData} margin={{ top: 6, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis dataKey="relativeMin" type="number" domain={[0, 180]} ticks={[0, 60, 120, 180]}
              tickFormatter={(v) => `${v / 60}h`} stroke="#94A3B8" fontSize={9} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
            <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={28} />
            <Tooltip
              contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 11 }}
              labelFormatter={(v: any) => `${v} นาที`}
              formatter={(v: any) => [`${v} mg/dL`, "Glucose"]}
            />
            <ReferenceLine y={meal.baseline ?? 0} stroke="#94A3B8" strokeDasharray="2 2" strokeWidth={1} />
            <ReferenceLine x={60}  stroke="#CBD5E1" strokeDasharray="2 2" />
            <ReferenceLine x={120} stroke="#CBD5E1" strokeDasharray="2 2" />
            <Line type="monotone" dataKey="glucose" stroke="#14B8A6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stats grid */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Baseline"  value={meal.baseline} unit="" />
        <Stat label="Peak"      value={meal.peak} unit="" highlight color="#0D9488" />
        <Stat label="Δ Delta"   value={meal.delta} unit="" sign color={(meal.delta ?? 0) <= 30 ? "#16A34A" : (meal.delta ?? 0) <= 50 ? "#EAB308" : "#DC2626"} />
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
        <Stat label="Lag" value={meal.lagMins} unit="m" small />
        <Stat label="+1h" value={meal.hr1} unit="" small />
        <Stat label="+2h" value={meal.hr2} unit="" small />
        <Stat label="+3h" value={meal.hr3} unit="" small />
      </div>

      {/* Compare checkbox */}
      <label className="mt-4 flex cursor-pointer items-center gap-2 border-t border-ink-5 pt-3 text-[12px]">
        <input type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4 rounded border-ink-20 accent-rose" />
        <span className="font-thai text-ink-60">เลือกเปรียบเทียบกราฟ</span>
      </label>
    </div>
  );
}

function Stat({ label, value, unit, sign, highlight, color, small }: {
  label: string; value: number | null; unit: string;
  sign?: boolean; highlight?: boolean; color?: string; small?: boolean;
}) {
  const display = value == null ? "—" : `${sign && value > 0 ? "+" : ""}${Math.round(value)}${unit}`;
  return (
    <div className={`rounded-lg ${highlight ? "bg-surface" : ""} px-1 py-1.5`}>
      <div className={`font-mono ${small ? "text-[9px]" : "text-[10px]"} text-ink-40`}>{label}</div>
      <div className={`mt-0.5 font-head font-extrabold ${small ? "text-[13px]" : "text-[16px]"}`}
        style={{ color: color ?? "#1F1A1B" }}
      >
        {display}
      </div>
    </div>
  );
}
