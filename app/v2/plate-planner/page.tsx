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
 * clinical-warm against the shared engine. The optional AI meal-photo generator is intentionally
 * NOT ported here (heavy, non-core) — flagged for follow-up.
 *
 * Clinical-warm: lib/v2/ui primitives, Lucide icons, status TEXT colors, empty/loading/error,
 * ≥44px touch, keyboard-accessible.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  UtensilsCrossed, Flame, HeartPulse, Dumbbell, Loader2, RefreshCw, User2,
  Soup, AlertTriangle, ListChecks, Target, Info,
} from "lucide-react";
import { Shell } from "../_components/Shell";
import { Card, SectionLabel, IconChip, LoadingState } from "@/lib/v2/ui";
import { statusTextHex } from "@/lib/v2/status";
import {
  calcTargets, buildPlan, planVariety, poolHealth,
  type Goal, type Diet, type PlanConfig, type DayPlan, type Meal, type MealItem,
} from "@/lib/plate-planner/engine";

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

const PLAN_LENGTHS = [3, 5, 7];

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
  const [days, setDays] = useState(3);
  const [seed, setSeed] = useState(1);

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

  const [activeDay, setActiveDay] = useState(0);
  useEffect(() => { if (activeDay >= days) setActiveDay(0); }, [days, activeDay]);

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
              {targets && <TargetsCard targets={targets} goal={goal} variety={variety} />}

              {/* Day tabs */}
              {plan && plan.length > 0 && (
                <>
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

                  <DayCard day={plan[activeDay] ?? plan[0]} />
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

function TargetsCard({ targets, goal, variety }: { targets: ReturnType<typeof calcTargets>; goal: Goal; variety: ReturnType<typeof planVariety> | null }) {
  const g = GOALS.find((x) => x.id === goal)!;
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

function DayCard({ day }: { day: DayPlan }) {
  const dayTot = day.reduce((s, m) => ({ p: s.p + m.tot.p, c: s.c + m.tot.c, f: s.f + m.tot.f, kcal: s.kcal + m.tot.kcal }), { p: 0, c: 0, f: 0, kcal: 0 });
  return (
    <div className="space-y-4">
      {day.map((meal, i) => <MealCard key={i} meal={meal} />)}

      {/* Day total */}
      <Card className="bg-ink p-4 text-white lg:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Soup size={15} strokeWidth={2.25} aria-hidden />
            <h3 className="font-head text-[14px] font-bold">รวมทั้งวัน</h3>
          </div>
          <span className="font-head text-[20px] font-extrabold">{Math.round(dayTot.kcal).toLocaleString()}<span className="ml-0.5 text-[11px] font-normal text-white/55">kcal</span></span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[12px]">
          <span className="text-white/85">โปรตีน {Math.round(dayTot.p)}g</span>
          <span className="text-white/85">คาร์บ {Math.round(dayTot.c)}g</span>
          <span className="text-white/85">ไขมัน {Math.round(dayTot.f)}g</span>
        </div>
      </Card>
    </div>
  );
}

function MealCard({ meal }: { meal: Meal }) {
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

      {/* Macro bar vs target */}
      <div className="mt-3 border-t border-ink-5 pt-3">
        <div className="flex items-center justify-between font-mono text-[11px] text-ink-60">
          <span>โปรตีน <b className="text-rose">{meal.tot.p}g</b></span>
          <span>คาร์บ <b className="text-amber">{meal.tot.c}g</b></span>
          <span>ไขมัน <b className="text-science">{meal.tot.f}g</b></span>
        </div>
      </div>
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
  return (
    <li className="flex items-center gap-2.5">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} aria-hidden title={cat.label} />
      <span className="min-w-0 flex-1 truncate font-thai text-[13px] text-ink">{item.th}</span>
      <span className="shrink-0 font-mono text-[11px] text-ink-60">{portion}</span>
      <span className="hidden shrink-0 font-mono text-[10px] text-ink-40 sm:inline">{item.kcal} kcal</span>
    </li>
  );
}
