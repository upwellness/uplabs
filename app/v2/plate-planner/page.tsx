"use client";

/**
 * UP Labs v2 · Plate Planner (SPEC §7.9)
 * ───────────────────────────────────────
 * Muscle-Centric (Dr. Gabrielle Lyon / Forever Strong) Thai meal planner. 3 goals computed
 * separately (weight loss / longevity / muscle), Thai food with no repeats across days,
 * real portion sizes. Optional ?customer=<id> prefills height + latest weight.
 *
 * Reuse (NO formula re-derivation — imports the SAME canonical engine the LINE bot uses):
 *   - calc/data: calcTargets · buildPlan · planVariety · poolHealth  +  food DB
 *                (@/lib/plate-planner/engine — the QA'd, server-callable Plate Planner engine).
 *                calcTargets: loss=27×ideal, longevity=34×w, muscle=40×w · protein 2.2 g/kg · etc.
 *   - API:  GET /api/customers/[id]/360 (height + latest BCA weight) for ?customer prefill.
 *
 * SCOPE NOTE: v1 /plate-planner is a 114 KB verbatim single-file port (`.pp-root`, glass/aurora,
 * @ts-nocheck) that also does AI food-image generation (BYO key + IndexedDB/Supabase caching).
 * This v2 re-implements the CORE planner (targets + multi-day no-repeat plan + portions) in
 * clinical-warm against the shared engine, and restores the two dropped features in v2 form:
 *   - macro proportion display (C:P:F grams + % of energy) per meal / day / plan-average
 *     → ./_macros + ./_MacroBar (display only — reads engine grams, no re-derivation)
 *   - AI meal-photo generation → ./_MealImage (lazy) reusing the SAME /api/plate-image flow
 *     and the SAME v1 cache protocol (IndexedDB "plateplanner/img" + Supabase "meal-images")
 *     ported in ./_imageCache so photos are shared between v1 and v2.
 * Plus two new asks: 7/14/30-day menus, and a "บันทึก PDF" customer food report — a designed
 *     off-canvas report (./_PlateReport, with the CPFPie macro donut) rasterized to a multi-page
 *     A4 PDF via ./_exportPdf (html-to-image + jspdf, both lazy). Direct download, NO popup/print
 *     dialog (the old ./_printTable window.open path was being blocked by browsers).
 *
 * Clinical-warm: lib/v2/ui primitives, Lucide icons, status TEXT colors, empty/loading/error,
 * ≥44px touch, keyboard-accessible.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  UtensilsCrossed, Flame, HeartPulse, Dumbbell, Loader2, RefreshCw, User2,
  Soup, AlertTriangle, ListChecks, Target, Info, FileDown,
} from "lucide-react";
import { Shell } from "../_components/Shell";
import { Card, SectionLabel, IconChip, LoadingState } from "@/lib/v2/ui";
import { statusTextHex } from "@/lib/v2/status";
import { GeminiKeyField } from "@/components/GeminiKeyField";
import {
  calcTargets, buildPlan, planVariety, poolHealth,
  type Goal, type Diet, type PlanConfig, type DayPlan, type Meal, type MealItem,
} from "@/lib/plate-planner/engine";
import { MacroBar } from "./_MacroBar";
import { mealSplit, energySplit, sumDay, planDailyAverage, itemSplit, avgVsTarget, MACRO_HEX } from "./_macros";
import { PlateReport, type PlateReportMeta } from "./_PlateReport";

/** AI meal-photo view is lazy — keeps the image cache / SubtleCrypto / IndexedDB code out of first-load JS. */
const MealImage = dynamic(() => import("./_MealImage"), {
  ssr: false,
  loading: () => (
    <div className="mt-3 flex h-[44px] items-center gap-2 border-t border-ink-5 pt-3 font-thai text-[12px] text-ink-40">
      <Loader2 size={14} className="animate-spin" aria-hidden /> กำลังโหลดส่วนรูปภาพ…
    </div>
  ),
});

/** CPFPie is pure SVG but lazy-loaded per SPEC §8 ("กราฟ lazy") — same pattern as nutriscan. */
const CPFPie = dynamic(() => import("@/components/CPFPie").then((m) => m.CPFPie), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center" style={{ width: 132, height: 132 }}>
      <Loader2 size={18} className="animate-spin text-wellness" aria-hidden />
    </div>
  ),
});

