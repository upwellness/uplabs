"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { CONDITION_ADDONS, type ItemState, type Summary } from "./ProgramData";

interface Props {
  onClose:     () => void;
  name:        string;
  duration:    number;
  items:       ItemState[];
  summary:     Summary;
  activeConds: string[];
  isStd:       boolean;
}

const GUIDELINES = [
  { title: "Metabolic Reset",       sub: "ลดคาร์โบไฮเดรต · อินซูลินช่วงแรก" },
  { title: "สัดส่วนเวลา 2-4-6",      sub: "เพิ่มความยืดหยุ่นระบบเผาผลาญ" },
  { title: "พักผ่อน 7-8 ชั่วโมง",     sub: "ให้ร่างกายฟื้นฟูระบบเต็มที่" },
  { title: "เดิน 10,000 ก้าว / วัน",  sub: "กระตุ้น Metabolic Flexibility" },
];

export function ProgramReport({ onClose, name, duration, items, summary, activeConds, isStd }: Props) {
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
      const safeName = (name || "Customer").replace(/\s+/g, "_");
      link.download = `${safeName}_Program_${duration}D_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e: any) {
      alert("ไม่สามารถสร้างรูปได้: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const condNames = CONDITION_ADDONS
    .filter((c) => activeConds.includes(c.id))
    .map((c) => `${c.icon} ${c.name}`)
    .join(" · ");

  return (
    <div
      role="dialog" aria-modal="true"
      className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="my-auto w-full max-w-5xl rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Toolbar (NOT captured) */}
        <div className="no-export sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-3xl border-b border-ink-10 bg-white px-6 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Build Report</div>
            <div className="mt-0.5 font-head text-lg font-extrabold tracking-tight text-ink">
              สร้างรายงาน — {name || "—"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onClose}>ปิด</Button>
            <Button variant="rose"  size="sm" onClick={handleDownload} disabled={busy}>
              {busy ? "กำลังสร้าง..." : "📥 ดาวน์โหลด PNG"}
            </Button>
          </div>
        </div>

        {/* Captured area */}
        <div ref={captureRef} className="bg-white p-8">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between border-b-2 border-ink pb-5">
            <div>
              <Logo size="md" />
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
                Program Designer · Report
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Generated</div>
              <div className="mt-1 font-mono text-[12px] text-ink">{new Date().toLocaleString("th-TH")}</div>
            </div>
          </div>

          {/* Customer header */}
          <div className="mb-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Customer</div>
            <h1 className="mt-1 font-head text-[28px] font-extrabold tracking-tight text-ink">{name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 font-thai text-[13px] text-ink-60">
              <span>โปรแกรม {duration} วัน</span>
              <Dot />
              <span>{items.length} ผลิตภัณฑ์</span>
              {isStd && <><Dot /><span className="text-rose font-semibold">Standard {duration}D</span></>}
              {condNames && <><Dot /><span>{condNames}</span></>}
            </div>
          </div>

          {/* Section 01 · Stack table */}
          <section className="mb-8">
            <SectionHeader number="01" title="โปรแกรมที่ออกแบบ" subtitle={`${items.length} items · ${duration} days`} />
            <div className="overflow-hidden rounded-2xl border border-ink-10">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface border-b border-ink-10">
                  <tr className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-40">
                    <th className="px-4 py-3 w-[30%]">ผลิตภัณฑ์</th>
                    <th className="px-2 py-3 text-center w-[8%]">จำนวน</th>
                    <th className="px-2 py-3 text-center bg-rose-ultra w-[7%]">เช้า</th>
                    <th className="px-2 py-3 text-center bg-amber-ultra w-[7%]">กลางวัน</th>
                    <th className="px-2 py-3 text-center bg-science-ultra w-[7%]">เย็น</th>
                    <th className="px-4 py-3 w-[41%]">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-5">
                  {items.map((i) => (
                    <tr key={i.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-thai text-[13px] font-bold text-ink">{i.name}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-ink-40">{i.cat}</div>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <div className="font-mono text-base font-bold text-ink">{i.qty}</div>
                        <div className="font-mono text-[9px] text-ink-40 mt-0.5">{i.containerUnit}</div>
                      </td>
                      <td className="px-2 py-3 text-center font-mono text-lg font-bold text-rose bg-rose-ultra/40">{i.dM || "—"}</td>
                      <td className="px-2 py-3 text-center font-mono text-lg font-bold text-amber bg-amber-ultra/40">{i.dN || "—"}</td>
                      <td className="px-2 py-3 text-center font-mono text-lg font-bold text-science bg-science-ultra/40">{i.dE || "—"}</td>
                      <td className="px-4 py-3 font-thai text-[12px] text-ink-60 leading-relaxed">{i.rmk || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 02 · Pricing */}
          <section className="mb-8">
            <SectionHeader number="02" title="สรุปงบประมาณ" subtitle="Investment summary" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="ยอดรวม"       value={`฿${summary.rawTotal.toLocaleString()}`} unit="" />
              <Metric label="ส่วนลด 15%"    value={`฿${Math.round(summary.totalItemDisc).toLocaleString()}`} unit="" color="text-status-optimal" />
              <Metric label="ยอดสุทธิ"      value={`฿${summary.net.toLocaleString()}`} unit="" big />
              <Metric label="PV / Cashback" value={`${Math.round(summary.pv).toLocaleString()}`} unit={`PV · ${summary.rate}%`} />
            </div>
          </section>

          {/* Section 03 · Guidelines */}
          <section className="mb-8">
            <SectionHeader number="03" title="แนวทางปฏิบัติ" subtitle="Metabolic guidelines" />
            <div className="grid grid-cols-2 gap-3">
              {GUIDELINES.map((g, i) => (
                <div key={i} className="rounded-2xl border border-ink-10 bg-surface px-4 py-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] font-bold text-rose">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-thai text-[13px] font-bold text-ink">{g.title}</span>
                  </div>
                  <div className="mt-1 font-thai text-[11px] text-ink-60 pl-7">{g.sub}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <div className="mt-10 border-t border-ink-10 pt-4 flex items-center justify-between">
            <div className="font-mono text-[10px] text-ink-40">
              UP Wellness Ops · Program Designer
            </div>
            <div className="font-mono text-[10px] text-ink-40">
              {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        <div className="font-mono text-[10px] text-ink-40">{number}</div>
        <h2 className="mt-1 font-head text-[20px] font-extrabold tracking-tight text-ink">{title}</h2>
      </div>
      {subtitle && <div className="font-mono text-[11px] text-ink-40">{subtitle}</div>}
    </div>
  );
}

function Metric({ label, value, unit, big, color }: { label: string; value: string; unit: string; big?: boolean; color?: string }) {
  return (
    <div className="rounded-xl border border-ink-10 bg-surface px-4 py-3">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-40">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`font-head font-extrabold leading-none ${big ? "text-[28px]" : "text-[20px]"} ${color ?? "text-ink"}`}>{value}</span>
        {unit && <span className="text-[11px] text-ink-40 font-mono">{unit}</span>}
      </div>
    </div>
  );
}

function Dot() { return <span className="h-1 w-1 rounded-full bg-ink-20" />; }
