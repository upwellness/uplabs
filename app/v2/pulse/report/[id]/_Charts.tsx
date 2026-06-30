"use client";

/**
 * UP Labs v2 · Pulse report — chart grid (recharts)
 * ──────────────────────────────────────────────────
 * Isolated so the parent can lazy-import it via next/dynamic and keep recharts
 * (~100kB) OUT of the route's First-Load JS (SPEC §8 "กราฟ lazy/conditional").
 * Mirrors v1 WearableReportView chart logic exactly — same registry, same kinds,
 * same reference lines/zones — only the surrounding chrome is clinical-warm.
 */

import {
  ResponsiveContainer, LineChart, BarChart, Line, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ReferenceArea, Legend,
} from "recharts";
import { METRIC_REGISTRY, type UnifiedDaily, type MetricSummary } from "@/lib/pulse/wearable-report";

const fmtDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${parseInt(d)}/${parseInt(m)}`;
};

const TOOLTIP_STYLE = { background: "#fff", border: "1px solid #DDD9DF", borderRadius: 10, fontSize: 12 };
const AXIS = { stroke: "#94A3B8", fontSize: 10 };

const GROUP_TITLE: Record<string, string> = {
  recovery: "การฟื้นตัวและหัวใจ", sleep: "การนอน", activity: "กิจกรรม", body: "องค์ประกอบร่างกาย",
};
const GROUP_EYEBROW: Record<string, string> = {
  recovery: "Recovery & Heart", sleep: "Sleep", activity: "Activity", body: "Body",
};

export function ChartGroups({ groups, series, summaries, startN }: {
  groups: Record<string, string[]>;
  series: UnifiedDaily[];
  summaries: Record<string, MetricSummary>;
  startN: number;
}) {
  let n = startN;
  return (
    <>
      {(["recovery", "sleep", "activity", "body"] as const).map((grp) => {
        const keys = groups[grp];
        if (!keys || keys.length === 0) return null;
        const num = String(n++).padStart(2, "0");
        return (
          <section key={grp} className="report-block mt-7">
            <SectionTitle n={num} eyebrow={GROUP_EYEBROW[grp]} title={GROUP_TITLE[grp]} />
            <div className="grid gap-4 md:grid-cols-2">
              {keys.map((k) => <MetricChart key={k} metricKey={k} series={series} summary={summaries[k]} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}

function SectionTitle({ n, eyebrow, title, sub }: { n: string; eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose text-[14px] font-extrabold text-white">{n}</div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-rose">{eyebrow}</div>
        <div className="font-head text-[18px] font-extrabold leading-tight text-ink">{title}</div>
        {sub && <div className="mt-0.5 font-thai text-[12px] text-ink-60">{sub}</div>}
      </div>
    </div>
  );
}

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

  return (
    <div className="report-chart rounded-2xl border border-ink-10 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: def.color }} aria-hidden />
          <h3 className="truncate font-thai text-[12.5px] font-bold text-ink">{def.label}</h3>
        </div>
        {summary?.avg != null && (
          <span className="shrink-0 font-mono text-[11px] font-bold" style={{ color: def.color }}>
            ⌀ {summary.avg.toFixed(def.digits ?? 0)}{def.unit}
          </span>
        )}
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {def.kind === "sleepStacked" ? (
            <BarChart data={data} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F2F0F3" vertical={false} />
              <XAxis dataKey="day" {...AXIS} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} minTickGap={20} />
              <YAxis {...AXIS} tickLine={false} axisLine={false} unit="h" />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, nm: any) => [`${v} ชม.`, nm]} />
              {def.refs?.map((r) => (
                <ReferenceLine key={r.value} y={r.value} stroke={r.tone === "good" ? "#16A34A" : "#DC2626"} strokeDasharray="4 3" strokeWidth={1} />
              ))}
              <Bar dataKey="deep_h" name="หลับลึก" stackId="s" fill="#4F46E5" />
              <Bar dataKey="rem_h" name="REM" stackId="s" fill="#6366F1" />
              <Bar dataKey="light_h" name="ตื้น" stackId="s" fill="#A5B4FC" radius={[5, 5, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
            </BarChart>
          ) : def.kind === "bar" ? (
            <BarChart data={data} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F2F0F3" vertical={false} />
              <XAxis dataKey="day" {...AXIS} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} minTickGap={20} />
              <YAxis {...AXIS} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              {def.refs?.map((r) => (
                <ReferenceLine key={r.value} y={r.value} stroke="#16A34A" strokeDasharray="4 3" strokeWidth={1}
                  label={{ value: r.label, fontSize: 9, fill: "#16A34A", position: "right" }} />
              ))}
              <Bar dataKey={metricKey} fill={def.color} radius={[5, 5, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 8, right: 10, left: -16, bottom: 0 }}>
              {def.zones?.map((z, i) => (
                <ReferenceArea key={i} y1={z.min} y2={z.max} fill={z.color} strokeOpacity={0} />
              ))}
              <CartesianGrid strokeDasharray="3 3" stroke="#F2F0F3" vertical={false} />
              <XAxis dataKey="day" {...AXIS} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} minTickGap={20} />
              <YAxis {...AXIS} tickLine={false} axisLine={false} unit={def.unit ? ` ${def.unit}` : ""}
                domain={["dataMin - 2", "dataMax + 2"]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              {def.refs?.map((r) => (
                <ReferenceLine key={r.value} y={r.value} stroke={r.tone === "good" ? "#16A34A" : "#DC2626"} strokeDasharray="4 3" strokeWidth={1}
                  label={{ value: r.label, fontSize: 9, fill: r.tone === "good" ? "#16A34A" : "#DC2626", position: "right" }} />
              ))}
              <Line type="monotone" dataKey={metricKey} stroke={def.color} strokeWidth={2.4} dot={false} connectNulls />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