/**
 * The offscreen PDF report (recharts via CPFPie + the whole report DOM) is lazy-loaded —
 * it only mounts when the user has a plan, and its heavy deps stay out of first-load JS.
 * `_exportPdf` (html-to-image + jspdf) is dynamic-imported inside the click handler.
 */
// PlateReport is a STATIC import (lightweight — CPFPie is pure SVG; jspdf/html-to-image
// stay lazy in _exportPdf). Static so its forwardRef reaches the report root for the PDF
// capture, and it's always mounted (no async-load → no blank PNG).

/* ── Goal config (labels + accent + one-line rationale from calcTargets) ── */
const GOALS: { id: Goal; label: string; sub: string; icon: typeof Flame; tone: "rose" | "wellness" | "science" }[] = [
  { id: "loss", label: "ลดน้ำหนัก", sub: "27 kcal × น้ำหนักที่เหมาะสม · คาร์บต่ำ", icon: Flame, tone: "rose" },
  { id: "longevity", label: "Longevity", sub: "34 kcal × น้ำหนัก · โปรตีนสูง · ไขมันดี", icon: HeartPulse, tone: "wellness" },
  { id: "muscle", label: "สร้างกล้ามเนื้อ", sub: "40 kcal × น้ำหนัก · คาร์บสูงหนุนเทรน", icon: Dumbbell, tone: "science" },
];

/** Static selected-state classes (Tailwind JIT can't see interpolated `bg-${tone}-ultra`). */
const GOAL_SELECTED: Record<"rose" | "wellness" | "science", { box: string; icon: string }> = {
  rose: { box: "border-rose bg-rose-ultra", icon: "text-rose" },
  wellness: { box: "border-wellness bg-wellness-ultra", icon: "text-wellness" },
  science: { box: "border-science bg-science-ultra", icon: "text-science" },
};

const DIETS: { id: Diet; label: string }[] = [
  { id: "none", label: "ไม่จำกัด" },
  { id: "halal", label: "ฮาลาล" },
  { id: "nopork", label: "ไม่กินหมู" },
  { id: "nobeef", label: "ไม่กินเนื้อวัว" },
  { id: "noredmeat", label: "ไม่กินเนื้อแดง" },
  { id: "vegetarian", label: "มังสวิรัติ" },
  { id: "vegan", label: "วีแกน" },
];

const CAT_META: Record<string, { label: string; color: string }> = {
  shake: { label: "เชค", color: "#6B3535" },
  protein: { label: "โปรตีน", color: "#8C4C4C" },
  carb: { label: "คาร์บ", color: "#C47A2A" },
  veg: { label: "ผัก", color: "#396755" },
  fruit: { label: "ผลไม้", color: "#A0567B" },
  fat: { label: "ไขมันดี", color: "#2A7B8F" },
};

const PLAN_LENGTHS = [7, 14, 30];
const DIET_LABEL: Record<Diet, string> = Object.fromEntries(
  [
    ["none", "ไม่จำกัด"], ["halal", "ฮาลาล"], ["nopork", "ไม่กินหมู"], ["nobeef", "ไม่กินเนื้อวัว"],
    ["noredmeat", "ไม่กินเนื้อแดง"], ["vegetarian", "มังสวิรัติ"], ["vegan", "วีแกน"],
  ] as [Diet, string][],
) as Record<Diet, string>;

export default function V2PlatePlannerPage() {
  return (
    <Suspense
      fallback={
        <Shell breadcrumb={[{ label: "หน้าแรก", href: "/v2" }, { label: "Plate Planner" }]}>
          <Card><LoadingState /></Card>
        </Shell>
      }
    >
      <PlatePlannerInner />
    </Suspense>
  );
}

