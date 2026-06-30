"use client";

/**
 * UP Labs v2 · Pulse report — all chart sections (recharts, olive/gold "Pook" CI).
 * ──────────────────────────────────────────────────────────────────────────────
 * Lazy-imported by _ReportView via next/dynamic so recharts (~100kB) stays OUT of
 * the route's First-Load JS (SPEC §8). Renders, in document order:
 *   - Wearable groups (recovery · sleep · activity · body) — line / bar / sleepStacked
 *   - BCA (body composition) trends + delta chips + analysis
 *   - CGM (glucose) day-pattern + daily trend + Time-in-Range + analysis
 *   - Food (nutrition) daily calories + C:P:F donut + recent meals + analysis
 *
 * recharts is themed olive/gold to match the report CI. Section ids are anchors the
 * sticky TOC scroll-jumps to. Section numbers are passed in (synced with the TOC).
 */

import {
  ResponsiveContainer, LineChart, BarChart, Line, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ReferenceArea, Legend,
} from "recharts";
import { METRIC_REGISTRY, type UnifiedDaily, type MetricSummary } from "@/lib/pulse/wearable-report";
import type { BcaSummary, CgmSummary, FoodSummary } from "@/lib/pulse/extra-report";

/* ── olive/gold palette (match _report-css tokens) ── */
const C = {
  olive: "#3D5826", oliveL: "#5A7A3A", gold: "#C99D2F", goldL: "#F4C842",
  green: "#5A7A3A", amber: "#D89A1E", red: "#C2533F", blue: "#3E6E8E",
  deep: "#5B4A8A", rem: "#3E8E8E", light: "#9AA8C7",
  ink40: "#8B8880", grid: "rgba(31,30,27,.06)", cream: "#EDE8DE",
};
const TOOLTIP_STYLE = { background: "#1F1E1B", border: "none", borderRadius: 8, fontSize: 12, color: "#fff", padding: "8px 12px" };
const ITEM_STYLE = { color: "#fff" };
const AXIS = { stroke: C.ink40, fontSize: 9 };
const fmtDay = (iso: string) => { const [, m, d] = iso.split("-"); return `${parseInt(d)}/${parseInt(m)}`; };

interface Meta {
  groupTitle: Record<string, string>;
  groupEyebrow: Record<string, string>;
  tirLow: number;
  tirHigh: number;
}

export function ReportCharts({
  groups, series, summaries, bca, cgm, food, sectionNumbers, meta,
}: {
  groups: Record<string, string[]>;
  series: UnifiedDaily[];
  summaries: Record<string, MetricSummary>;
  bca: BcaSummary | null;
  cgm: CgmSummary | null;
  food: FoodSummary | null;
  sectionNumbers: Record<string, string | null>;
  meta: Meta;
}) {
  return (
    <>
      {(["recovery", "sleep", "activity", "body"] as const).map((grp) => {
        const keys = groups[grp];
        const n = sectionNumbers[grp];
        if (!keys || keys.length === 0 || !n) return null;
        return (
          <section key={grp} id={`sec-${grp}`} className="rpt-section"><div className="rpt-wrap">
            <SecHead n={n} eyebrow={meta.groupEyebrow[grp]} title={meta.groupTitle[grp]} />
            <div className="rpt-grid2">
              {keys.map((k) => <MetricChart key={k} metricKey={k} series={series} summary={summaries[k]} />)}
            </div>
          </div></section>
        );
      })}

      {bca && sectionNumbers.bca && <BcaSection n={sectionNumbers.bca} bca={bca} />}
      {cgm && sectionNumbers.cgm && <CgmSection n={sectionNumbers.cgm} cgm={cgm} tirLow={meta.tirLow} tirHigh={meta.tirHigh} />}
      {food && sectionNumbers.food && <FoodSection n={sectionNumbers.food} food={food} />}
    </>
  );
}

/* ───────────────────────── shared ───────────────────────── */

