"use client";

import type { HealthScoreResult } from "@/lib/customers/health-score";

interface VitalDashboardProps {
  score: HealthScoreResult;
  labVals: {
    hba1c?:        number | null;
    fbs?:          number | null;
    ldl?:          number | null;
    hdl?:          number | null;
    triglyceride?: number | null;
    alt?:          number | null;
    ast?:          number | null;
  };
  bcaLatest: {
    weight?:     number | null;
    fat_pct?:    number | null;
    muscle_pct?: number | null;
    visceral?:   number | null;
    body_age?:   number | null;
    bmr?:        number | null;
    recorded_at?:string | null;
  } | null;
  chronoAge: number | null;
}

/* ── Status color from value ── */
function valStatus(metric: string, value: number | null | undefined): { color: string; label2: string } {
  if (value == null) return { color: "#8B8884", label2: "—" };
  switch (metric) {
    case "hba1c":
      if (value < 5.7) return { color: "#16A34A", label2: "Normal" };
      if (value <= 6.4) return { color: "#CA8A04", label2: "Pre-DM" };
      return { color: "#DC2626", label2: "DM" };
    case "ldl":
      if (value < 100) return { color: "#16A34A", label2: "Optimal" };
      if (value <= 130) return { color: "#65A30D", label2: "Near-opt" };
      if (value <= 160) return { color: "#CA8A04", label2: "Borderline" };
      return { color: "#DC2626", label2: "High" };
    case "visceral":
      if (value <= 2) return { color: "#16A34A", label2: "ดี" };
      if (value <= 5) return { color: "#65A30D", label2: "ปกติ" };
      if (value <= 9) return { color: "#CA8A04", label2: "สูง" };
      if (value <= 15) return { color: "#EA580C", label2: "สูงมาก" };
      return { color: "#DC2626", label2: "อันตราย" };
    default:
      return { color: "#5C5A56", label2: "" };
  }
}

function bodyAgeStatus(bodyAge: number | null, chronoAge: number | null): { color: string; label2: string } {
  if (bodyAge == null || chronoAge == null) return { color: "#8B8884", label2: "—" };
  const diff = bodyAge - chronoAge;
  if (diff <= -5) return { color: "#16A34A", label2: `−${Math.abs(diff)}` };
  if (diff <= -2) return { color: "#65A30D", label2: `−${Math.abs(diff)}` };
  if (diff <=  2) return { color: "#CA8A04", label2: `${diff >= 0 ? "+" : ""}${diff}` };
  if (diff <=  5) return { color: "#EA580C", label2: `+${diff}` };
  return { color: "#DC2626", label2: `+${diff}` };
}

function scoreColor(s: number | null): string {
  if (s == null) return "#8B8884";
  if (s >= 85) return "#16A34A";
  if (s >= 70) return "#65A30D";
  if (s >= 55) return "#CA8A04";
  if (s >= 40) return "#EA580C";
  return "#DC2626";
}

export function VitalDashboard({ score, labVals, bcaLatest, chronoAge }: VitalDashboardProps) {
  const scoreCol = scoreColor(score.total);

  return (
    <section className="space-y-4">
      {/* Health Score */}
      <div className="rounded-3xl border border-ink-10 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-40">Health Score</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-head text-[44px] font-extrabold leading-none" style={{ color: scoreCol }}>
                {score.total ?? "—"}
              </span>
              <span className="font-mono text-sm text-ink-40">/ 100</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-mono text-ink-60">
              <span>BCA <span className="font-bold" style={{ color: scoreColor(score.bca) }}>{score.bca ?? "—"}</span></span>
              <span>Lab <span className="font-bold" style={{ color: scoreColor(score.lab) }}>{score.lab ?? "—"}</span></span>
              <span>Recency <span className="font-bold" style={{ color: scoreColor(score.recency) }}>{score.recency ?? "—"}</span></span>
            </div>
          </div>

          {/* Progress arc */}
          <div className="relative h-24 w-24 flex-shrink-0">
            <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
              <circle cx="40" cy="40" r="32" stroke="#E5E2DD" strokeWidth="8" fill="none" />
              <circle cx="40" cy="40" r="32" stroke={scoreCol} strokeWidth="8" fill="none"
                strokeDasharray={`${(score.total ?? 0) * 2.01} 201`}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 600ms ease" }}
              />
            </svg>
          </div>
        </div>

        {/* Formula caveat */}
        <p className="mt-3 font-mono text-[9px] text-ink-40">
          Formula: BCA 40 + Lab 40 + Recency 20 ·
          {!score.sources.bca && " ⚠ no BCA"}
          {!score.sources.lab && " ⚠ no Lab"}
          {!score.sources.recency && " ⚠ no recency"}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {/* HbA1c */}
        <MetricCard label="HbA1c" value={labVals.hba1c} unit="%" {...valStatus("hba1c", labVals.hba1c)} />
        {/* LDL */}
        <MetricCard label="LDL" value={labVals.ldl} unit="mg/dL" {...valStatus("ldl", labVals.ldl)} />
        {/* FBS */}
        <MetricCard label="FBS" value={labVals.fbs} unit="mg/dL"
          color={labVals.fbs != null ? (labVals.fbs > 126 ? "#DC2626" : labVals.fbs > 99 ? "#CA8A04" : "#16A34A") : "#8B8884"}
          label2={labVals.fbs != null ? (labVals.fbs > 126 ? "DM" : labVals.fbs > 99 ? "Pre-DM" : "Normal") : "—"} />
        {/* Visceral */}
        <MetricCard label="Visceral" value={bcaLatest?.visceral} unit="lv" {...valStatus("visceral", bcaLatest?.visceral)} />
        {/* Weight */}
        <MetricCard label="น้ำหนัก" value={bcaLatest?.weight} unit="kg" color="#1F1E1B" label2="" />
        {/* Body Age */}
        <MetricCard label="Body Age" value={bcaLatest?.body_age} unit="yr" {...bodyAgeStatus(bcaLatest?.body_age ?? null, chronoAge)} />
      </div>
    </section>
  );
}

function MetricCard({ label, value, unit, color, label2 }: { label: string; value: number | null | undefined; unit: string; color: string; label2: string; }) {
  return (
    <div className="rounded-2xl border border-ink-10 bg-white p-3">
      <div className="font-mono text-[9px] uppercase tracking-widest text-ink-40">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-head text-[22px] font-extrabold leading-none" style={{ color }}>
          {value ?? "—"}
        </span>
        <span className="text-[10px] text-ink-40">{unit}</span>
      </div>
      {label2 && (
        <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
          {label2}
        </div>
      )}
    </div>
  );
}
