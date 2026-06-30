"use client";

/**
 * UP Labs v2 · Plate Planner — offscreen PRINTABLE REPORT (clinical-warm)
 * ──────────────────────────────────────────────────────────────────────
 * A designed, customer-ready แผนอาหาร DOM that is rendered OFF-CANVAS (absolutely
 * positioned, fixed 800px wide, far off-screen) and rasterized with html-to-image →
 * jsPDF. NO popup window, NO print dialog (the old _printTable popup was being blocked).
 *
 * DISPLAY ONLY — zero nutrition math. Every macro number comes from the engine:
 *   • meal.tot.{c,p,f,kcal}  (per meal)            → printed verbatim (rounded)
 *   • sumDay(day)            (day total, engine sums) + energySplit (Atwater, ./_macros)
 *   • planDailyAverage(plan) (plan daily average)   for the summary pie
 * The CPFPie donut (components/CPFPie) renders the C:P:F energy split. The whole report
 * is lazy-loaded by page.tsx (next/dynamic), so recharts/CPFPie/jsPDF stay out of first-load.
 *
 * Self-contained inline styles + a small hex palette mirror the clinical-warm tokens
 * (warm-white surface, rose/wellness/amber/science accents, ink text) so the rasterized
 * PNG looks identical regardless of the page's Tailwind context.
 */

import { forwardRef } from "react";
import { CPFPie } from "@/components/CPFPie";
import type { DayPlan, Goal, MealItem, Targets } from "@/lib/plate-planner/engine";
import { sumDay, energySplit, planDailyAverage, type MacroGrams } from "./_macros";

/* ── clinical-warm palette (frozen hex so the raster matches the app tokens) ── */
const C = {
  ink: "#18151A",
  ink80: "#3A363F",
  ink60: "#5C5660",
  ink40: "#8A838E",
  line: "#E7E3E8",
  hair: "#F0EDF1",
  surface: "#F8F6F4", // warm-white
  rose: "#8C4C4C",
  roseUltra: "#F7EFEF",
  rosePale: "#E6CFCF",
  wellness: "#396755",
  wellnessUltra: "#EEF3F0",
  wellnessPale: "#C9DAD1",
  amber: "#C47A2A",
  science: "#2A7B8F",
} as const;

const GOAL_LABEL: Record<Goal, string> = { loss: "ลดน้ำหนัก", longevity: "Longevity", muscle: "สร้างกล้ามเนื้อ" };

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Sarabun", "Noto Sans Thai", "Helvetica Neue", Arial, sans-serif';

export interface PlateReportMeta {
  goal: Goal;
  targets: Targets;
  customerName?: string | null;
  diet?: string;
  ageGender?: string | null; // e.g. "อายุ 42 · หญิง" — shown when present
  manualMode?: boolean;      // true → header reads "ข้อมูลที่กรอก" instead of customer prefill
}

/** Portion label — mirrors the engine/LINE bot "≈ N unit · Ng" with 0.5-step rounding. */
function portionLabel(it: MealItem): string {
  if (it.cat === "shake") return "1 แก้ว";
  if (it.ug > 0) {
    const x = it.g / it.ug;
    const q =
      x >= 3
        ? String(Math.round(x))
        : (() => {
            const h = Math.round(x * 2) / 2;
            return h < 0.5 ? "" : h === 0.5 ? "½" : String(h);
          })();
    if (q) return `≈ ${q} ${it.u} · ${it.g}g`;
  }
  return `${it.g}g`;
}

const cleanFoodName = (it: MealItem): string =>
  it.cat === "shake" ? it.th : it.th.replace(/\s*\(.*?\)/, "");

/* ── tiny presentational atoms (inline-styled) ── */
function Chip({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: string }) {
  return (
    <div
      style={{
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: "8px 12px",
        background: "#FFFFFF",
        minWidth: 88,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: C.ink60, letterSpacing: ".02em" }}>{label}</div>
      <div style={{ marginTop: 2, fontSize: 19, fontWeight: 800, color: accent ?? C.ink, lineHeight: 1.05 }}>
        {value}
        {unit ? <span style={{ marginLeft: 2, fontSize: 10, fontWeight: 400, color: C.ink40 }}>{unit}</span> : null}
      </div>
    </div>
  );
}

