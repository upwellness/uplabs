"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, BarChart, Line, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ReferenceArea, Legend,
} from "recharts";
import {
  METRIC_REGISTRY, type WearableReport, type UnifiedDaily,
  type LabMetricTrend, type MetricSummary,
} from "@/lib/pulse/wearable-report";

interface Props {
  customer: { name: string; gender: string | null; age: number | null; height: number | null };
  report: WearableReport;
  labByCategory: Record<string, LabMetricTrend[]>;
  labDates: string[];
  generatedAt: string;
}

const fmtDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${parseInt(d)}/${parseInt(m)}`;
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

const STATUS_COLOR: Record<string, string> = {
  normal: "#16A34A", optimal: "#16A34A", high: "#DC2626", low: "#CA8A04",
  borderline: "#CA8A04", critical: "#DC2626", unknown: "#8A838E",
};
const CAT_LABEL: Record<string, string> = {
  lipid: "ไขมันในเลือด (Lipid)", glucose: "น้ำตาล (Glucose)", liver: "ตับ (Liver)",
  kidney: "ไต (Kidney)", cbc: "เม็ดเลือด (CBC)", uric: "กรดยูริค", thyroid: "ไทรอยด์",
  vitamin: "วิตามิน", cancer: "สารบ่งชี้มะเร็ง", cardiac: "หัวใจ", imaging: "ภาพถ่าย",
};

export function WearableReportView({ customer, report, labByCategory, labDates, generatedAt }: Props) {
  const groups = useMemo(() => {
    const g: Record<string, string[]> = { recovery: [], sleep: [], activity: [], body: [] };
    for (const key of report.available) {
      const def = METRIC_REGISTRY[key];
      if (def) g[def.group].push(key);
    }
    return g;
  }, [report.available]);

  const hasWearable = report.days > 0 && report.available.length > 0;
  const labCats = Object.keys(labByCategory);
  const hasLab = labCats.length > 0;

  return (
    <main className="report-root min-h-screen bg-surface">
      <style>{PRINT_CSS}</style>

      {/* ── Toolbar (screen only) ── */}
      <div className="no-print sticky top-0 z-30 border-b border-ink-10 bg-warm-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[920px] items-center justify-between px-6">
          <a href="/pulse" className="font-thai text-sm text-ink-40 hover:text-ink">← UP Pulse</a>
          <button
            onClick={() => window.print()}
            className="rounded-full bg-rose px-4 py-2 text-[13px] font-bold text-white hover:bg-rose-deep transition-colors"
          >
            🖨 Print / บันทึก PDF
          </button>
        </div>
      </div>

      {/* ── Report sheet ── */}
      <div className="report-sheet mx-auto max-w-[920px] px-6 py-8 print:px-0 print:py-0">

        {/* Header */}
        <header className="report-header rounded-3xl bg-gradient-to-br from-rose-deep via-rose to-rose-mid px-8 py-7 text-white print:rounded-none">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">UP Wellness · Longevity Report</div>
              <h1 className="mt-1 font-head text-[30px] font-extrabold leading-tight">{customer.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-thai text-[13px] text-white/85">
                <span>{customer.gender === "male" ? "ชาย" : "หญิง"}</span>
                {customer.age && <><Dot /><span>{customer.age} ปี</span></>}
                {customer.height && <><Dot /><span>{customer.height} cm</span></>}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] text-white/60">รายงานวันที่</div>
              <div className="font-head text-[15px] font-bold">{fmtDate(generatedAt)}</div>
              {report.dateStart && (
                <div className="mt-1 font-mono text-[10px] text-white/70">
                  ข้อมูล {fmtDate(report.dateStart)} – {fmtDate(report.dateEnd!)} · {report.days} วัน
                </div>
              )}
            </div>
          </div>
          {report.sources.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {report.sources.map((s) => (
                <span key={s} className="rounded-full bg-white/15 px-3 py-1 font-mono text-[10px] font-bold backdrop-blur-sm">
                  📡 {s}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Empty state */}
        {!hasWearable && !hasLab && (
          <div className="mt-8 rounded-2xl border border-dashed border-ink-10 bg-white py-16 text-center">
            <div className="text-4xl">📊</div>
            <p className="mt-3 font-thai text-[14px] text-ink-50">ยังไม่มีข้อมูล wearable หรือผลเลือด</p>
            <p className="mt-1 font-thai text-[12px] text-ink-40">เชื่อม WHOOP / Google Fit หรือเพิ่มผลแล็บก่อน</p>
          </div>
        )}

        {/* ── Summary score cards ── */}
        {hasWearable && (
          <section className="report-block mt-7">
            <SectionTitle n="01" eyebrow="Summary" title="สรุปค่าเฉลี่ย" sub={`เฉลี่ย ${report.summaries[report.available[0]]?.windowDays ?? 30} วันล่าสุด`} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {report.available
                .filter((k) => k !== "sleep_stages")
                .map((k) => <ScoreCard key={k} summary={report.summaries[k]} />)}
            </div>
          </section>
        )}

        {/* ── Charts by group ── */}
        {hasWearable && (["recovery", "sleep", "activity", "body"] as const).map((grp, gi) => {
          const keys = groups[grp];
          if (keys.length === 0) return null;
          return (
            <section key={grp} className="report-block mt-8">
              <SectionTitle
                n={String(gi + 2).padStart(2, "0")}
                eyebrow={GROUP_EYEBROW[grp]}
                title={GROUP_TITLE[grp]}
              />
              <div className="grid gap-4 md:grid-cols-2">
                {keys.map((k) => <MetricChart key={k} metricKey={k} series={report.series} summary={report.summaries[k]} />)}
              </div>
            </section>
          );
        })}

        {/* ── Lab trends ── */}
        {hasLab && (
          <section className="report-block mt-8">
            <SectionTitle n={String(2 + (["recovery","sleep","activity","body"] as const).filter(g => groups[g].length).length).padStart(2, "0")}
              eyebrow="Blood Work" title="ผลเลือด" sub={`${labDates.length} ครั้ง · ${labDates.map(fmtDate).join(" · ")}`} />
            {labCats.map((cat) => (
              <div key={cat} className="mt-4">
                <div className="mb-2 font-head text-[14px] font-bold text-ink">{CAT_LABEL[cat] ?? cat}</div>
                <div className="overflow-hidden rounded-2xl border border-ink-10 bg-white">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-ink-10 bg-surface/60">
                        <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-ink-40">รายการ</th>
                        {labDates.map((d) => (
                          <th key={d} className="px-3 py-2.5 text-right font-mono text-[10px] text-ink-40 whitespace-nowrap">{fmtDate(d)}</th>
                        ))}
                        <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-wider text-ink-40">เกณฑ์</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labByCategory[cat].map((m) => (
                        <tr key={m.key} className="border-b border-ink-5 last:border-0">
                          <td className="px-4 py-2.5 font-thai text-[13px] font-semibold text-ink">{m.label}</td>
                          {labDates.map((d) => {
                            const p = m.points.find((x) => x.date === d);
                            return (
                              <td key={d} className="px-3 py-2.5 text-right font-mono text-[13px] whitespace-nowrap"
                                  style={{ color: p ? (STATUS_COLOR[p.status ?? "unknown"]) : "#BAB5BD" }}>
                                {p ? p.value : "—"}
                                {p && p.status && p.status !== "normal" && p.status !== "optimal" && (
                                  <span className="ml-1 text-[9px]">{p.status === "high" ? "↑" : p.status === "low" ? "↓" : ""}</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-2.5 text-right font-mono text-[10px] text-ink-40 whitespace-nowrap">
                            {m.ref_text ?? (m.ref_low != null || m.ref_high != null ? `${m.ref_low ?? ""}–${m.ref_high ?? ""}` : "")} {m.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Footer */}
        <footer className="report-footer mt-10 border-t border-ink-10 pt-5 text-center">
          <div className="font-head text-[14px] font-bold text-rose">UP Wellness · Longevity Care</div>
          <p className="mt-1 font-thai text-[11px] text-ink-40 leading-relaxed max-w-lg mx-auto">
            รายงานนี้จัดทำเพื่อการดูแลสุขภาพเชิงป้องกัน (wellness) ไม่ใช่การวินิจฉัยทางการแพทย์ ·
            ค่าจาก wearable มีความคลาดเคลื่อนได้ · ปรึกษาแพทย์สำหรับการตัดสินใจด้านสุขภาพ
          </p>
          <p className="mt-2 font-mono text-[10px] text-ink-30">สร้าง {new Date(generatedAt).toLocaleString("th-TH")}</p>
        </footer>
      </div>
    </main>
  );
}

/* ───────────────── components ───────────────── */

const GROUP_EYEBROW = { recovery: "Recovery & Heart", sleep: "Sleep", activity: "Activity", body: "Body" } as const;
const GROUP_TITLE = { recovery: "การฟื้นตัวและหัวใจ", sleep: "การนอน", activity: "กิจกรรม", body: "องค์ประกอบร่างกาย" } as const;

function Dot() { return <span className="inline-block h-1 w-1 rounded-full bg-white/50" />; }

function SectionTitle({ n, eyebrow, title, sub }: { n: string; eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose text-[14px] font-extrabold text-white">{n}</div>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-rose">{eyebrow}</div>
        <div className="font-head text-[19px] font-extrabold leading-tight text-ink">{title}</div>
        {sub && <div className="mt-0.5 font-thai text-[11.5px] text-ink-40">{sub}</div>}
      </div>
    </div>
  );
}

function ScoreCard({ summary }: { summary: MetricSummary }) {
  const { def, avg, latest } = summary;
  const v = avg ?? latest;
  if (v == null) return null;
  return (
    <div className="rounded-2xl border border-ink-10 bg-white px-4 py-3.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-40 line-clamp-1">{def.label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="font-head text-[24px] font-extrabold leading-none text-ink" style={{ color: def.color }}>
          {v.toFixed(def.digits ?? 0)}
        </span>
        {def.unit && <span className="text-[11px] text-ink-40">{def.unit}</span>}
      </div>
      {summary.min != null && summary.max != null && (
        <div className="mt-1 font-mono text-[10px] text-ink-30">
          {summary.min.toFixed(def.digits ?? 0)}–{summary.max.toFixed(def.digits ?? 0)}
        </div>
      )}
    </div>
  );
}

const TOOLTIP_STYLE = { background: "#fff", border: "1px solid #DDD9DF", borderRadius: 10, fontSize: 12 };
const AXIS = { stroke: "#94A3B8", fontSize: 10 };

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
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: def.color }} />
          <h3 className="font-thai text-[12.5px] font-bold text-ink truncate">{def.label}</h3>
        </div>
        {summary.avg != null && (
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
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, n: any) => [`${v} ชม.`, n]} />
              {def.refs?.map((r) => (
                <ReferenceLine key={r.value} y={r.value} stroke={r.tone === "good" ? "#16A34A" : "#DC2626"} strokeDasharray="4 3" strokeWidth={1} />
              ))}
              <Bar dataKey="deep_h"  name="หลับลึก" stackId="s" fill="#4F46E5" radius={[0,0,0,0]} />
              <Bar dataKey="rem_h"   name="REM"     stackId="s" fill="#6366F1" />
              <Bar dataKey="light_h" name="ตื้น"    stackId="s" fill="#A5B4FC" radius={[5,5,0,0]} />
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
              {/* HRV chart also draws RHR if present */}
              <Line type="monotone" dataKey={metricKey} stroke={def.color} strokeWidth={2.4} dot={false} connectNulls />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ───────────────── print CSS ───────────────── */

const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  .report-root { background: #fff !important; }
  .report-sheet { max-width: none !important; }
  .report-block, .report-chart, .report-header, .report-footer { break-inside: avoid; }
  section.report-block { break-inside: auto; }
  @page { size: A4; margin: 14mm; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
