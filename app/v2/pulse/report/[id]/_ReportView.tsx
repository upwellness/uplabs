"use client";

/**
 * UP Labs v2 · Pulse — Unified Wearable + Longevity report (SPEC §7.6) — clinical-warm.
 * ──────────────────────────────────────────────────────────────────────────────────
 * Renders the SAME data model as v1 WearableReportView (built server-side via
 * buildWearableReport / buildLabTrends in lib/pulse/wearable-report.ts — identical
 * logic), but with the v2 design language:
 *   - solid warm header (no aurora), Lucide icons, sentence-case labels, ≥12px text
 *   - summary score cards · Longevity L1–L4 coverage panel · per-group charts ·
 *     lab trend tables · Print to PDF
 *
 * recharts is lazy-imported via next/dynamic so it stays OUT of First-Load JS;
 * the charts only mount when there's wearable data to show.
 */

import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
  Printer, ArrowLeft, Activity, HeartPulse, Moon, Footprints, FlaskConical, Gauge,
  Radio, ShieldCheck, CheckCircle2, CircleDashed,
} from "lucide-react";
import {
  METRIC_REGISTRY, type WearableReport, type LabMetricTrend, type MetricSummary,
} from "@/lib/pulse/wearable-report";

const ChartGroups = dynamic(() => import("./_Charts").then((m) => m.ChartGroups), {
  ssr: false,
  loading: () => (
    <div className="mt-7 rounded-2xl border border-ink-10 bg-white py-12 text-center">
      <Gauge size={22} className="mx-auto animate-pulse text-rose" aria-hidden />
      <p className="mt-2 font-thai text-[12.5px] text-ink-60">กำลังโหลดกราฟแนวโน้ม…</p>
    </div>
  ),
});