function SecHead({ n, eyebrow, title, sub }: { n: string; eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="rpt-sec-head">
      <div className="rpt-sec-num">{n}</div>
      <div>
        <div className="rpt-eyebrow">{eyebrow}</div>
        <div className="t">{title}</div>
        {sub && <div className="s">{sub}</div>}
      </div>
    </div>
  );
}

function ChartCard({ title, color, avg, tall, children }: { title: string; color: string; avg?: string; tall?: boolean; children: React.ReactNode }) {
  return (
    <div className="rpt-chart-card">
      <div className="rpt-chart-head">
        <div className="ttl"><span className="dot" style={{ background: color }} /><span>{title}</span></div>
        {avg && <span className="avg" style={{ color }}>{avg}</span>}
      </div>
      <div className={`rpt-chart-box${tall ? " tall" : ""}`}>
        <ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer>
      </div>
    </div>
  );
}

function Analysis({ lines, tone = "g" }: { lines: string[]; tone?: "g" | "a" | "r" | "" }) {
  if (!lines.length) return null;
  return (
    <div className={`rpt-insight ${tone}`} style={{ flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <span className="ii">💡</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {lines.map((l, i) => <p key={i} style={{ margin: 0 }}>{l}</p>)}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── wearable metric chart ───────────────────────── */

function MetricChart({ metricKey, series, summary }: { metricKey: string; series: UnifiedDaily[]; summary: MetricSummary }) {
  const def = METRIC_REGISTRY[metricKey];
  if (!def) return null;
  const data = series.map((d) => ({
    day: fmtDay(d.date),
    recovery: d.recovery, hrv: d.hrv, rhr: d.rhr, hr_avg: d.hr_avg, spo2: d.spo2,
    skin_temp: d.skin_temp, resp_rate: d.resp_rate, sleep_perf: d.sleep_perf, sleep_eff: d.sleep_eff,
    strain: d.strain, steps: d.steps, active_minutes: d.active_minutes, calories: d.calories,
    weight: d.weight, body_fat: d.body_fat,
    deep_h: d.deep_min != null ? +(d.deep_min / 60).toFixed(2) : null,
    rem_h: d.rem_min != null ? +(d.rem_min / 60).toFixed(2) : null,
    light_h: d.light_min != null ? +(d.light_min / 60).toFixed(2) : null,
  }));
  const avgTxt = summary?.avg != null ? `⌀ ${summary.avg.toFixed(def.digits ?? 0)}${def.unit}` : undefined;

  return (
    <ChartCard title={def.label} color={def.color} avg={avgTxt}>
      {def.kind === "sleepStacked" ? (
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis dataKey="day" {...AXIS} tickLine={false} axisLine={{ stroke: C.cream }} minTickGap={24} />
          <YAxis {...AXIS} tickLine={false} axisLine={false} unit="h" />
          <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} labelStyle={ITEM_STYLE} formatter={(v: any, nm: any) => [`${v} ชม.`, nm]} />
          {def.refs?.map((r) => <ReferenceLine key={r.value} y={r.value} stroke={r.tone === "good" ? C.green : C.red} strokeDasharray="4 3" strokeWidth={1} />)}
          <Bar dataKey="deep_h" name="หลับลึก" stackId="s" fill={C.deep} />
          <Bar dataKey="rem_h" name="REM" stackId="s" fill={C.rem} />
          <Bar dataKey="light_h" name="ตื้น" stackId="s" fill={C.light} radius={[4, 4, 0, 0]} />
          <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
        </BarChart>
      ) : def.kind === "bar" ? (
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis dataKey="day" {...AXIS} tickLine={false} axisLine={{ stroke: C.cream }} minTickGap={24} />
          <YAxis {...AXIS} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} labelStyle={ITEM_STYLE} cursor={{ fill: "rgba(61,88,38,.05)" }} />
          {def.refs?.map((r) => <ReferenceLine key={r.value} y={r.value} stroke={C.green} strokeDasharray="4 3" strokeWidth={1} label={{ value: r.label, fontSize: 9, fill: C.green, position: "right" }} />)}
          <Bar dataKey={metricKey} fill={def.color} radius={[4, 4, 0, 0]} />
        </BarChart>
      ) : (
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          {def.zones?.map((z, i) => <ReferenceArea key={i} y1={z.min} y2={z.max} fill={z.color} strokeOpacity={0} />)}
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis dataKey="day" {...AXIS} tickLine={false} axisLine={{ stroke: C.cream }} minTickGap={24} />
          <YAxis {...AXIS} tickLine={false} axisLine={false} unit={def.unit ? ` ${def.unit}` : ""} domain={["dataMin - 2", "dataMax + 2"]} />
          <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} labelStyle={ITEM_STYLE} />
          {def.refs?.map((r) => <ReferenceLine key={r.value} y={r.value} stroke={r.tone === "good" ? C.green : C.red} strokeDasharray="4 3" strokeWidth={1} label={{ value: r.label, fontSize: 9, fill: r.tone === "good" ? C.green : C.red, position: "right" }} />)}
          <Line type="monotone" dataKey={metricKey} stroke={def.color} strokeWidth={2.4} dot={false} connectNulls />
        </LineChart>
      )}
    </ChartCard>
  );
}

/* ═══════════════════════════ BCA ═══════════════════════════ */

function BcaSection({ n, bca }: { n: string; bca: BcaSummary }) {
  const data = bca.points.map((p) => ({ day: fmtDay(p.date), weight: p.weight, fat_pct: p.fat_pct, muscle_pct: p.muscle_pct, visceral: p.visceral }));
  const has = (k: keyof typeof data[number]) => data.some((d) => d[k] != null);

  return (
    <section id="sec-bca" className="rpt-section"><div className="rpt-wrap">
      <SecHead n={n} eyebrow="Body Composition" title="องค์ประกอบร่างกาย"
        sub={`${bca.count} ครั้ง · ${bca.points[0].date} → ${bca.latest.date}${bca.spanDays > 0 ? ` (${bca.spanDays} วัน)` : ""}`} />

      {/* delta chips */}
      <div className="rpt-deltas">
        {bca.deltas.filter((d) => d.latest != null).map((d) => {
          const improving = d.delta == null ? null : (d.goodDown ? d.delta < 0 : d.delta > 0);
          const cls = improving == null ? "" : improving ? "good" : "bad";
          const sign = d.delta != null && d.delta > 0 ? "+" : "";
          return (
            <div className={`rpt-delta ${cls}`} key={d.key}>
              <div className="dl">{d.label}</div>
              <div className="dv">{d.latest}{d.unit && d.unit !== "" ? <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 2 }}>{d.unit}</span> : ""}</div>
              {d.delta != null && d.delta !== 0 && <div className="dd">{sign}{d.delta}{d.unit} จากครั้งแรก</div>}
              {(d.delta == null || d.delta === 0) && <div className="dd" style={{ color: "var(--ink-40)" }}>คงที่</div>}
            </div>
          );
        })}
      </div>

      <div className="rpt-grid2">
        {(has("weight") || has("fat_pct") || has("muscle_pct")) && (
          <ChartCard title="น้ำหนัก · ไขมัน · กล้ามเนื้อ" color={C.olive}>
            <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="day" {...AXIS} tickLine={false} axisLine={{ stroke: C.cream }} minTickGap={20} />
              <YAxis yAxisId="kg" {...AXIS} tickLine={false} axisLine={false} domain={["dataMin - 2", "dataMax + 2"]} />
              <YAxis yAxisId="pct" orientation="right" {...AXIS} tickLine={false} axisLine={false} unit="%" domain={[0, "dataMax + 5"]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} labelStyle={ITEM_STYLE} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
              {has("weight") && <Line yAxisId="kg" type="monotone" dataKey="weight" name="น้ำหนัก (กก.)" stroke={C.olive} strokeWidth={2.4} dot={{ r: 2 }} connectNulls />}
              {has("fat_pct") && <Line yAxisId="pct" type="monotone" dataKey="fat_pct" name="ไขมัน %" stroke={C.red} strokeWidth={2} dot={{ r: 2 }} connectNulls />}
              {has("muscle_pct") && <Line yAxisId="pct" type="monotone" dataKey="muscle_pct" name="กล้ามเนื้อ %" stroke={C.blue} strokeWidth={2} dot={{ r: 2 }} connectNulls />}
            </LineChart>
          </ChartCard>
        )}
        {has("visceral") && (
          <ChartCard title="ไขมันช่องท้อง (visceral)" color={C.amber}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="day" {...AXIS} tickLine={false} axisLine={{ stroke: C.cream }} minTickGap={20} />
              <YAxis {...AXIS} tickLine={false} axisLine={false} domain={[0, "dataMax + 2"]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} labelStyle={ITEM_STYLE} cursor={{ fill: "rgba(61,88,38,.05)" }} />
              <ReferenceLine y={10} stroke={C.red} strokeDasharray="4 3" strokeWidth={1.2} label={{ value: "เกณฑ์ 10", fontSize: 9, fill: C.red, position: "right" }} />
              <Bar dataKey="visceral" name="visceral" fill={C.amber} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>
        )}
      </div>
      <Analysis lines={bca.analysis} tone="g" />
    </div></section>
  );
}