function PlatePlannerInner() {
  const search = useSearchParams();
  const customerId = search.get("customer");

  const [goal, setGoal] = useState<Goal>("longevity");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [diet, setDiet] = useState<Diet>("none");
  const [noVeg, setNoVeg] = useState(false);
  const [shakeOn, setShakeOn] = useState(false);
  const [lockW, setLockW] = useState(false);
  const [days, setDays] = useState(7);
  const [seed, setSeed] = useState(1);
  const [showImages, setShowImages] = useState(false);

  // ?customer prefill — height + latest weight (client-side, mirrors v1 server prefill)
  const [prefillState, setPrefillState] = useState<"idle" | "loading" | "done" | "error">(customerId ? "loading" : "idle");
  const [customerName, setCustomerName] = useState<string | null>(null);

  const loadPrefill = useCallback(async () => {
    if (!customerId) return;
    setPrefillState("loading");
    try {
      const res = await fetch(`/api/customers/${customerId}/360`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "load failed");
      const c = json.customer;
      const h = typeof c?.height === "number" ? c.height : Number(c?.height);
      if (Number.isFinite(h) && h > 0) setHeight(String(h));
      const wRaw = json.bcaLatest?.weight;
      const w = typeof wRaw === "number" ? wRaw : wRaw != null ? Number(wRaw) : NaN;
      if (Number.isFinite(w) && w > 0) setWeight(String(w));
      setCustomerName(c?.name ?? null);
      setPrefillState("done");
    } catch {
      setPrefillState("error");
    }
  }, [customerId]);
  useEffect(() => { loadPrefill(); }, [loadPrefill]);

  const w = Number(weight), h = Number(height);
  const valid = Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0;

  const config: PlanConfig = useMemo(() => ({
    diet,
    noVeg,
    shake: shakeOn ? { on: true, breakfast: true, dinner: true } : { on: false },
    lockW,
  }), [diet, noVeg, shakeOn, lockW]);

  // ── Engine (imported, unchanged) ──
  const targets = useMemo(() => (valid ? calcTargets(w, h, goal, lockW) : null), [valid, w, h, goal, lockW]);
  const plan = useMemo<DayPlan[] | null>(
    () => (valid && targets ? buildPlan(targets, goal, false, days, seed, config) : null),
    [valid, targets, goal, days, seed, config],
  );
  const variety = useMemo(() => (plan ? planVariety(plan) : null), [plan]);
  const pool = useMemo(() => poolHealth(config), [config]);

  // Plan-level daily average (engine grams) for the "average vs target" readout.
  const dailyAvg = useMemo(() => (plan && plan.length ? planDailyAverage(plan) : null), [plan]);
  // Long-horizon (7/14/30) variety guard: at longer plans a small food pool repeats menus.
  // Trips when the no-repeat rate dips OR the protein pool is too thin to fill unique days
  // (e.g. vegan ≈ 5 heroes can't carry 30 distinct days) OR the engine flags the pool tight.
  const varietyTight = !!(
    variety && days >= 14 && (variety.pct < 70 || (variety.proteins > 0 && variety.proteins < 7) || pool.tight)
  );

  const [activeDay, setActiveDay] = useState(0);
  useEffect(() => { if (activeDay >= days) setActiveDay(0); }, [days, activeDay]);

  // ── PDF export (direct download — no popup, no print dialog) ──
  const reportRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Metadata for the offscreen report (engine targets passed straight through).
  const reportMeta = useMemo<PlateReportMeta | null>(
    () => (targets ? {
      goal,
      targets,
      customerName,
      diet: DIET_LABEL[diet],
      ageGender: null,            // age/gender not collected on this screen — header omits when null
      manualMode: !customerId,    // header reads "ข้อมูลที่กรอก" unless a ?customer prefill is active
    } : null),
    [targets, goal, customerName, diet, customerId],
  );

  const onExportPdf = useCallback(async () => {
    if (!plan || !plan.length || !reportRef.current || pdfBusy) return;
    setPdfBusy(true);
    try {
      // Lazy — html-to-image + jspdf load only on click (out of first-load JS).
      const { exportPlatePdf } = await import("./_exportPdf");
      const who = customerName || new Date().toISOString().slice(0, 10);
      await exportPlatePdf(reportRef.current, who);
    } catch (e) {
      if (typeof window !== "undefined") {
        window.alert("สร้าง PDF ไม่สำเร็จ ลองอีกครั้งนะคะ" + (e instanceof Error ? `\n(${e.message})` : ""));
      }
    } finally {
      setPdfBusy(false);
    }
  }, [plan, customerName, pdfBusy]);

  return (
    <Shell breadcrumb={[{ label: "หน้าแรก", href: "/v2" }, ...(customerId ? [{ label: "ลูกค้า", href: "/v2/customers" }] : []), { label: "Plate Planner" }]}>
      {/* Page header */}
      <div className="mb-5 flex items-start gap-3">
        <IconChip icon={UtensilsCrossed} tone="wellness" size={20} className="mt-0.5 h-10 w-10" />
        <div>
          <h1 className="font-head text-[23px] font-extrabold tracking-tight text-ink">
            Plate Planner <span className="font-semibold text-ink-40">· Dr. Gabrielle Lyon</span>
          </h1>
          <p className="mt-1 max-w-2xl font-thai text-[13px] leading-[1.6] text-ink-60">
            วางแผนมื้อตามหลักกล้ามเนื้อ (Forever Strong) · 3 เป้าหมายคำนวณแยก · อาหารไทยไม่ซ้ำ + ขนาด portion จริง
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px,1fr]">
        {/* ── Config column ── */}
        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-4 lg:p-5">
            {/* Customer prefill banner */}
            {customerId && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-wellness-pale bg-wellness-ultra px-3 py-2.5">
                {prefillState === "loading" ? (
                  <><Loader2 size={15} className="animate-spin text-wellness" aria-hidden /><span className="font-thai text-[12px] text-wellness">กำลังดึงข้อมูลลูกค้า…</span></>
                ) : prefillState === "error" ? (
                  <><AlertTriangle size={15} className="text-amber" aria-hidden /><span className="font-thai text-[12px] text-ink-60">ดึงข้อมูลลูกค้าไม่สำเร็จ — กรอกส่วนสูง/น้ำหนักเองได้</span></>
                ) : (
                  <><User2 size={15} className="text-wellness" aria-hidden /><span className="font-thai text-[12px] text-wellness">เติมข้อมูลจาก{customerName ? <> {customerName}</> : <>ลูกค้า</>} แล้ว (แก้ไขได้)</span></>
                )}
              </div>
            )}

            {/* Goal selector */}
            <SectionLabel>เป้าหมาย</SectionLabel>
            <div className="mt-2 grid gap-2" role="radiogroup" aria-label="เป้าหมาย">
              {GOALS.map((g) => {
                const on = goal === g.id;
                const sel = GOAL_SELECTED[g.tone];
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setGoal(g.id)}
                    className={`flex min-h-[44px] items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness ${
                      on ? sel.box : "border-ink-10 bg-white hover:border-ink-20"
                    }`}
                  >
                    <g.icon size={18} strokeWidth={2} className={on ? sel.icon : "text-ink-40"} aria-hidden />
                    <span className="min-w-0">
                      <span className="block font-thai text-[14px] font-bold text-ink">{g.label}</span>
                      <span className="block font-thai text-[11px] text-ink-60">{g.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Body inputs */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-60">น้ำหนัก (kg)</span>
                <input
                  type="text" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="65"
                  className="min-h-[44px] w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] font-medium text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-wellness focus:ring-2 focus:ring-wellness-ultra"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-60">ส่วนสูง (ซม.)</span>
                <input
                  type="text" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="170"
                  className="min-h-[44px] w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] font-medium text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-wellness focus:ring-2 focus:ring-wellness-ultra"
                />
              </label>
            </div>

            {/* Diet */}
            <label className="mt-4 block">
              <span className="mb-1 block text-[12px] font-semibold text-ink-60">ข้อจำกัดอาหาร</span>
              <select
                value={diet}
                onChange={(e) => setDiet(e.target.value as Diet)}
                className="min-h-[44px] w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-wellness focus:ring-2 focus:ring-wellness-ultra"
              >
                {DIETS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>

            {/* Toggles */}
            <div className="mt-4 space-y-2">
              <ToggleRow label="ใส่ UP Labs Shake (Nutrilite)" hint="เช้า + เย็น" on={shakeOn} onChange={setShakeOn} />
              <ToggleRow label="ล็อกน้ำหนักที่กรอก" hint="ไม่คำนวณน้ำหนักที่เหมาะสมจาก BMI" on={lockW} onChange={setLockW} />
              <ToggleRow label="ไม่ใส่ผัก" hint="ข้ามผักในมื้อคาว" on={noVeg} onChange={setNoVeg} />
              <ToggleRow label="แสดงรูปจานอาหาร (AI)" hint="สร้างภาพเสมือนจริงต่อมื้อ · ใช้ Gemini key" on={showImages} onChange={setShowImages} />
            </div>

            {/* Plan length + reshuffle */}
            <div className="mt-4 border-t border-ink-5 pt-4">
              <span className="mb-1 block text-[12px] font-semibold text-ink-60">จำนวนวัน</span>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-full border border-ink-10 bg-white p-0.5" role="group" aria-label="จำนวนวัน">
                  {PLAN_LENGTHS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(d)}
                      aria-pressed={days === d}
                      className={`min-h-[36px] rounded-full px-4 py-1.5 text-[12px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness ${
                        days === d ? "bg-wellness text-white" : "text-ink-60 hover:text-ink"
                      }`}
                    >
                      {d} วัน
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSeed((s) => s + 1)}
                  disabled={!valid}
                  aria-label="สุ่มเมนูใหม่"
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink-60 transition-colors hover:border-wellness hover:text-wellness disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness"
                >
                  <RefreshCw size={13} strokeWidth={2.25} aria-hidden /> สุ่มใหม่
                </button>
              </div>
            </div>
          </Card>

          {/* Pool warning (engine poolHealth) */}
          {pool.tight && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-pale bg-amber-ultra px-3.5 py-3">
              <AlertTriangle size={15} strokeWidth={2.25} className="mt-0.5 shrink-0 text-amber" aria-hidden />
              <p className="font-thai text-[12px] leading-relaxed text-ink-80">
                ข้อจำกัดที่เลือกทำให้ตัวเลือกอาหารเหลือน้อย (โปรตีนหลัก {pool.hero} · คาร์บ {pool.carb}) — เมนูอาจซ้ำมากขึ้น
              </p>
            </div>
          )}

          {/* Long-horizon variety guard (7/14/30) — pool too small for unique days */}
          {varietyTight && !pool.tight && variety && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-pale bg-amber-ultra px-3.5 py-3">
              <AlertTriangle size={15} strokeWidth={2.25} className="mt-0.5 shrink-0 text-amber" aria-hidden />
              <p className="font-thai text-[12px] leading-relaxed text-ink-80">
                แผน {days} วันยาวกว่าจำนวนเมนูที่จัดได้แบบไม่ซ้ำ (ตอนนี้ไม่ซ้ำ {variety.pct}%) — บางมื้อจะวนซ้ำ ลองคลายข้อจำกัดอาหารหรือกด “สุ่มใหม่” เพื่อเพิ่มความหลากหลาย
              </p>
            </div>
          )}

          {/* BYO Gemini key — only when AI photos are enabled */}
          {showImages && <GeminiKeyField />}
        </div>

        {/* ── Plan column ── */}
        <div className="space-y-5">
          {!valid ? (
            <Card>
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-wellness-ultra text-wellness">
                  <Target size={22} strokeWidth={2} aria-hidden />
                </span>
                <div className="mt-1 font-head text-[16px] font-bold text-ink">กรอกน้ำหนักและส่วนสูงเพื่อเริ่ม</div>
                <p className="max-w-sm font-thai text-[13px] leading-[1.6] text-ink-60">
                  ระบบจะคำนวณเป้าหมายแคลอรี/มาโครตามเป้าหมายที่เลือก แล้วจัดเมนูอาหารไทยให้แบบไม่ซ้ำ
                </p>
              </div>
            </Card>
          ) : (
            <>
              {targets && <TargetsCard targets={targets} goal={goal} variety={variety} dailyAvg={dailyAvg} days={days} />}

              {/* Day tabs + send-to-customer PDF */}
              {plan && plan.length > 0 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div role="tablist" aria-label="เลือกวัน" className="flex flex-wrap gap-1.5">
                      {plan.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          role="tab"
                          aria-selected={activeDay === i}
                          onClick={() => setActiveDay(i)}
                          className={`min-h-[40px] rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness ${
                            activeDay === i ? "bg-wellness text-white" : "border border-ink-10 bg-white text-ink-60 hover:border-wellness hover:text-wellness"
                          }`}
                        >
                          วันที่ {i + 1}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={onExportPdf}
                      disabled={pdfBusy}
                      aria-busy={pdfBusy}
                      className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border border-wellness-pale bg-wellness-ultra px-4 py-1.5 text-[13px] font-semibold text-wellness transition-colors hover:bg-wellness-pale disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2"
                    >
                      {pdfBusy
                        ? <><Loader2 size={14} className="animate-spin" aria-hidden /> กำลังสร้าง PDF…</>
                        : <><FileDown size={14} strokeWidth={2.25} aria-hidden /> บันทึก PDF (ตารางอาหาร)</>}
                    </button>
                  </div>

                  <DayCard day={plan[activeDay] ?? plan[0]} showImages={showImages} />

                  {/* Off-canvas designed report for PDF capture (rendered, not visible).
                      aria-hidden + pointer-events:none — present in the DOM only as the
                      html-to-image source for the multi-page A4 export above. */}
                  {reportMeta && (
                    <div aria-hidden style={{ position: "absolute", left: -99999, top: 0, pointerEvents: "none" }}>
                      <PlateReport ref={reportRef} plan={plan} meta={reportMeta} />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}

/* ───────────────────────── Sub-components ───────────────────────── */

function ToggleRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-left transition-colors hover:border-ink-20 focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness"
    >
      <span className="min-w-0">
        <span className="block font-thai text-[13px] font-semibold text-ink">{label}</span>
        {hint && <span className="block font-thai text-[11px] text-ink-60">{hint}</span>}
      </span>
      <span className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${on ? "bg-wellness" : "bg-ink-10"}`} aria-hidden>
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

function TargetsCard({
  targets, goal, variety, dailyAvg, days,
}: {
  targets: ReturnType<typeof calcTargets>;
  goal: Goal;
  variety: ReturnType<typeof planVariety> | null;
  dailyAvg: ReturnType<typeof planDailyAverage> | null;
  days: number;
}) {
  const g = GOALS.find((x) => x.id === goal)!;
  const avgSplit = dailyAvg ? energySplit(dailyAvg) : null;
  const delta = dailyAvg ? avgVsTarget(dailyAvg, targets) : null;
  return (
    <Card className="p-4 lg:p-5">
      <div className="mb-3 flex items-center gap-1.5">
        <IconChip icon={g.icon} tone={g.tone} size={15} className="h-7 w-7" />
        <h2 className="font-head text-[15px] font-bold text-ink">เป้าหมายต่อวัน · {g.label}</h2>
        <span className="ml-auto font-mono text-[11px] text-ink-60">BMI {targets.bmi}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <TargetCell label="พลังงาน" value={targets.kcal.toLocaleString()} unit="kcal" emphasis />
        <TargetCell label="โปรตีน" value={String(targets.p)} unit="g" color="rose" />
        <TargetCell label="คาร์บ" value={String(targets.c)} unit="g" color="amber" />
        <TargetCell label="ไขมัน" value={String(targets.f)} unit="g" color="science" />
      </div>

      {/* Target macro proportion (C:P:F % of energy) */}
      <div className="mt-3.5">
        <SectionLabel>สัดส่วนสารอาหารเป้าหมาย (C : P : F)</SectionLabel>
        <div className="mt-2">
          <MacroBar split={energySplit({ p: targets.p, c: targets.c, f: targets.f })} />
        </div>
      </div>

      {/* Plan daily-average vs target — donut (C:P:F like v1) + bar side by side */}
      {avgSplit && delta && dailyAvg && days > 1 && (
        <div className="mt-3 rounded-xl border border-ink-10 bg-surface px-3.5 py-3">
          <div className="flex items-center justify-between">
            <SectionLabel>ค่าเฉลี่ยจริงต่อวัน ({days} วัน)</SectionLabel>
            <span className="font-mono text-[11px] text-ink-60">
              {Math.round(dailyAvg.kcal).toLocaleString()} kcal
              <b className="ml-1" style={{ color: statusTextHex[Math.abs(delta.kcal) <= targets.kcal * 0.05 ? "optimal" : Math.abs(delta.kcal) <= targets.kcal * 0.1 ? "caution" : "warning"] }}>
                {delta.kcal >= 0 ? "+" : ""}{delta.kcal}
              </b>
            </span>
          </div>
          <div className="mt-2.5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="shrink-0 self-center sm:self-auto">
              <CPFPie
                colors={MACRO_HEX}
                carb_pct={avgSplit.cPct}
                protein_pct={avgSplit.pPct}
                fat_pct={avgSplit.fPct}
                total_kcal={Math.round(dailyAvg.kcal)}
                size={132}
                thickness={26}
                showLegend={false}
              />
            </div>
            <div className="min-w-0 flex-1">
              <MacroBar split={avgSplit} />
              <div className="mt-2 font-mono text-[11px] text-ink-40">
                เทียบเป้า · โปรตีน {delta.p >= 0 ? "+" : ""}{delta.p}g · คาร์บ {delta.c >= 0 ? "+" : ""}{delta.c}g · ไขมัน {delta.f >= 0 ? "+" : ""}{delta.f}g
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-start gap-1.5 rounded-xl bg-surface px-3 py-2">
        <Info size={13} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ink-40" aria-hidden />
        <p className="font-thai text-[12px] leading-relaxed text-ink-60">{targets.note}</p>
      </div>
      {variety && variety.total > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-ink-60">
          <span className="inline-flex items-center gap-1.5">
            <ListChecks size={13} strokeWidth={2.25} className="text-wellness" aria-hidden />
            ความหลากหลายเมนู <b style={{ color: statusTextHex[variety.pct >= 80 ? "optimal" : variety.pct >= 60 ? "caution" : "warning"] }}>{variety.pct}%</b>
          </span>
          <span>โปรตีน {variety.proteins} ชนิด · {variety.distinct}/{variety.total} มื้อไม่ซ้ำ</span>
        </div>
      )}
    </Card>
  );
}

function TargetCell({ label, value, unit, color, emphasis }: { label: string; value: string; unit: string; color?: "rose" | "amber" | "science"; emphasis?: boolean }) {
  const text = emphasis ? "text-ink" : color === "rose" ? "text-rose" : color === "amber" ? "text-amber" : color === "science" ? "text-science" : "text-ink";
  return (
    <div className={`rounded-xl border px-3 py-2.5 text-center ${emphasis ? "border-wellness-pale bg-wellness-ultra" : "border-ink-10 bg-surface"}`}>
      <div className="text-[10px] font-semibold text-ink-60">{label}</div>
      <div className={`mt-0.5 font-head text-[19px] font-extrabold ${text}`}>
        {value}<span className="ml-0.5 text-[10px] font-normal text-ink-40">{unit}</span>
      </div>
    </div>
  );
}

function DayCard({ day, showImages }: { day: DayPlan; showImages: boolean }) {
  const dayTot = sumDay(day);
  const split = energySplit(dayTot);
  return (
    <div className="space-y-4">
      {day.map((meal, i) => <MealCard key={i} meal={meal} showImages={showImages} />)}

      {/* Day total + proportion (donut like v1 on a light inset + bar/readout) */}
      <Card className="bg-ink p-4 text-white lg:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Soup size={15} strokeWidth={2.25} aria-hidden />
            <h3 className="font-head text-[14px] font-bold">รวมทั้งวัน</h3>
          </div>
          <span className="font-head text-[20px] font-extrabold">{Math.round(dayTot.kcal).toLocaleString()}<span className="ml-0.5 text-[11px] font-normal text-white/55">kcal</span></span>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          {/* CPFPie on a warm-white inset so the dark center kcal text stays legible */}
          <div className="shrink-0 self-center rounded-2xl bg-white px-3 py-2 sm:self-auto">
            <CPFPie
              colors={MACRO_HEX}
              carb_pct={split.cPct}
              protein_pct={split.pPct}
              fat_pct={split.fPct}
              total_kcal={Math.round(dayTot.kcal)}
              size={128}
              thickness={26}
              showLegend={false}
            />
          </div>
          <div className="min-w-0 flex-1">
            {/* proportion bar (light segments on dark card) */}
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/15" role="img" aria-label={`สัดส่วนพลังงานทั้งวัน คาร์บ ${split.cPct}% โปรตีน ${split.pPct}% ไขมัน ${split.fPct}%`}>
              <span style={{ width: `${split.cPct}%`, backgroundColor: "#E0A35C" }} title={`คาร์บ ${split.cPct}%`} />
              <span style={{ width: `${split.pPct}%`, backgroundColor: "#CC8A8A" }} title={`โปรตีน ${split.pPct}%`} />
              <span style={{ width: `${split.fPct}%`, backgroundColor: "#6BB8CC" }} title={`ไขมัน ${split.fPct}%`} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[12px]">
              <span className="text-white/85">คาร์บ {split.c}g · {split.cPct}%</span>
              <span className="text-white/85">โปรตีน {split.p}g · {split.pPct}%</span>
              <span className="text-white/85">ไขมัน {split.f}g · {split.fPct}%</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MealCard({ meal, showImages }: { meal: Meal; showImages: boolean }) {
  return (
    <Card className="p-4 lg:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-head text-[15px] font-bold text-ink">{meal.name}</h3>
          {!meal.snack && (meal.main || meal.style) && (
            <p className="mt-0.5 font-thai text-[12px] text-ink-60">
              {meal.style && <span>{meal.style} </span>}
              {meal.main && <span className="font-semibold text-ink-80">{meal.main}</span>}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 font-mono text-[11px] font-semibold text-ink-60">{meal.tot.kcal} kcal</span>
      </div>

      {/* Items */}
      <ul className="mt-3 space-y-1.5">
        {meal.items.map((it, idx) => <MealItemRow key={idx} item={it} />)}
      </ul>

      {/* Meal macro proportion (C:P:F grams + % of energy) */}
      <div className="mt-3 border-t border-ink-5 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>สัดส่วนสารอาหารมื้อนี้</SectionLabel>
          <span className="font-mono text-[10px] text-ink-40">C : P : F · % พลังงาน</span>
        </div>
        <MacroBar split={mealSplit(meal)} />
      </div>

      {/* AI meal photo (lazy) — only when enabled */}
      {showImages && <MealImage meal={meal} />}
    </Card>
  );
}

/** Portion label mirrors the engine/LINE bot: "≈ N unit (Ng)" with 0.5-step rounding. */
function niceQty(x: number): string {
  if (x >= 3) return String(Math.round(x));
  const half = Math.round(x * 2) / 2;
  return half < 0.5 ? "" : half === 0.5 ? "½" : String(half);
}
function MealItemRow({ item }: { item: MealItem }) {
  const cat = CAT_META[item.cat] ?? { label: item.cat, color: "#5C5660" };
  const q = item.ug > 0 ? niceQty(item.g / item.ug) : "";
  const portion = q ? `≈ ${q} ${item.u} · ${item.g}g` : `${item.g}g`;
  const es = itemSplit(item); // per-item energy P:C:F % (display)
  return (
    <li className="flex items-center gap-2.5">
      <span className="h-2 w-2 shrink-0 self-start mt-1 rounded-full" style={{ backgroundColor: cat.color }} aria-hidden title={cat.label} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-thai text-[13px] text-ink">{item.th}</span>
        <span className="block font-mono text-[10px] text-ink-40" aria-label={`พลังงาน คาร์บ ${es.cPct} โปรตีน ${es.pPct} ไขมัน ${es.fPct} เปอร์เซ็นต์`}>
          พลังงาน <b className="text-rose">{es.cPct}</b>:<b className="text-wellness">{es.pPct}</b>:<b className="text-amber">{es.fPct}</b> <span className="text-ink-40">(C:P:F %)</span>
        </span>
      </span>
      <span className="shrink-0 self-start font-mono text-[11px] text-ink-60">{portion}</span>
      <span className="hidden shrink-0 self-start font-mono text-[10px] text-ink-40 sm:inline">{item.kcal} kcal</span>
    </li>
  );
}
