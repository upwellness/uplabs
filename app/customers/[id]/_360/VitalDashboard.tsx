"use client";

import type { HealthScoreResult } from "@/lib/customers/health-score";

interface ScoreWithDelta extends HealthScoreResult {
  delta?:       number | null;
  deltaReason?: string | null;
}

interface VitalDashboardProps {
  score: ScoreWithDelta;
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
  if (value == null) return { color: "#5C5A56", label2: "—" };
  switch (metric) {
    case "hba1c":
      if (value < 5.7) return { color: "#15803D", label2: "ปกติ" };
      if (value <= 6.4) return { color: "#A16207", label2: "เริ่มสูง" };
      return { color: "#B91C1C", label2: "สูง" };
    case "ldl":
      if (value < 100) return { color: "#15803D", label2: "ดี" };
      if (value <= 130) return { color: "#4D7C0F", label2: "เกือบดี" };
      if (value <= 160) return { color: "#A16207", label2: "เริ่มสูง" };
      return { color: "#B91C1C", label2: "สูง" };
    case "visceral":
      if (value <= 2) return { color: "#15803D", label2: "ดีมาก" };
      if (value <= 5) return { color: "#4D7C0F", label2: "ปกติ" };
      if (value <= 9) return { color: "#A16207", label2: "เริ่มสูง" };
      if (value <= 15) return { color: "#C2410C", label2: "สูงมาก" };
      return { color: "#B91C1C", label2: "ต้องดูแลด่วน" };
    default:
      return { color: "#5C5A56", label2: "" };
  }
}

function bodyAgeStatus(bodyAge: number | null, chronoAge: number | null): { color: string; label2: string } {
  if (bodyAge == null || chronoAge == null) return { color: "#5C5A56", label2: "—" };
  const diff = bodyAge - chronoAge;
  if (diff <= -5) return { color: "#15803D", label2: `−${Math.abs(diff)}` };
  if (diff <= -2) return { color: "#4D7C0F", label2: `−${Math.abs(diff)}` };
  if (diff <=  2) return { color: "#A16207", label2: `${diff >= 0 ? "+" : ""}${diff}` };
  if (diff <=  5) return { color: "#C2410C", label2: `+${diff}` };
  return { color: "#B91C1C", label2: `+${diff}` };
}

function scoreColor(s: number | null): string {
  if (s == null) return "#5C5A56";
  if (s >= 85) return "#15803D";
  if (s >= 70) return "#4D7C0F";
  if (s >= 55) return "#A16207";
  if (s >= 40) return "#C2410C";
  return "#B91C1C";
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
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-60">Health Score</div>
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <span className="font-head text-[52px] font-extrabold leading-none tracking-tight" style={{ color: scoreCol }}>
                {score.total ?? "—"}
              </span>
              <span className="font-mono text-sm text-ink-60">/ 100</span>
              {score.delta != null && score.delta !== 0 && (
                <span
                  className="ml-1 rounded-full px-2.5 py-1 text-[12px] font-mono font-bold"
                  style={{
                    background: score.delta > 0 ? "#DCFCE7" : "#FEE2E2",
                    color: score.delta > 0 ? "#15803D" : "#B91C1C",
                  }}
                  aria-label={`เปลี่ยนแปลงจากครั้งก่อน ${score.delta > 0 ? "เพิ่ม" : "ลด"} ${Math.abs(score.delta)} คะแนน`}
                >
                  {score.delta > 0 ? "↑" : "↓"} {Math.abs(score.delta)}
                </span>
              )}
            </div>
            {score.deltaReason && (
              <p className="mt-1 font-thai text-[12px] text-ink-60 italic">เพราะ {score.deltaReason}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <ScorePill label="BCA"        value={score.bca}     />
              <ScorePill label="Lab"        value={score.lab}     />
              <ScorePill label="กิจกรรม"   value={score.recency} />
            </div>
          </div>

          {/* Progress arc · larger + glow */}
          <div className="relative h-28 w-28 flex-shrink-0">
            <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90"
              role="img" aria-label={`Health Score ${score.total ?? "ไม่มีข้อมูล"} จาก 100`}>
              <title>Health Score {score.total ?? "ไม่มีข้อมูล"} / 100</title>
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

        {/* Score caveat · warm Caregiver tone */}
        {(!score.sources.bca || !score.sources.lab || !score.sources.recency) ? (
          <p className="relative mt-3 font-thai text-[11px] text-ink-60 leading-snug">
            คะแนนนี้ยังไม่สมบูรณ์ · ยังไม่มีข้อมูล
            {!score.sources.bca && <span className="text-orange-600"> BCA</span>}
            {!score.sources.bca && (!score.sources.lab || !score.sources.recency) && <span>,</span>}
            {!score.sources.lab && <span className="text-orange-600"> Lab</span>}
            {!score.sources.lab && !score.sources.recency && <span>,</span>}
            {!score.sources.recency && <span className="text-orange-600"> กิจกรรมล่าสุด</span>}
            <span> · เพิ่มเข้าไปแล้วจะแม่นขึ้นค่ะ</span>
          </p>
        ) : (
          <p className="relative mt-3 font-mono text-[10px] text-ink-40">
            จากค่า BCA + ค่าเลือด + ความสม่ำเสมอของกิจกรรม
          </p>
        )}
      </div>

      {/* KPI Grid · liquid glass tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="HbA1c" value={labVals.hba1c} unit="%" {...valStatus("hba1c", labVals.hba1c)} />
        <MetricCard label="LDL" value={labVals.ldl} unit="mg/dL" {...valStatus("ldl", labVals.ldl)} />
        <MetricCard label="FBS" value={labVals.fbs} unit="mg/dL"
          color={labVals.fbs != null ? (labVals.fbs > 126 ? "#B91C1C" : labVals.fbs > 99 ? "#A16207" : "#15803D") : "#5C5A56"}
          label2={labVals.fbs != null ? (labVals.fbs > 126 ? "สูง" : labVals.fbs > 99 ? "เริ่มสูง" : "ปกติ") : "—"} />
        <MetricCard label="Visceral" value={bcaLatest?.visceral} unit="lv" {...valStatus("visceral", bcaLatest?.visceral)} />
        <MetricCard label="น้ำหนัก" value={bcaLatest?.weight} unit="kg" color="#1F1E1B" label2="" />
        <MetricCard label="Body Age" value={bcaLatest?.body_age} unit="yr" {...bodyAgeStatus(bcaLatest?.body_age ?? null, chronoAge)} />
      </div>

      {/* Coaching-tool disclaimer */}
      <p className="font-thai text-[10.5px] text-ink-60 text-center leading-relaxed">
        Health Score เป็นเครื่องมือสำหรับ coaching · ไม่ทดแทนการวินิจฉัยทางการแพทย์
      </p>
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