/* ═══════════════════════════ CGM ═══════════════════════════ */

function CgmSection({ n, cgm, tirLow, tirHigh }: { n: string; cgm: CgmSummary; tirLow: number; tirHigh: number }) {
  const dayData = cgm.byDay.map((d) => ({ day: fmtDay(d.date), avg: d.avg, min: d.min, max: d.max }));
  const hourData = Array.from({ length: 24 }, (_, h) => {
    const hit = cgm.byHour.find((x) => x.hour === h);
    return { hour: `${String(h).padStart(2, "0")}`, avg: hit ? hit.avg : null };
  });
  const tir = cgm.tir;

  return (
    <section id="sec-cgm" className="rpt-section"><div className="rpt-wrap">
      <SecHead n={n} eyebrow="Continuous Glucose" title="น้ำตาลในเลือด (CGM)"
        sub={`${cgm.profiles.join(", ")} · ${cgm.readings.toLocaleString()} จุดวัด · ${cgm.days} วัน`} />

      <div className="rpt-card" style={{ marginBottom: 18 }}><div className="rpt-card-pad">
        {/* stat row */}
        <div className="rpt-statrow" style={{ marginBottom: 16 }}>
          <div className="rpt-stat"><div className="v" style={{ color: C.olive }}>{cgm.avg}<span className="u">mg/dL</span></div><div className="l">เฉลี่ย</div></div>
          <div className="rpt-stat"><div className="v" style={{ color: C.blue }}>{cgm.estA1c}<span className="u">%</span></div><div className="l">est. HbA1c</div></div>
          <div className="rpt-stat"><div className="v" style={{ color: C.green }}>{tir.inPct}<span className="u">%</span></div><div className="l">ในช่วงเป้าหมาย</div><div className="sub">{tirLow}–{tirHigh}</div></div>
          <div className="rpt-stat"><div className="v">{cgm.min}</div><div className="l">ต่ำสุด</div></div>
          <div className="rpt-stat"><div className="v">{cgm.max}</div><div className="l">สูงสุด</div></div>
        </div>
        {/* Time-in-range bar */}
        <div style={{ fontFamily: "'Kanit'", fontSize: 12, fontWeight: 600, color: "var(--ink-60)", marginBottom: 4 }}>Time in Range</div>
        <div className="rpt-tir">
          {tir.lowPct > 0 && <div className="seg" style={{ width: `${tir.lowPct}%`, background: C.amber }}>{tir.lowPct >= 8 ? `${tir.lowPct}%` : ""}</div>}
          <div className="seg" style={{ width: `${tir.inPct}%`, background: C.green }}>{tir.inPct >= 8 ? `${tir.inPct}%` : ""}</div>
          {tir.highPct > 0 && <div className="seg" style={{ width: `${tir.highPct}%`, background: C.red }}>{tir.highPct >= 8 ? `${tir.highPct}%` : ""}</div>}
        </div>
        <div className="rpt-tir-legend">
          <div className="li"><span className="sw" style={{ background: C.amber }} />ต่ำ (&lt;{tirLow}) {tir.lowPct}%</div>
          <div className="li"><span className="sw" style={{ background: C.green }} />ในช่วง ({tirLow}–{tirHigh}) {tir.inPct}%</div>
          <div className="li"><span className="sw" style={{ background: C.red }} />สูง (&gt;{tirHigh}) {tir.highPct}%</div>
        </div>
      </div></div>

      <div className="rpt-grid2">
        <ChartCard title="น้ำตาลเฉลี่ยรายวัน" color={C.olive}>
          <LineChart data={dayData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <ReferenceArea y1={tirLow} y2={tirHigh} fill="rgba(90,122,58,.07)" strokeOpacity={0} />
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
            <XAxis dataKey="day" {...AXIS} tickLine={false} axisLine={{ stroke: C.cream }} minTickGap={20} />
            <YAxis {...AXIS} tickLine={false} axisLine={false} unit=" " domain={["dataMin - 10", "dataMax + 10"]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} labelStyle={ITEM_STYLE} formatter={(v: any, nm: any) => [`${v} mg/dL`, nm]} />
            <ReferenceLine y={tirHigh} stroke={C.red} strokeDasharray="4 3" strokeWidth={1} label={{ value: `${tirHigh}`, fontSize: 9, fill: C.red, position: "right" }} />
            <Line type="monotone" dataKey="avg" name="เฉลี่ย" stroke={C.olive} strokeWidth={2.4} dot={{ r: 2 }} connectNulls />
            <Line type="monotone" dataKey="max" name="สูงสุด" stroke={C.red} strokeWidth={1.4} strokeDasharray="4 3" dot={false} connectNulls />
          </LineChart>
        </ChartCard>
        <ChartCard title="รูปแบบรายชั่วโมง (เฉลี่ย 24 ชม.)" color={C.blue}>
          <LineChart data={hourData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <ReferenceArea y1={tirLow} y2={tirHigh} fill="rgba(90,122,58,.07)" strokeOpacity={0} />
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
            <XAxis dataKey="hour" {...AXIS} tickLine={false} axisLine={{ stroke: C.cream }} minTickGap={12} interval={1} />
            <YAxis {...AXIS} tickLine={false} axisLine={false} domain={["dataMin - 10", "dataMax + 10"]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} labelStyle={ITEM_STYLE} formatter={(v: any) => [`${v} mg/dL`, "เฉลี่ย"]} labelFormatter={(l: any) => `${l}:00 น.`} />
            <ReferenceLine y={tirHigh} stroke={C.red} strokeDasharray="4 3" strokeWidth={1} />
            <Line type="monotone" dataKey="avg" name="เฉลี่ย" stroke={C.blue} strokeWidth={2.4} dot={false} connectNulls />
          </LineChart>
        </ChartCard>
      </div>
      <Analysis lines={cgm.analysis} tone={tir.inPct >= 70 ? "g" : "a"} />
    </div></section>
  );
}

/* ═══════════════════════════ FOOD ═══════════════════════════ */

function FoodSection({ n, food }: { n: string; food: FoodSummary }) {
  const dayData = food.byDay.map((d) => ({ day: fmtDay(d.date), calories: d.calories, carb: d.carb, protein: d.protein, fat: d.fat }));
  const m = food.macroAvgPct;
  const mealTone = (h: number | null) => h == null ? { background: "var(--cream)", color: "var(--ink-40)" } : h >= 7 ? { background: "var(--green-bg)", color: "var(--green)" } : h >= 5 ? { background: "var(--amber-bg)", color: "var(--amber)" } : { background: "var(--red-bg)", color: "var(--red)" };

  return (
    <section id="sec-food" className="rpt-section"><div className="rpt-wrap">
      <SecHead n={n} eyebrow="Nutrition" title="โภชนาการ"
        sub={`${food.scans} รายการ · ${food.days} วัน · เฉลี่ย ${food.avgCalories.toLocaleString()} kcal/วัน`} />

      {/* stat row */}
      <div className="rpt-card" style={{ marginBottom: 18 }}><div className="rpt-card-pad">
        <div className="rpt-statrow">
          <div className="rpt-stat"><div className="v" style={{ color: C.olive }}>{food.avgCalories.toLocaleString()}</div><div className="l">kcal/วัน เฉลี่ย</div></div>
          <div className="rpt-stat"><div className="v" style={{ color: C.red }}>{m.carb}<span className="u">%</span></div><div className="l">คาร์บ</div></div>
          <div className="rpt-stat"><div className="v" style={{ color: C.green }}>{m.protein}<span className="u">%</span></div><div className="l">โปรตีน</div></div>
          <div className="rpt-stat"><div className="v" style={{ color: C.amber }}>{m.fat}<span className="u">%</span></div><div className="l">ไขมัน</div></div>
          {food.avgHealth != null && <div className="rpt-stat"><div className="v" style={{ color: C.blue }}>{food.avgHealth}<span className="u">/10</span></div><div className="l">คะแนนสุขภาพ</div></div>}
          {food.avgGlucoseImpact != null && <div className="rpt-stat"><div className="v">{food.avgGlucoseImpact}<span className="u">/10</span></div><div className="l">ผลต่อน้ำตาล</div></div>}
        </div>
      </div></div>

      <div className="rpt-grid2">
        <ChartCard title="แคลอรีรายวัน" color={C.olive}>
          <BarChart data={dayData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
            <XAxis dataKey="day" {...AXIS} tickLine={false} axisLine={{ stroke: C.cream }} minTickGap={16} />
            <YAxis {...AXIS} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} labelStyle={ITEM_STYLE} cursor={{ fill: "rgba(61,88,38,.05)" }} formatter={(v: any) => [`${Number(v).toLocaleString()} kcal`, "แคลอรี"]} />
            <Bar dataKey="calories" fill={C.gold} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
        <ChartCard title="สัดส่วนแมโคร C:P:F รายวัน (กรัม)" color={C.green}>
          <BarChart data={dayData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} stackOffset="expand">
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
            <XAxis dataKey="day" {...AXIS} tickLine={false} axisLine={{ stroke: C.cream }} minTickGap={16} />
            <YAxis {...AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={ITEM_STYLE} labelStyle={ITEM_STYLE} formatter={(v: any, nm: any) => [`${v} ก.`, nm]} />
            <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
            <Bar dataKey="carb" name="คาร์บ" stackId="m" fill={C.red} />
            <Bar dataKey="protein" name="โปรตีน" stackId="m" fill={C.green} />
            <Bar dataKey="fat" name="ไขมัน" stackId="m" fill={C.amber} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      {/* recent meals */}
      {food.recent.length > 0 && (
        <div className="rpt-card" style={{ marginTop: 18 }}><div className="rpt-card-pad">
          <div style={{ fontFamily: "'Kanit'", fontWeight: 600, fontSize: 15, marginBottom: 12 }}>มื้ออาหารล่าสุด</div>
          <div className="rpt-meals">
            {food.recent.map((meal, i) => (
              <div className="rpt-meal" key={i}>
                <span className="mt">{meal.meal_type}</span>
                <span className="mf">{meal.food}</span>
                {meal.calories != null && <span className="mk">{meal.calories} kcal</span>}
                {meal.health != null && <span className="mh" style={mealTone(meal.health)}>{meal.health}/10</span>}
              </div>
            ))}
          </div>
        </div></div>
      )}
      <Analysis lines={food.analysis} tone={food.avgHealth != null && food.avgHealth >= 7 ? "g" : "a"} />
    </div></section>
  );
}
