"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/Button";
import { MeasurementTable } from "./MeasurementTable";
import { TrendCharts } from "./TrendCharts";
import { formatDate, formatNumber } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import type { Customer, MeasurementWithDerived } from "@/lib/types";

interface ReportBuilderProps {
  customer: Customer;
  measurements: MeasurementWithDerived[];
  highlight?: MeasurementWithDerived | null; // session to feature
  onClose: () => void;
}

interface Sections {
  graph:    boolean;
  history:  boolean;
  session:  boolean;
}

const DEFAULT: Sections = { graph: true, history: true, session: false };

export function ReportBuilder({ customer, measurements, highlight, onClose }: ReportBuilderProps) {
  const [sections, setSections] = useState<Sections>(() => ({
    ...DEFAULT,
    session: Boolean(highlight),
  }));
  const [busy, setBusy] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!captureRef.current) return;
    setBusy(true);
    try {
      const node = captureRef.current;
      // Filter out scrollbars; force background white
      const dataUrl = await toPng(node, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
        filter: (n) => !(n.classList && n.classList.contains("no-export")),
      });
      const link = document.createElement("a");
      const fname = `${customer.name.replace(/\s+/g, "_")}_BCA_${new Date().toISOString().slice(0, 10)}.png`;
      link.download = fname;
      link.href = dataUrl;
      link.click();
    } catch (err: any) {
      alert("ไม่สามารถสร้างรูปได้: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (k: keyof Sections) => setSections((s) => ({ ...s, [k]: !s[k] }));

  const ageNow = customer.birth_year ? new Date().getFullYear() - customer.birth_year : null;

  return (
    <div
      role="dialog" aria-modal="true"
      className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="my-auto w-full max-w-5xl rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* ── Toolbar (NOT captured) ── */}
        <div className="no-export sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-3xl border-b border-ink-10 bg-white px-6 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Build Report</div>
            <div className="mt-0.5 font-head text-lg font-extrabold tracking-tight text-ink">
              สร้างรายงาน — {customer.name}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 text-[12px]">
              <Checkbox checked={sections.graph}   onChange={() => toggle("graph")}   label="กราฟแนวโน้ม" />
              <Checkbox checked={sections.history} onChange={() => toggle("history")} label="ประวัติการวัด" />
              <Checkbox checked={sections.session} onChange={() => toggle("session")} label="ค่าครั้งนี้" disabled={!highlight} />
            </div>
            <div className="h-6 w-px bg-ink-10" />
            <Button variant="ghost" size="sm" onClick={onClose}>ปิด</Button>
            <Button variant="rose"  size="sm" onClick={handleDownload} disabled={busy}>
              {busy ? "กำลังสร้าง..." : "📥 ดาวน์โหลด PNG"}
            </Button>
          </div>
        </div>

        {/* ── Captured area ── */}
        <div ref={captureRef} className="bg-white p-8">
          {/* Report header */}
          <div className="mb-6 flex items-start justify-between border-b-2 border-ink pb-5">
            <div>
              <Logo size="md" />
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
                BCA Tracker · Report
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Generated</div>
              <div className="mt-1 font-mono text-[12px] text-ink">{new Date().toLocaleString("th-TH")}</div>
            </div>
          </div>

          {/* Customer header */}
          <div className="mb-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Patient</div>
            <h1 className="mt-1 font-head text-[28px] font-extrabold tracking-tight text-ink">{customer.name}</h1>
            <div className="mt-2 flex items-center gap-5 font-thai text-[13px] text-ink-60">
              <span>{customer.gender === "male" ? "ชาย" : "หญิง"}</span>
              <Dot />
              <span>{ageNow != null ? `${ageNow} ปี` : "—"}</span>
              <Dot />
              <span>สูง {customer.height ?? "—"} cm</span>
              <Dot />
              <span>{measurements.length} measurements</span>
            </div>
          </div>

          {/* Section: Session detail */}
          {sections.session && highlight && (
            <section className="mb-8">
              <SectionHeader number="01" title="ค่าการวัดครั้งนี้" subtitle={formatDate(highlight.recorded_at)} />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric label="น้ำหนัก"     value={formatNumber(highlight.weight, 1)}     unit="kg" />
                <Metric label="BMI"          value={formatNumber(highlight.bmi, 1)}        unit="" />
                <Metric label="Fat %"        value={formatNumber(highlight.fat_pct, 1)}    unit="%" />
                <Metric label="Fat Mass"     value={formatNumber(highlight.fat_mass, 1)}   unit="kg" />
                <Metric label="Muscle %"     value={formatNumber(highlight.muscle_pct, 1)} unit="%" />
                <Metric label="Muscle Mass"  value={formatNumber(highlight.muscle_mass, 1)} unit="kg" />
                <Metric label="Visceral"     value={formatNumber(highlight.visceral, 0)}   unit="lv" />
                <Metric label="Body Age"     value={formatNumber(highlight.body_age, 0)}   unit="yr" />
                <Metric label="BMR"          value={formatNumber(highlight.bmr, 0)}        unit="kcal" />
              </div>
            </section>
          )}

          {/* Section: Graph */}
          {sections.graph && (
            <section className="mb-8">
              <SectionHeader number={sections.session ? "02" : "01"} title="แนวโน้มย้อนหลัง" subtitle="Trend Analysis" />
              <TrendCharts measurements={measurements} gender={customer.gender} />
            </section>
          )}

          {/* Section: History */}
          {sections.history && (
            <section className="mb-8">
              <SectionHeader
                number={String([sections.session, sections.graph].filter(Boolean).length + 1).padStart(2, "0")}
                title="ประวัติการวัดทั้งหมด" subtitle={`${measurements.length} records`}
              />
              <MeasurementTable measurements={measurements} gender={customer.gender} showActions={false} />
            </section>
          )}

          {/* Footer */}
          <div className="mt-10 border-t border-ink-10 pt-4 text-center font-mono text-[10px] text-ink-40">
            UP Wellness Ops · BCA Tracker · upwellness.vercel.app
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────── */

function Checkbox({ checked, onChange, label, disabled }: {
  checked: boolean; onChange: () => void; label: string; disabled?: boolean;
}) {
  return (
    <label className={`inline-flex items-center gap-2 font-semibold ${disabled ? "opacity-40" : "cursor-pointer"}`}>
      <input
        type="checkbox" checked={checked} disabled={disabled}
        onChange={onChange}
        className="h-4 w-4 rounded border-ink-20 accent-rose"
      />
      <span className="text-ink">{label}</span>
    </label>
  );
}

function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <div>
        <div className="font-mono text-[10px] text-ink-40">{number}</div>
        <h2 className="mt-1 font-head text-[20px] font-extrabold tracking-tight text-ink">{title}</h2>
      </div>
      {subtitle && <div className="font-mono text-[11px] text-ink-40">{subtitle}</div>}
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border border-ink-10 bg-surface px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-40">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-head text-[24px] font-extrabold leading-none text-ink">{value}</span>
        <span className="text-[11px] text-ink-40">{unit}</span>
      </div>
    </div>
  );
}

function Dot() { return <span className="h-1 w-1 rounded-full bg-ink-20" />; }
