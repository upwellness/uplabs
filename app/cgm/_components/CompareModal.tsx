"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { CompareChart } from "./CompareChart";
import type { AnalyzedMeal } from "@/lib/cgm-analyze";
import { COMPARE_COLORS, CURVE_LABEL } from "@/lib/cgm-analyze";

interface CompareModalProps {
  profileName: string;
  meals: AnalyzedMeal[];
  onClose: () => void;
}

const fmtDateTime = (ts: number) =>
  new Date(ts).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

const GRADE_COLOR: Record<string, { fg: string; bg: string }> = {
  A: { fg: "#16A34A", bg: "#DCFCE7" },
  B: { fg: "#EAB308", bg: "#FEF9C3" },
  C: { fg: "#DC2626", bg: "#FEE2E2" },
};

export function CompareModal({ profileName, meals, onClose }: CompareModalProps) {
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
      link.download = `${profileName.replace(/\s+/g, "_")}_CGM_Compare_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err: any) {
      alert("ไม่สามารถสร้างรูปได้: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog" aria-modal="true"
      className="fixed inset-0 z-50 flex items-stretch justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="my-auto w-full max-w-6xl rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Toolbar */}
        <div className="no-export sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-3xl border-b border-ink-10 bg-white px-6 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Comparison</div>
            <div className="mt-0.5 font-head text-lg font-extrabold tracking-tight text-ink">
              📊 เปรียบเทียบมื้ออาหาร — {meals.length} มื้อ
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost"   size="sm" onClick={onClose}>ปิด</Button>
            <Button variant="rose"    size="sm" onClick={handleDownload} disabled={busy}>
              {busy ? "กำลังสร้าง..." : "📥 บันทึกเป็นภาพ"}
            </Button>
          </div>
        </div>

        {/* Captured area */}
        <div ref={captureRef} className="bg-white p-8">

          {/* Title */}
          <div className="mb-6 flex items-start justify-between border-b-2 border-ink pb-5">
            <div>
              <Logo size="md" />
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
                Metabolic Response — Meal Comparison
              </div>
              <div className="mt-1 font-thai text-[13px] text-ink-60">{profileName}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Generated</div>
              <div className="mt-1 font-mono text-[12px] text-ink">{new Date().toLocaleString("th-TH")}</div>
            </div>
          </div>

          {/* Compare chart */}
          <section className="mb-8">
            <div className="mb-4">
              <div className="font-mono text-[10px] text-ink-40">01</div>
              <h2 className="mt-1 font-head text-[20px] font-extrabold tracking-tight text-ink">
                กราฟการตอบสนอง (0-3 ชั่วโมง)
              </h2>
              <p className="mt-1 font-thai text-[12px] text-ink-40">
                ทุกเส้นเริ่มที่นาทีที่ 0 = เวลาเริ่มกิน — เปรียบ pattern การขึ้น/ลงของแต่ละมื้อ
              </p>
            </div>
            <div className="rounded-2xl border border-ink-10 bg-white p-5">
              <CompareChart meals={meals} />
            </div>
          </section>

          {/* Stats comparison cards */}
          <section>
            <div className="mb-4">
              <div className="font-mono text-[10px] text-ink-40">02</div>
              <h2 className="mt-1 font-head text-[20px] font-extrabold tracking-tight text-ink">
                ดัชนีชี้วัด Metabolic Flexibility
              </h2>
              <p className="mt-1 font-thai text-[12px] text-ink-40">
                เปรียบเทียบรายมื้อ — Baseline · Peak · Δ Delta · Lag · ฟื้นตัวที่ +2h / +3h
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {meals.map((m, idx) => {
                const color = COMPARE_COLORS[idx % COMPARE_COLORS.length];
                const g = GRADE_COLOR[m.grade];
                const curve = CURVE_LABEL[m.curveShape];
                const delta = m.delta ?? 0;
                const deltaColor = delta <= 30 ? "#16A34A" : delta <= 50 ? "#EAB308" : "#DC2626";
                const hr2Bad = m.hr2 != null && m.baseline != null && m.hr2 > m.baseline + 20;
                const hr3Bad = m.hr3 != null && m.baseline != null && m.hr3 > m.baseline + 10;

                return (
                  <div key={m.id} className="overflow-hidden rounded-2xl border border-ink-10 bg-white" style={{ borderTop: `4px solid ${color}` }}>
                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-thai text-[15px] font-bold leading-tight text-ink truncate" title={m.description}>
                            {m.description}
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-ink-40">{fmtDateTime(m.meal_timestamp)}</div>
                        </div>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-head text-lg font-extrabold"
                          style={{ background: g.bg, color: g.fg }}
                        >
                          {m.grade}
                        </div>
                      </div>

                      {/* Macros row */}
                      <div className="mt-3 flex items-center justify-center gap-3 rounded-lg bg-surface px-2 py-2 text-[11px] font-semibold">
                        <span className="text-blue-600">C {m.carbs ?? 0}g</span>
                        <span className="text-ink-20">·</span>
                        <span className="text-emerald-600">P {m.protein ?? 0}g</span>
                        <span className="text-ink-20">·</span>
                        <span className="text-amber-600">F {m.fat ?? 0}g</span>
                      </div>

                      {/* Stats list */}
                      <div className="mt-4 space-y-2 text-[12px]">
                        <StatRow label="Baseline ก่อนเริ่มกิน"   value={m.baseline} />
                        <StatRow label="จุดสูงสุด (Peak)"
                          value={m.peak}
                          extra={m.delta != null ? `(+${Math.round(m.delta)})` : ""}
                          extraColor={deltaColor}
                          bold
                        />
                        <StatRow label="Lag time"
                          value={m.lagMins}
                          unit=" นาที"
                        />
                        <StatRow label="ฟื้นตัว +2h"
                          value={m.hr2}
                          color={hr2Bad ? "#DC2626" : "#16A34A"}
                        />
                        <StatRow label="ฟื้นตัว +3h"
                          value={m.hr3}
                          color={hr3Bad ? "#DC2626" : "#16A34A"}
                        />
                      </div>

                      {/* Curve insight */}
                      <div className="mt-4 rounded-xl border border-ink-5 bg-surface px-3 py-2.5">
                        <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-40">Pattern</div>
                        <div className="mt-1 font-thai text-[11px] leading-snug text-ink-60">{curve.th}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Footer */}
          <div className="mt-10 border-t border-ink-10 pt-4 text-center font-mono text-[10px] text-ink-40">
            UPLABS CGM Analyzer · UP Wellness · ADA reference ranges
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, unit = "", extra, extraColor, color, bold }: {
  label: string; value: number | null; unit?: string;
  extra?: string; extraColor?: string; color?: string; bold?: boolean;
}) {
  const display = value == null ? "—" : `${Math.round(value)}${unit}`;
  return (
    <div className="flex items-center justify-between border-b border-ink-5 pb-1.5 last:border-b-0 last:pb-0">
      <span className="text-ink-60">{label}</span>
      <span className="font-mono">
        <span className={bold ? "font-bold text-ink" : "text-ink"} style={{ color: color ?? undefined }}>
          {display}
        </span>
        {extra && <span className="ml-1 font-bold" style={{ color: extraColor }}>{extra}</span>}
      </span>
    </div>
  );
}