/** Macro legend row: "คาร์บ 180g · 45%" with a colored dot. Text uses ink tokens (not bright hex). */
function MacroLegendRow({ dot, label, g, pct }: { dot: string; label: string; g: number; pct: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.ink80 }}>
      <span style={{ width: 10, height: 10, borderRadius: 999, background: dot, flexShrink: 0 }} />
      <span style={{ fontWeight: 600, color: C.ink60, minWidth: 52 }}>{label}</span>
      <span style={{ fontWeight: 700, color: C.ink }}>{g}g</span>
      <span style={{ color: C.ink40 }}>· {pct}%</span>
    </div>
  );
}

/** Day-total macro proportion bar (graphic) — segments use brand hex; readout text uses ink tokens. */
function MacroBarStrip({ cPct, pPct, fPct }: { cPct: number; pPct: number; fPct: number }) {
  return (
    <div style={{ display: "flex", width: "100%", height: 8, borderRadius: 999, overflow: "hidden", background: C.hair }}>
      <span style={{ width: `${cPct}%`, background: C.amber }} />
      <span style={{ width: `${pPct}%`, background: C.rose }} />
      <span style={{ width: `${fPct}%`, background: C.science }} />
    </div>
  );
}

/**
 * Offscreen report. Rendered by page.tsx into a fixed, far-off-screen wrapper and handed to
 * html-to-image. `ref` points at the capture root.
 */
