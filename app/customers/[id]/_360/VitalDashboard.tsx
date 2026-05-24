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
    <section className="space-y-3">
      {/* Health Score · hero glass card with glow */}
      <div className="liquid liquid-shine rounded-3xl p-6 relative overflow-hidden">
        {/* Soft glow behind score */}
        <div
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${scoreCol}30, transparent 70%)`,
            filter: "blur(40px)",
          }}
        />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-40">Health Score</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-head text-[52px] font-extrabold leading-none tracking-tight" style={{ color: scoreCol }}>
                {score.total ?? "—"}
              </span>
              <span className="font-mono text-sm text-ink-40">/ 100</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ScorePill label="BCA"     value={score.bca}     />
              <ScorePill label="Lab"     value={score.lab}     />
              <ScorePill label="Recency" value={score.recency} />
            </div>
          </div>

          {/* Progress arc · larger + glow */}
          <div className="relative h-28 w-28 flex-shrink-0">
            <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={scoreCol} stopOpacity="0.6" />
                  <stop offset="100%" stopColor={scoreCol} stopOpacity="1" />
                </linearGradient>
              </defs>
              <circle cx="40" cy="40" r="32" stroke="rgba(31,30,27,0.08)" strokeWidth="8" fill="none" />
              <circle cx="40" cy="40" r="32" stroke="url(#scoreGradient)" strokeWidth="8" fill="none"
                strokeDasharray={`${(score.total ?? 0) * 2.01} 201`}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 800ms ease", filter: `drop-shadow(0 0 6px ${scoreCol}80)` }}
              />
            </svg>
          </div>
        </div>

        {/* Formula caveat */}
        <p className="relative mt-3 font-mono text-[9px] text-ink-40">
          Formula: BCA 40 + Lab 40 + Recency 20
          {!score.sources.bca && <span className="text-orange-600"> · ⚠ no BCA</span>}
          {!score.sources.lab && <span className="text-orange-600"> · ⚠ no Lab</span>}
          {!score.sources.recency && <span className="text-orange-600"> · ⚠ no recency</span>}
        </p>
      </div>

      {/* KPI Grid · liquid glass tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="HbA1c" value={labVals.hba1c} unit="%" {...valStatus("hba1c", labVals.hba1c)} />
        <MetricCard label="LDL" value={labVals.ldl} unit="mg/dL" {...valStatus("ldl", labVals.ldl)} />
        <MetricCard label="FBS" value={labVals.fbs} unit="mg/dL"
          color={labVals.fbs != null ? (labVals.fbs > 126 ? "#DC2626" : labVals.fbs > 99 ? "#CA8A04" : "#16A34A") : "#8B8884"}
          label2={labVals.fbs != null ? (labVals.fbs > 126 ? "DM" : labVals.fbs > 99 ? "Pre-DM" : "Normal") : "—"} />
        <MetricCard label="Visceral" value={bcaLatest?.visceral} unit="lv" {...valStatus("visceral", bcaLatest?.visceral)} />
        <MetricCard label="น้ำหนัก" value={bcaLatest?.weight} unit="kg" color="#1F1E1B" label2="" />
        <MetricCard label="Body Age" value={bcaLatest?.body_age} unit="yr" {...bodyAgeStatus(bcaLatest?.body_age ?? null, chronoAge)} />
      </div>
    </section>
  );
}

function ScorePill({ label, value }: { label: string; value: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/50 backdrop-blur-md border border-white/60 px-2.5 py-1 font-mono text-[10px]">
      <span className="text-ink-40">{label}</span>
      <span className="font-bold" style={{ color: scoreColor(value) }}>{value ?? "—"}</span>
    </span>
  );
}

function MetricCard({ label, value, unit, color, label2 }: { label: string; value: number | null | undefined; unit: string; color: string; label2: string; }) {
  return (
    <div className="liquid liquid-hover rounded-2xl p-3 relative overflow-hidden group">
      {/* Subtle color tint on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${color}10, transparent)` }}
      />
      <div className="relative">
        <div className="font-mono text-[9px] uppercase tracking-widest text-ink-40">{label}</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="font-head text-[24px] font-extrabold leading-none" style={{ color }}>
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
    </div>
  );
}
