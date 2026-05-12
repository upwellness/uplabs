"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { GlucoseChart } from "./GlucoseChart";
import { MealTable } from "./MealTable";
import type { CGMProfile, CGMReading, CGMMeal, CGMStats } from "@/lib/types-cgm";

interface ReportBuilderProps {
  profile:  CGMProfile;
  readings: CGMReading[];
  meals:    CGMMeal[];
  stats:    CGMStats | null;
  periodLabel: string;
  onClose: () => void;
}

interface Sections {
  graph: boolean;
  meals: boolean;
  stats: boolean;
}

const DEFAULT: Sections = { graph: true, meals: true, stats: true };

export function ReportBuilder({ profile, readings, meals, stats, periodLabel, onClose }: ReportBuilderProps) {
  const [sections, setSections] = useState<Sections>(DEFAULT);
  const [busy, setBusy] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!captureRef.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(captureRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
        filter: (n) => !(n.classList && n.classList.contains("no-export")),
      });
      const link = document.createElement("a");
      const fname = `${profile.name.replace(/\s+/g, "_")}_CGM_${new Date().toISOString().slice(0, 10)}.png`;
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

  return (
    <div
      role="dialog" aria-modal="true"
      className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="my-auto w-full max-w-5xl rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Toolbar */}
        <div className="no-export sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-3xl border-b border-ink-10 bg-white px-6 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Build Report</div>
            <div className="mt-0.5 font-head text-lg font-extrabold tracking-tight text-ink">
              สร้างรายงาน CGM — {profile.name}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 text-[12px]">
              <Checkbox checked={sections.stats} onChange={() => toggle("stats")} label="สถิติ"     />
              <Checkbox checked={sections.graph} onChange={() => toggle("graph")} label="กราฟ"      />
              <Checkbox checked={sections.meals} onChange={() => toggle("meals")} label="มื้ออาหาร" />
            </div>
            <div className="h-6 w-px bg-ink-10" />
            <Button variant="ghost" size="sm" onClick={onClose}>ปิด</Button>
            <Button variant="rose"  size="sm" onClick={handleDownload} disabled={busy}>
              {busy ? "กำลังสร้าง..." : "📥 ดาวน์โหลด PNG"}
            </Button>
          </div>
        </div>

        {/* Captured area */}
        <div ref={captureRef} className="bg-white p-8">
          <div className="mb-6 flex items-start justify-between border-b-2 border-ink pb-5">
            <div>
              <Logo size="md" />
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
                CGM Analyzer · Report
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Generated</div>
              <div className="mt-1 font-mono text-[12px] text-ink">{new Date().toLocaleString("th-TH")}</div>
            </div>
          </div>

          <div className="mb-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Profile</div>
            <h1 className="mt-1 font-head text-[28px] font-extrabold tracking-tight text-ink">{profile.name}</h1>
            <div className="mt-2 font-thai text-[13px] text-ink-60">
              ช่วงเวลา: <strong>{periodLabel}</strong> · {readings.length.toLocaleString()} readings · {meals.length} meals
            </div>
          </div>

          {sections.stats && stats && (
            <section className="mb-8">
              <SectionHeader number="01" title="สถิติช่วงเวลา" subtitle="Statistics" />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric label="Time in Range"  value={`${stats.tir}%`}     hint="70-110" color="#16A34A" />
                <Metric label="Wide TIR"       value={`${stats.tirWide}%`} hint="70-140" color="#16A34A" />
                <Metric label="ค่าเฉลี่ย"    value={`${stats.avg}`}      hint="mg/dL" />
                <Metric label="GMI (HbA1c est)" value={`${stats.gmi}%`}    hint="ADA formula" />
                <Metric label="ต่ำสุด"        value={`${stats.min}`}      hint="mg/dL" />
                <Metric label="สูงสุด"        value={`${stats.max}`}      hint="mg/dL" />
                <Metric label="Std Dev"        value={`${stats.stdDev}`}   hint="variability" />
                <Metric label="Hi/Lo %"        value={`${stats.highPct}% / ${stats.lowPct}%`} hint="ผิดเกณฑ์" />
              </div>
            </section>
          )}

          {sections.graph && (
            <section className="mb-8">
              <SectionHeader number={sections.stats ? "02" : "01"} title="กราฟระดับน้ำตาล" subtitle="Glucose Trace" />
              <GlucoseChart readings={readings} meals={meals} height={280} />
            </section>
          )}

          {sections.meals && (
            <section className="mb-8">
              <SectionHeader
                number={String([sections.stats, sections.graph].filter(Boolean).length + 1).padStart(2, "0")}
                title="บันทึกมื้ออาหาร" subtitle={`${meals.length} records`}
              />
              <MealTable meals={meals} showActions={false} />
            </section>
          )}

          <div className="mt-10 border-t border-ink-10 pt-4 text-center font-mono text-[10px] text-ink-40">
            UPLABS CGM Analyzer · UP Wellness · upwellness.coach
          </div>
        </div>
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 font-semibold">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded border-ink-20 accent-rose" />
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

function Metric({ label, value, hint, color }: { label: string; value: string; hint: string; color?: string }) {
  return (
    <div className="rounded-xl border border-ink-10 bg-surface px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-40">{label}</div>
      <div className="mt-1 font-head text-[22px] font-extrabold leading-none" style={{ color: color ?? "#1F1A1B" }}>{value}</div>
      <div className="mt-1 font-mono text-[10px] text-ink-40">{hint}</div>
    </div>
  );
}