export const PlateReport = forwardRef<HTMLDivElement, { plan: DayPlan[]; meta: PlateReportMeta }>(
  function PlateReport({ plan, meta }, ref) {
    const { goal, targets, customerName, diet, ageGender, manualMode } = meta;
    const today = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

    // Plan daily-average (engine sums) for the summary pie.
    const avg: MacroGrams = planDailyAverage(plan);
    const avgSplit = energySplit(avg);

    return (
      <div
        ref={ref}
        style={{
          width: 800,
          background: "#FFFFFF",
          color: C.ink,
          fontFamily: FONT,
          fontSize: 12,
          lineHeight: 1.5,
          padding: "32px 36px",
          boxSizing: "border-box",
        }}
      >
        {/* ── Branded header ── */}
        <div style={{ borderBottom: `2px solid ${C.wellness}`, paddingBottom: 16, marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: ".08em",
              color: C.wellness,
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            UP Wellness · แผนอาหาร (Plate Planner)
          </div>
          <h1 style={{ fontSize: 24, margin: "6px 0 2px", fontWeight: 800, letterSpacing: "-0.01em", color: C.ink }}>
            {customerName ? customerName : "แผนอาหารเฉพาะบุคคล"}
          </h1>
          <div style={{ color: C.ink60, fontSize: 12.5 }}>
            เป้าหมาย <b style={{ color: C.ink80 }}>{GOAL_LABEL[goal]}</b>
            {ageGender ? <> · {ageGender}</> : null}
            {" · "}
            {plan.length} วัน
            {diet && diet !== "ไม่จำกัด" ? <> · {diet}</> : null}
          </div>
          <div style={{ color: C.ink40, fontSize: 11, marginTop: 3 }}>
            {manualMode ? "จากข้อมูลที่กรอก" : "จากข้อมูลลูกค้า"} · จัดทำ {today}
          </div>

          {/* Daily targets */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            <Chip label="พลังงาน" value={targets.kcal.toLocaleString()} unit="kcal/วัน" accent={C.wellness} />
            <Chip label="โปรตีน" value={String(targets.p)} unit="g" accent={C.rose} />
            <Chip label="คาร์บ" value={String(targets.c)} unit="g" accent={C.amber} />
            <Chip label="ไขมัน" value={String(targets.f)} unit="g" accent={C.science} />
            <Chip label="BMI" value={String(targets.bmi)} />
          </div>
        </div>

        {/* ── Macro summary with CPFPie (plan daily-average C:P:F) ── */}
        <div
          style={{
            display: "flex",
            gap: 24,
            alignItems: "center",
            border: `1px solid ${C.line}`,
            background: C.surface,
            borderRadius: 16,
            padding: 20,
            marginBottom: 22,
          }}
        >
          <div style={{ flexShrink: 0 }}>
            <CPFPie
              carb_pct={avgSplit.cPct}
              protein_pct={avgSplit.pPct}
              fat_pct={avgSplit.fPct}
              total_kcal={Math.round(avg.kcal)}
              size={150}
              showLegend={false}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: C.ink40,
              }}
            >
              สัดส่วนพลังงานเฉลี่ยต่อวัน (C : P : F)
            </div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <MacroLegendRow dot={C.amber} label="คาร์บ" g={avgSplit.c} pct={avgSplit.cPct} />
              <MacroLegendRow dot={C.rose} label="โปรตีน" g={avgSplit.p} pct={avgSplit.pPct} />
              <MacroLegendRow dot={C.science} label="ไขมัน" g={avgSplit.f} pct={avgSplit.fPct} />
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: C.ink40 }}>
              ค่าเฉลี่ยจาก {plan.length} วันตามแผน · พลังงานเฉลี่ย {Math.round(avg.kcal).toLocaleString()} kcal/วัน
            </div>
          </div>
        </div>

        {/* ── Day × meal sections ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {plan.map((day, di) => {
            const dt = sumDay(day);
            const ds = energySplit(dt);
            return (
              <div
                key={di}
                style={{
                  border: `1px solid ${C.line}`,
                  borderRadius: 14,
                  overflow: "hidden",
                  // keep each day on one page where possible (html-to-image flattens, but this
                  // hints the slicing math by keeping blocks compact)
                  breakInside: "avoid",
                }}
              >
                {/* Day header band */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    background: C.wellnessUltra,
                    borderBottom: `1px solid ${C.wellnessPale}`,
                    padding: "9px 16px",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.wellness }}>วันที่ {di + 1}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 120 }}>
                      <MacroBarStrip cPct={ds.cPct} pPct={ds.pPct} fPct={ds.fPct} />
                    </div>
                    <div style={{ fontSize: 11, color: C.ink60, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                      C{ds.c} · P{ds.p} · F{ds.f}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.ink, whiteSpace: "nowrap" }}>
                      {Math.round(dt.kcal).toLocaleString()}
                      <span style={{ marginLeft: 2, fontSize: 10, fontWeight: 400, color: C.ink40 }}>kcal</span>
                    </div>
                  </div>
                </div>

                {/* Meals */}
                <div>
                  {day.map((m, mi) => (
                    <div
                      key={mi}
                      style={{
                        display: "flex",
                        gap: 16,
                        padding: "11px 16px",
                        borderTop: mi === 0 ? "none" : `1px solid ${C.hair}`,
                      }}
                    >
                      {/* Meal name + style·main */}
                      <div style={{ width: 168, flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{m.name}</div>
                        {!m.snack && (m.style || m.main) ? (
                          <div style={{ fontSize: 11, color: C.wellness, marginTop: 2 }}>
                            {[m.style, m.main].filter(Boolean).join(" · ")}
                          </div>
                        ) : null}
                        <div style={{ marginTop: 5, fontSize: 11, color: C.ink60, fontVariantNumeric: "tabular-nums" }}>
                          C {Math.round(m.tot.c)} · P {Math.round(m.tot.p)} · F {Math.round(m.tot.f)}{" "}
                          <b style={{ color: C.ink }}>{m.tot.kcal} kcal</b>
                        </div>
                      </div>

                      {/* Foods + portions */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {m.items.map((it, ii) => (
                          <div
                            key={ii}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                              padding: "1.5px 0",
                              fontSize: 12.5,
                            }}
                          >
                            <span style={{ color: C.ink, minWidth: 0 }}>{cleanFoodName(it)}</span>
                            <span
                              style={{
                                color: C.ink40,
                                whiteSpace: "nowrap",
                                fontVariantNumeric: "tabular-nums",
                                flexShrink: 0,
                              }}
                            >
                              {portionLabel(it)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div style={{ marginTop: 18, paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 10.5, color: C.ink40, lineHeight: 1.6 }}>
          ค่ามาโครต่อมื้อจาก UP Labs Plate Planner (Muscle-Centric · Dr. Gabrielle Lyon) · ปริมาณเป็นค่าประมาณเพื่อวางแผนมื้ออาหาร
          ไม่ใช่คำสั่งทางการแพทย์ · สีแท่ง/โดนัท = สัดส่วนพลังงาน คาร์บ:โปรตีน:ไขมัน
        </div>
      </div>
    );
  },
);