interface Props {
  customerId: string;
  customer: { name: string; gender: string | null; age: number | null; height: number | null; birthDate: string | null };
  report: WearableReport;
  labByCategory: Record<string, LabMetricTrend[]>;
  labDates: string[];
  generatedAt: string;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

const STATUS_COLOR: Record<string, string> = {
  normal: "#15803D", optimal: "#15803D", high: "#991B1B", low: "#854D0E",
  borderline: "#854D0E", critical: "#991B1B", unknown: "#5C5660",
};
const CAT_LABEL: Record<string, string> = {
  lipid: "ไขมันในเลือด (Lipid)", glucose: "น้ำตาล (Glucose)", liver: "ตับ (Liver)",
  kidney: "ไต (Kidney)", cbc: "เม็ดเลือด (CBC)", uric: "กรดยูริค", thyroid: "ไทรอยด์",
  vitamin: "วิตามิน", cancer: "สารบ่งชี้มะเร็ง", cardiac: "หัวใจ", imaging: "ภาพถ่าย",
};

/** Longevity L1–L4 — 4 pillars mapped onto the metric registry groups (SPEC §7.6). */
const LONGEVITY: { level: string; title: string; sub: string; icon: any; group: "recovery" | "sleep" | "activity" | "body" }[] = [
  { level: "L1", title: "การฟื้นตัว & หัวใจ", sub: "Recovery · HRV · ชีพจรพัก · SpO₂", icon: HeartPulse, group: "recovery" },
  { level: "L2", title: "การนอน", sub: "คุณภาพ · ระยะหลับลึก/REM · ประสิทธิภาพ", icon: Moon, group: "sleep" },
  { level: "L3", title: "การเคลื่อนไหว", sub: "ก้าวเดิน · นาที active · แคลอรี · strain", icon: Footprints, group: "activity" },
  { level: "L4", title: "ร่างกาย & เลือด", sub: "น้ำหนัก · ไขมัน · ผลแล็บ", icon: FlaskConical, group: "body" },
];

export function ReportView({ customerId, customer, report, labByCategory, labDates, generatedAt }: Props) {
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
  const summaryKeys = report.available.filter((k) => k !== "sleep_stages");
  const groupCount = (["recovery", "sleep", "activity", "body"] as const).filter((g) => groups[g].length).length;

  return (
    <main className="report-root min-h-screen bg-surface">
      <style>{PRINT_CSS}</style>

      {/* Toolbar (screen only) */}
      <div className="no-print sticky top-0 z-30 border-b border-ink-10 bg-warm-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[920px] items-center justify-between px-6">
          <a href={`/v2/pulse?customer=${customerId}`} className="inline-flex items-center gap-1.5 font-thai text-[13px] font-semibold text-ink-60 transition-colors hover:text-rose">
            <ArrowLeft size={15} strokeWidth={2.25} aria-hidden /> กลับไป UP Pulse
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-rose-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            <Printer size={15} strokeWidth={2.25} aria-hidden /> พิมพ์ / บันทึก PDF
          </button>
        </div>
      </div>

      {/* Report sheet */}
      <div className="report-sheet mx-auto max-w-[920px] px-6 py-8 print:px-0 print:py-0">

        {/* Header — solid warm gradient, identity (SPEC §4: ชื่อ/DOB/อายุ/เพศ/ส่วนสูง) */}
        <header className="report-header overflow-hidden rounded-3xl bg-gradient-to-br from-rose-deep via-rose to-rose-mid px-8 py-7 text-white print:rounded-none">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/75">
                <Activity size={13} strokeWidth={2.5} aria-hidden /> UP Wellness · Longevity Report
              </div>
              <h1 className="mt-1 font-head text-[30px] font-extrabold leading-tight">{customer.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-thai text-[13px] text-white/85">
                {customer.birthDate && <span className="font-mono">{customer.birthDate}</span>}
                {customer.birthDate && <Dot />}
                <span>{customer.gender === "male" ? "ชาย" : customer.gender === "female" ? "หญิง" : "—"}</span>
                {customer.age != null && <><Dot /><span>{customer.age} ปี</span></>}
                {customer.height != null && <><Dot /><span>{customer.height} ซม.</span></>}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] text-white/65">รายงานวันที่</div>
              <div className="font-head text-[15px] font-bold">{fmtDate(generatedAt)}</div>
              {report.dateStart && (
                <div className="mt-1 font-mono text-[10px] text-white/75">
                  ข้อมูล {fmtDate(report.dateStart)} – {fmtDate(report.dateEnd!)} · {report.days} วัน
                </div>
              )}
            </div>
          </div>
          {report.sources.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {report.sources.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 font-mono text-[10px] font-bold backdrop-blur-sm">
                  <Radio size={11} strokeWidth={2.5} aria-hidden /> {s}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Empty state */}
        {!hasWearable && !hasLab && (
          <div className="mt-8 rounded-2xl border border-dashed border-ink-10 bg-white py-16 text-center">
            <Gauge size={34} className="mx-auto text-ink-30" aria-hidden />
            <p className="mt-3 font-thai text-[14px] text-ink-60">ยังไม่มีข้อมูล wearable หรือผลเลือด</p>
            <p className="mt-1 font-thai text-[12px] text-ink-40">เชื่อม WHOOP / Google Fit / Apple หรือเพิ่มผลแล็บก่อน</p>
            <a href={`/v2/pulse/master/${customerId}`} className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-4 py-2 text-[12px] font-semibold text-white hover:bg-rose-mid">
              <Activity size={14} strokeWidth={2.25} aria-hidden /> จัดการอุปกรณ์ &amp; นำเข้าข้อมูล
            </a>
          </div>
        )}

        {/* Longevity L1–L4 coverage */}
        {(hasWearable || hasLab) && (
          <section className="report-block mt-7">
            <SectionTitle n="01" eyebrow="Longevity" title="ภาพรวม Longevity L1–L4" sub="สิ่งที่ติดตามได้จากข้อมูลปัจจุบัน" icon={ShieldCheck} />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {LONGEVITY.map((p) => {
                const keys = p.group === "body"
                  ? [...groups.body, ...(hasLab ? ["__lab"] : [])]
                  : groups[p.group];
                const tracked = keys.length;
                const sampleLabels = (p.group === "body" ? groups.body : groups[p.group])
                  .map((k) => METRIC_REGISTRY[k]?.label.split(" (")[0]).filter(Boolean);
                if (p.group === "body" && hasLab) sampleLabels.push("ผลเลือด");
                const active = tracked > 0;
                return (
                  <div key={p.level} className={`rounded-2xl border p-4 ${active ? "border-ink-10 bg-white" : "border-dashed border-ink-10 bg-surface/40"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${active ? "bg-rose-ultra text-rose" : "bg-ink-5 text-ink-30"}`}>
                        <p.icon size={17} strokeWidth={2} aria-hidden />
                      </span>
                      {active
                        ? <CheckCircle2 size={16} strokeWidth={2.25} className="text-status-optimal" aria-label="มีข้อมูล" />
                        : <CircleDashed size={16} strokeWidth={2.25} className="text-ink-30" aria-label="ยังไม่มีข้อมูล" />}
                    </div>
                    <div className="mt-2.5 flex items-baseline gap-1.5">
                      <span className="font-mono text-[11px] font-bold text-rose">{p.level}</span>
                      <span className="font-head text-[14px] font-bold leading-tight text-ink">{p.title}</span>
                    </div>
                    <p className="mt-1 font-thai text-[11px] leading-snug text-ink-60">
                      {active ? (sampleLabels.slice(0, 4).join(" · ") || p.sub) : p.sub}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Summary score cards */}
        {hasWearable && (
          <section className="report-block mt-7">
            <SectionTitle n="02" eyebrow="Summary" title="สรุปค่าเฉลี่ย" sub={`เฉลี่ย ${report.summaries[summaryKeys[0]]?.windowDays ?? 30} วันล่าสุด`} icon={Gauge} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {summaryKeys.map((k) => <ScoreCard key={k} summary={report.summaries[k]} />)}
            </div>
          </section>
        )}

        {/* Charts by group (lazy recharts) — numbered after the 2 fixed sections above */}
        {hasWearable && (
          <ChartGroups groups={groups} series={report.series} summaries={report.summaries} startN={3} />
        )}

        {/* Lab trends */}
        {hasLab && (
          <section className="report-block mt-8">
            <SectionTitle
              n={String(3 + groupCount).padStart(2, "0")}
              eyebrow="Blood Work" title="ผลเลือด"
              sub={`${labDates.length} ครั้ง · ${labDates.map(fmtDate).join(" · ")}`}
              icon={FlaskConical}
            />
            {labCats.map((cat) => (
              <div key={cat} className="mt-4">
                <div className="mb-2 font-head text-[14px] font-bold text-ink">{CAT_LABEL[cat] ?? cat}</div>
                <div className="overflow-x-auto rounded-2xl border border-ink-10 bg-white">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-ink-10 bg-surface/60">
                        <th className="px-4 py-2.5 text-[11px] font-semibold text-ink-60">รายการ</th>
                        {labDates.map((d) => (
                          <th key={d} className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-[10px] text-ink-60">{fmtDate(d)}</th>
                        ))}
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-ink-60">เกณฑ์</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labByCategory[cat].map((m) => (
                        <tr key={m.key} className="border-b border-ink-5 last:border-0">
                          <td className="px-4 py-2.5 font-thai text-[13px] font-semibold text-ink">{m.label}</td>
                          {labDates.map((d) => {
                            const p = m.points.find((x) => x.date === d);
                            return (
                              <td key={d} className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-[13px]"
                                  style={{ color: p ? STATUS_COLOR[p.status ?? "unknown"] : "#BAB5BD", fontWeight: p && p.status && p.status !== "normal" && p.status !== "optimal" ? 700 : 400 }}>
                                {p ? p.value : "—"}
                                {p && p.status && p.status !== "normal" && p.status !== "optimal" && (
                                  <span className="ml-1 text-[9px]">{p.status === "high" ? "↑" : p.status === "low" ? "↓" : ""}</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-[10px] text-ink-60">
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
          <p className="mx-auto mt-1 max-w-lg font-thai text-[11px] leading-relaxed text-ink-60">
            รายงานนี้จัดทำเพื่อการดูแลสุขภาพเชิงป้องกัน (wellness) ไม่ใช่การวินิจฉัยทางการแพทย์ ·
            ค่าจาก wearable มีความคลาดเคลื่อนได้ · ปรึกษาแพทย์สำหรับการตัดสินใจด้านสุขภาพ
          </p>
          <p className="mt-2 font-mono text-[10px] text-ink-40">สร้าง {new Date(generatedAt).toLocaleString("th-TH")}</p>
        </footer>
      </div>
    </main>
  );
}

/* ── components ── */

function Dot() { return <span className="inline-block h-1 w-1 rounded-full bg-white/50" aria-hidden />; }

function SectionTitle({ n, eyebrow, title, sub, icon: Icon }: { n: string; eyebrow: string; title: string; sub?: string; icon: any }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose text-white">
        <Icon size={17} strokeWidth={2.25} aria-hidden />
      </div>
      <div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose">
          <span className="font-mono">{n}</span> · {eyebrow}
        </div>
        <div className="font-head text-[18px] font-extrabold leading-tight text-ink">{title}</div>
        {sub && <div className="mt-0.5 font-thai text-[12px] text-ink-60">{sub}</div>}
      </div>
    </div>
  );
}

function ScoreCard({ summary }: { summary: MetricSummary }) {
  if (!summary) return null;
  const { def, avg, latest } = summary;
  const v = avg ?? latest;
  if (v == null) return null;
  return (
    <div className="rounded-2xl border border-ink-10 bg-white px-4 py-3.5">
      <div className="line-clamp-1 text-[11px] font-semibold text-ink-60">{def.label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="font-head text-[24px] font-extrabold leading-none" style={{ color: def.color }}>{v.toFixed(def.digits ?? 0)}</span>
        {def.unit && <span className="font-mono text-[11px] text-ink-60">{def.unit}</span>}
      </div>
      {summary.min != null && summary.max != null && (
        <div className="mt-1 font-mono text-[10px] text-ink-40">
          {summary.min.toFixed(def.digits ?? 0)}–{summary.max.toFixed(def.digits ?? 0)}
        </div>
      )}
    </div>
  );
}

/* ── print CSS ── */
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
