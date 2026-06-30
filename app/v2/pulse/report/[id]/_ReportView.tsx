"use client";

/**
 * UP Labs v2 · Pulse — Unified Wearable + Longevity report (SPEC §7.6).
 * ─────────────────────────────────────────────────────────────────────
 * Premium "Pook" medical-report CI (olive / gold / cream) — a DISTINCT deliverable
 * from the app's clinical-warm UI (intentional). Self-contained: scoped tokens under
 * `.rpt`, Kanit+Sarabun web fonts loaded inline, no Tailwind dependency for the report
 * chrome. Mirrors 05_Reports/Wearable-Reports/Pook-Whoop-Report-v2.html:
 *   - olive→gold hero · SVG score gauges · sticky scroll-jump TOC index ·
 *     font-size control + print button · numbered section cards · findings/focus boxes
 *
 * NEW conditional analysis sections (render ONLY when the data exists):
 *   BCA (body composition) · CGM (glucose) · Food (nutrition) · Combined insight.
 *
 * Charts are lazy-imported (next/dynamic) so recharts stays OUT of First-Load JS.
 */

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  METRIC_REGISTRY, type WearableReport, type LabMetricTrend, type MetricSummary,
} from "@/lib/pulse/wearable-report";
import type { BcaSummary, CgmSummary, FoodSummary } from "@/lib/pulse/extra-report";
import { TIR_LOW, TIR_HIGH } from "@/lib/pulse/extra-report";
import { REPORT_CSS } from "./_report-css";

const Charts = dynamic(() => import("./_Charts").then((m) => m.ReportCharts), {
  ssr: false,
  loading: () => (
    <div className="rpt-chart-loading">
      <div className="rpt-spinner" aria-hidden />
      <span>กำลังโหลดกราฟแนวโน้ม…</span>
    </div>
  ),
});

interface Props {
  customerId: string;
  customer: { name: string; gender: string | null; age: number | null; height: number | null; birthDate: string | null };
  report: WearableReport;
  labByCategory: Record<string, LabMetricTrend[]>;
  labDates: string[];
  bca: BcaSummary | null;
  cgm: CgmSummary | null;
  food: FoodSummary | null;
  combinedInsight: string[];
  generatedAt: string;
}

const C = {
  olive: "#3D5826", gold: "#C99D2F", green: "#5A7A3A",
  amber: "#D89A1E", red: "#C2533F", blue: "#3E6E8E",
};
const STATUS_COLOR: Record<string, string> = {
  normal: "#5A7A3A", optimal: "#5A7A3A", high: "#C2533F", low: "#D89A1E",
  borderline: "#D89A1E", critical: "#C2533F", unknown: "#8B8880",
};
const CAT_LABEL: Record<string, string> = {
  lipid: "ไขมันในเลือด (Lipid)", glucose: "น้ำตาล (Glucose)", liver: "ตับ (Liver)",
  kidney: "ไต (Kidney)", cbc: "เม็ดเลือด (CBC)", uric: "กรดยูริค", thyroid: "ไทรอยด์",
  vitamin: "วิตามิน", cancer: "สารบ่งชี้มะเร็ง", cardiac: "หัวใจ", imaging: "ภาพถ่าย",
};
const GROUP_TITLE: Record<string, string> = {
  recovery: "การฟื้นตัวและหัวใจ", sleep: "การนอน", activity: "กิจกรรม", body: "องค์ประกอบร่างกาย",
};
const GROUP_EYEBROW: Record<string, string> = {
  recovery: "Recovery & Heart", sleep: "Sleep", activity: "Activity", body: "Body",
};
const GROUPS = ["recovery", "sleep", "activity", "body"] as const;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

/* score-gauge picks: prefer these metrics in this order for the hero strip */
const GAUGE_ORDER = ["recovery", "sleep_perf", "hrv", "spo2", "strain", "sleep_eff", "rhr"];

export function ReportView(props: Props) {
  const { customerId, customer, report, labByCategory, labDates, bca, cgm, food, combinedInsight, generatedAt } = props;

  // group available wearable metrics
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
  const hasBca = !!bca;
  const hasCgm = !!cgm;
  const hasFood = !!food;
  const hasCombined = combinedInsight.length > 0;
  const empty = !hasWearable && !hasLab && !hasBca && !hasCgm && !hasFood;

  const groupCount = GROUPS.filter((g) => groups[g].length).length;

  // gauges from summaries
  const gauges = useMemo(() => {
    const picks = GAUGE_ORDER.filter((k) => report.summaries[k]?.avg != null).slice(0, 4);
    return picks.map((k) => report.summaries[k]);
  }, [report.summaries]);

  /* ── build the Table of Contents (skip absent sections) ── */
  const toc = useMemo(() => {
    const items: { id: string; label: string }[] = [];
    let n = 1;
    const add = (id: string, label: string) => { items.push({ id, label: `${String(n).padStart(2, "0")} · ${label}` }); n++; };
    if (hasWearable) add("sec-summary", "สรุปค่าเฉลี่ย");
    if (hasWearable) {
      for (const g of GROUPS) if (groups[g].length) add(`sec-${g}`, GROUP_TITLE[g]);
    }
    if (hasBca) add("sec-bca", "องค์ประกอบร่างกาย");
    if (hasCgm) add("sec-cgm", "น้ำตาลในเลือด (CGM)");
    if (hasFood) add("sec-food", "โภชนาการ");
    if (hasLab) add("sec-lab", "ผลเลือด");
    if (hasCombined) add("sec-combined", "ภาพรวมเชื่อมโยง");
    return items;
  }, [hasWearable, hasBca, hasCgm, hasFood, hasLab, hasCombined, groups]);

  // numbering helper synced with TOC order
  let secN = 0;
  const nextN = () => String(++secN).padStart(2, "0");

  return (
    <main className="rpt">
      {/* self-contained fonts + scoped tokens */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&family=Sarabun:wght@300;400;500;600;700&family=Lora:ital@1&display=swap"
        rel="stylesheet"
      />
      <style>{REPORT_CSS}</style>

      <ProgressBar />
      <FontSizeControl />
      <PrintButton />

      <div id="rpt-doc">

        {/* ═══ HERO ═══ */}
        <header className="rpt-hero">
          <div className="rpt-hero-grid" />
          <div className="rpt-wrap rpt-hero-inner">
            <a href={`/v2/pulse?customer=${customerId}`} className="rpt-back no-print">← กลับไป UP Pulse</a>
            <span className="rpt-kicker"><span className="dot" />Longevity Health Report</span>
            <h1>สุขภาพเชิงลึก<br /><span className="accent">{customer.name}</span></h1>
            <p className="rpt-hero-sub">
              รายงานวิเคราะห์ข้อมูลสุขภาพเชิงลึก — wearable, ผลเลือด{hasBca ? ", องค์ประกอบร่างกาย" : ""}
              {hasCgm ? ", น้ำตาล" : ""}{hasFood ? ", โภชนาการ" : ""} พร้อมการตีความและคำแนะนำเฉพาะบุคคล
            </p>
            <div className="rpt-hero-meta">
              <span className="chip">👤 <b>{customer.gender === "male" ? "ชาย" : customer.gender === "female" ? "หญิง" : "—"}</b>
                {customer.age != null ? ` · ${customer.age} ปี` : ""}</span>
              {customer.birthDate && <span className="chip">🎂 <b>{customer.birthDate}</b></span>}
              {customer.height != null && <span className="chip">📏 <b>{customer.height}</b> ซม.</span>}
              {report.dateStart && <span className="chip">📅 <b>{fmtDate(report.dateStart)} – {fmtDate(report.dateEnd!)}</b></span>}
              {report.days > 0 && <span className="chip">🗓 <b>{report.days}</b> วัน</span>}
              {report.sources.map((s) => <span key={s} className="chip">📡 {s}</span>)}
            </div>
          </div>
        </header>

        {/* ═══ SCORE STRIP (gauges) ═══ */}
        {gauges.length > 0 && (
          <div className="rpt-wrap rpt-scorestrip">
            <div className="rpt-score-cards">
              {gauges.map((g) => <ScoreGauge key={g.def.key} summary={g} />)}
            </div>
          </div>
        )}

        {/* ═══ TOC INDEX (sticky) ═══ */}
        {toc.length > 1 && (
          <nav className="rpt-toc no-print" aria-label="สารบัญรายงาน">
            <div className="rpt-wrap">
              <div className="rpt-toc-inner">
                <span className="rpt-toc-label">สารบัญ</span>
                <div className="rpt-toc-links">
                  {toc.map((t) => (
                    <a key={t.id} href={`#${t.id}`} className="rpt-toc-link"
                       onClick={(e) => { e.preventDefault(); document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
                      {t.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </nav>
        )}

        {/* ═══ EMPTY ═══ */}
        {empty && (
          <section className="rpt-section"><div className="rpt-wrap">
            <div className="rpt-empty">
              <div className="rpt-empty-ic">📊</div>
              <p className="t">ยังไม่มีข้อมูล wearable, ผลเลือด หรือข้อมูลสุขภาพอื่น</p>
              <p className="s">เชื่อม WHOOP / Google Fit / Apple, นำเข้าผลแล็บ หรือบันทึก BCA / CGM / อาหารก่อน</p>
              <a href={`/v2/pulse/master/${customerId}`} className="rpt-empty-btn">จัดการอุปกรณ์ &amp; นำเข้าข้อมูล</a>
            </div>
          </div></section>
        )}

        {/* ═══ 1 · WEARABLE SUMMARY ═══ */}
        {hasWearable && (
          <section id="sec-summary" className="rpt-section"><div className="rpt-wrap">
            <SecHead n={nextN()} eyebrow="Summary" title="สรุปค่าเฉลี่ย"
              sub={`เฉลี่ย ${report.summaries[report.available[0]]?.windowDays ?? 30} วันล่าสุด · ${report.sources.join(" · ")}`} />
            <div className="rpt-card"><div className="rpt-card-pad">
              <div className="rpt-statrow">
                {report.available.filter((k) => k !== "sleep_stages").map((k) => {
                  const s = report.summaries[k];
                  const v = s?.avg ?? s?.latest;
                  if (v == null) return null;
                  return (
                    <div className="rpt-stat" key={k}>
                      <div className="v" style={{ color: s.def.color }}>{v.toFixed(s.def.digits ?? 0)}<span className="u">{s.def.unit}</span></div>
                      <div className="l">{s.def.label.split(" (")[0]}</div>
                      {s.min != null && s.max != null && (
                        <div className="sub">{s.min.toFixed(s.def.digits ?? 0)}–{s.max.toFixed(s.def.digits ?? 0)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div></div>
          </div></section>
        )}

        {/* ═══ WEARABLE CHARTS by group + BCA/CGM/Food charts (lazy recharts) ═══ */}
        {(hasWearable || hasBca || hasCgm || hasFood) && (
          <Charts
            groups={groups}
            series={report.series}
            summaries={report.summaries}
            bca={bca}
            cgm={cgm}
            food={food}
            sectionNumbers={{
              recovery: hasWearable && groups.recovery.length ? nextN() : null,
              sleep: hasWearable && groups.sleep.length ? nextN() : null,
              activity: hasWearable && groups.activity.length ? nextN() : null,
              body: hasWearable && groups.body.length ? nextN() : null,
              bca: hasBca ? nextN() : null,
              cgm: hasCgm ? nextN() : null,
              food: hasFood ? nextN() : null,
            }}
            meta={{
              groupTitle: GROUP_TITLE, groupEyebrow: GROUP_EYEBROW,
              tirLow: TIR_LOW, tirHigh: TIR_HIGH,
            }}
          />
        )}

        {/* ═══ LAB TRENDS ═══ */}
        {hasLab && (
          <section id="sec-lab" className="rpt-section"><div className="rpt-wrap">
            <SecHead n={nextN()} eyebrow="Blood Work" title="ผลเลือด"
              sub={`${labDates.length} ครั้ง · ${labDates.map(fmtDate).join(" · ")}`} />
            {labCats.map((cat) => (
              <div className="rpt-labcat" key={cat}>
                <div className="rpt-labcat-title">{CAT_LABEL[cat] ?? cat}</div>
                <div className="rpt-card rpt-table-wrap">
                  <table className="rpt-table">
                    <thead>
                      <tr>
                        <th>รายการ</th>
                        {labDates.map((d) => <th key={d} className="num">{fmtDate(d)}</th>)}
                        <th className="num">เกณฑ์</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labByCategory[cat].map((m) => (
                        <tr key={m.key}>
                          <td className="name">{m.label}</td>
                          {labDates.map((d) => {
                            const p = m.points.find((x) => x.date === d);
                            const abnormal = p && p.status && p.status !== "normal" && p.status !== "optimal";
                            return (
                              <td key={d} className="num" style={{ color: p ? STATUS_COLOR[p.status ?? "unknown"] : "#C7C3B8", fontWeight: abnormal ? 700 : 400 }}>
                                {p ? p.value : "—"}
                                {abnormal && <span className="arrow"> {p!.status === "high" ? "↑" : p!.status === "low" ? "↓" : ""}</span>}
                              </td>
                            );
                          })}
                          <td className="num ref">
                            {m.ref_text ?? (m.ref_low != null || m.ref_high != null ? `${m.ref_low ?? ""}–${m.ref_high ?? ""}` : "")} {m.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div></section>
        )}

        {/* ═══ COMBINED INSIGHT ═══ */}
        {hasCombined && (
          <section id="sec-combined" className="rpt-section"><div className="rpt-wrap">
            <SecHead n={nextN()} eyebrow="Connected Insight" title="ภาพรวมเชื่อมโยง"
              sub="ความสัมพันธ์ระหว่างข้อมูลแต่ละด้าน — แปลผลเชิงเชื่อมโยง" />
            <div className="rpt-card"><div className="rpt-card-pad">
              <div className="rpt-insight-list">
                {combinedInsight.map((line, i) => (
                  <div className="rpt-insight-item" key={i}>
                    <span className="ii">🔗</span><p>{line}</p>
                  </div>
                ))}
              </div>
            </div></div>
          </div></section>
        )}

        {/* ═══ DISCLAIMER ═══ */}
        {!empty && (
          <section className="rpt-section" style={{ paddingTop: 0 }}><div className="rpt-wrap">
            <div className="rpt-disclaimer">
              <b>⚕️ ข้อจำกัดและคำแนะนำ</b><br />
              รายงานนี้จัดทำเพื่อการดูแลสุขภาพเชิงป้องกัน (wellness) เท่านั้น <b>ไม่ใช่การวินิจฉัยหรือรักษาทางการแพทย์</b> ·
              ค่าจาก wearable และ CGM มีความคลาดเคลื่อนได้ · การตีความเป็นข้อมูลทั่วไปจากตัวเลข ควรปรึกษาแพทย์/เภสัชกรก่อนปรับยา อาหารเสริม หรือการรักษา โดยเฉพาะหากมีโรคประจำตัว
            </div>
          </div></section>
        )}

        {/* ═══ FOOTER ═══ */}
        <footer className="rpt-footer">
          <div className="rpt-wrap">
            <div className="fb">UP Wellness · Longevity Care</div>
            <div className="ftline">รายงานสุขภาพเชิงลึกแบบรวมศูนย์</div>
            <div className="ft-tag">"แก่ช้า · เจ็บสั้น · ตายดี"</div>
            <div className="meta">สร้างเมื่อ {new Date(generatedAt).toLocaleString("th-TH")}</div>
          </div>
        </footer>
      </div>
    </main>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

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

/** SVG donut gauge (replaces the Pook Chart.js doughnut) — olive/gold tinted. */
function ScoreGauge({ summary }: { summary: MetricSummary }) {
  const { def, avg, latest, min, max } = summary;
  const v = avg ?? latest;
  if (v == null) return null;
  // scale: % metrics 0–100, others use a sensible max
  const scaleMax = def.unit === "%" ? 100 : def.key === "hrv" ? 70 : def.key === "rhr" ? 100 : def.key === "strain" ? 21 : Math.max(v * 1.5, 1);
  const pct = Math.max(0, Math.min(1, v / scaleMax));
  const R = 42, CIRC = 2 * Math.PI * R;
  const dash = CIRC * pct;

  // tone — green if good, amber/red if needs attention (rough heuristic by metric)
  let tone: "good" | "ok" | "watch" = "ok";
  if (def.key === "spo2") tone = v >= 95 ? "good" : v >= 93 ? "ok" : "watch";
  else if (def.key === "recovery") tone = v >= 67 ? "good" : v >= 34 ? "ok" : "watch";
  else if (def.key === "sleep_perf" || def.key === "sleep_eff") tone = v >= 85 ? "good" : v >= 70 ? "ok" : "watch";
  else if (def.key === "hrv") tone = v >= 40 ? "good" : v >= 25 ? "ok" : "watch";
  else tone = "ok";
  const toneColor = tone === "good" ? C.green : tone === "watch" ? C.red : C.amber;
  const toneLabel = tone === "good" ? "ดี" : tone === "watch" ? "ต้องดู" : "ปานกลาง";

  return (
    <div className="rpt-score-card">
      <span className={`rpt-tag ${tone}`}>{toneLabel}</span>
      <div className="rpt-gauge">
        <svg viewBox="0 0 100 100" width="96" height="96">
          <circle cx="50" cy="50" r={R} fill="none" stroke="#EDE8DE" strokeWidth="8" />
          <circle cx="50" cy="50" r={R} fill="none" stroke={toneColor} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRC - dash}`} transform="rotate(-90 50 50)" />
        </svg>
        <div className="gv">
          <span className="n">{v.toFixed(def.digits ?? 0)}{def.unit === "%" ? <span className="pct">%</span> : ""}</span>
          <span className="u">{def.label.split(" (")[0]}</span>
        </div>
      </div>
      <div className="rpt-score-lbl">{def.label.split(" (")[0]}</div>
      <div className="rpt-score-desc">
        {def.unit !== "%" ? `${def.unit} ` : ""}
        {min != null && max != null ? `ช่วง ${min.toFixed(def.digits ?? 0)}–${max.toFixed(def.digits ?? 0)}` : ""}
      </div>
    </div>
  );
}

function ProgressBar() {
  useEffect(() => {
    const el = document.getElementById("rpt-prog");
    if (!el) return;
    const fn = () => {
      const h = document.documentElement;
      const sc = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
      el.style.width = `${Math.min(100, Math.max(0, sc * 100))}%`;
    };
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return <div id="rpt-prog" className="no-print" />;
}

function FontSizeControl() {
  const [fs, setFs] = useState<"sm" | "md" | "lg" | "xl">("md");
  useEffect(() => {
    const doc = document.getElementById("rpt-doc");
    if (doc) doc.dataset.fs = fs;
  }, [fs]);
  const opts: { k: typeof fs; t: string; cls: string }[] = [
    { k: "sm", t: "ก", cls: "b1" }, { k: "md", t: "ก", cls: "b2" },
    { k: "lg", t: "ก", cls: "b3" }, { k: "xl", t: "ก", cls: "b4" },
  ];
  return (
    <div id="rpt-fsctl" className="no-print" role="group" aria-label="ปรับขนาดตัวอักษร">
      <span className="lbl">ขนาดอักษร</span>
      {opts.map((o) => (
        <button key={o.k} className={`${o.cls} ${fs === o.k ? "on" : ""}`} onClick={() => setFs(o.k)} type="button">{o.t}</button>
      ))}
    </div>
  );
}

function PrintButton() {
  const onPrint = () => {
    document.querySelectorAll<HTMLElement>(".rpt .reveal").forEach((el) => el.classList.add("in"));
    setTimeout(() => window.print(), 200);
  };
  return (
    <button id="rpt-printbtn" className="no-print" type="button" onClick={onPrint} title="พิมพ์ / บันทึกเป็น PDF">
      <span style={{ fontSize: 15 }}>🖨</span> <span className="lbl-p">Print / PDF</span>
    </button>
  );
}
