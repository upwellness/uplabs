"use client";

/**
 * UP Labs v2 · Program Designer (SPEC §7.9)
 * ──────────────────────────────────────────
 * 5-step wizard to design a personalized Full Course: customer + duration (timeline) →
 * product selection by category (Energy / Nutrients / Gut) → targeted add-ons by condition →
 * review with PV / cashback / pricing. Optional ?customer=<id> prefill (name).
 *
 * Reuse (NO formula re-derivation — imports the exact v1 calc engine):
 *   - calc/data: PRODUCTS · WIZARD_STEPS · CONDITION_ADDONS · STANDARD_60D ·
 *                initialItems · processItems · summarize  (app/designer/ProgramData)
 *                → unit math (ceil dose×days/pack), 15% discount, PV (net/3.23),
 *                  cashback tiers — all unchanged.
 *   - API:  GET /api/customers/list (same scope as v1)
 *   - report: ProgramReport (v1 component, HD PNG export) — lazy via next/dynamic.
 *
 * Clinical-warm: lib/v2/ui primitives, Lucide icons, segmented stepper w/ progress,
 * status TEXT colors, ≥44px touch, keyboard-accessible.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Palette, Check, Plus, Minus, ChevronLeft, ChevronRight, FileImage, Zap, Pill,
  Sparkles, Loader2, AlertTriangle, Package, Receipt, ShieldPlus,
} from "lucide-react";
import { Shell } from "../_components/Shell";
import { Card, SectionLabel, IconChip } from "@/lib/v2/ui";
import { statusTextHex } from "@/lib/v2/status";
import {
  PRODUCTS, WIZARD_STEPS, CONDITION_ADDONS, STANDARD_60D,
  initialItems, processItems, summarize,
  type ItemState, type Fees,
} from "@/app/designer/ProgramData";

/** ProgramReport pulls in html-to-image — load it only when the user opens the report. */
const ProgramReport = dynamic(() => import("@/app/designer/ProgramReport").then((m) => m.ProgramReport), {
  ssr: false,
  loading: () => null,
});

interface CustomerOpt { id: string; name: string }

/** Per-step accent (clinical-warm tone tokens; no glass). */
type StepTone = "rose" | "wellness" | "science" | "amber" | "ink";
const STEP_TONE: Record<string, StepTone> = { rose: "rose", wellness: "wellness", science: "science", amber: "amber", ink: "ink" };
const TONE_CLASS: Record<StepTone, { ring: string; bg: string; text: string; dot: string; solid: string }> = {
  rose: { ring: "border-rose", bg: "bg-rose-ultra", text: "text-rose", dot: "bg-rose", solid: "bg-rose" },
  wellness: { ring: "border-wellness", bg: "bg-wellness-ultra", text: "text-wellness", dot: "bg-wellness", solid: "bg-wellness" },
  science: { ring: "border-science", bg: "bg-science-ultra", text: "text-science", dot: "bg-science", solid: "bg-science" },
  amber: { ring: "border-amber", bg: "bg-amber-ultra", text: "text-amber", dot: "bg-amber", solid: "bg-amber" },
  ink: { ring: "border-ink", bg: "bg-surface", text: "text-ink", dot: "bg-ink", solid: "bg-ink" },
};

export default function V2DesignerPage() {
  return (
    <Suspense
      fallback={
        <Shell breadcrumb={[{ label: "หน้าแรก", href: "/v2" }, { label: "Program Designer" }]}>
          <Card className="p-6"><div className="flex items-center gap-2 text-ink-60"><Loader2 size={18} className="animate-spin" aria-hidden /> กำลังโหลด…</div></Card>
        </Shell>
      }
    >
      <DesignerInner />
    </Suspense>
  );
}

function DesignerInner() {
  const search = useSearchParams();
  const presetCustomer = search.get("customer") ?? "";

  const [step, setStep] = useState(0);
  const [duration, setDuration] = useState<30 | 60>(60);
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState(presetCustomer);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [isStd, setIsStd] = useState(false);
  const [activeConds, setActiveConds] = useState<string[]>([]);
  const [items, setItems] = useState<ItemState[]>(initialItems);
  const [fees, setFees] = useState<Fees>({ reg: false, estart: false, ajoy: false });
  const [reportOpen, setReportOpen] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/customers/list");
      const json = await res.json();
      setCustomers((json.customers ?? []).map((c: any) => ({ id: c.id, name: c.name })));
    } catch { /* non-fatal */ }
  }, []);
  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { setCustomerId(presetCustomer); }, [presetCustomer]);

  // Auto-fill name from selected customer
  useEffect(() => {
    if (customerId) {
      const c = customers.find((c) => c.id === customerId);
      if (c) setName(c.name);
    }
  }, [customerId, customers]);

  // ── v1 calc engine (imported, unchanged) ──
  const processed = useMemo(() => processItems(items, duration, isStd, activeConds), [items, duration, isStd, activeConds]);
  const summary = useMemo(() => summarize(processed, fees), [processed, fees]);
  const selected = processed.filter((i) => i.qty > 0);

  const updateItem = (id: string, field: keyof ItemState, val: any) => {
    setItems((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      const upd = { ...i, [field]: val };
      if (field === "qty") upd.isManual = true;
      if (["dM", "dN", "dE"].includes(String(field))) upd.isManual = false;
      return upd;
    }));
  };

  const toggleStd = () => {
    const next = !isStd; setIsStd(next);
    if (next) {
      setItems((prev) => prev.map((i) => {
        const s = STANDARD_60D[i.id];
        return s ? { ...i, dM: s.dM ?? "", dN: s.dN ?? "", dE: s.dE ?? "", rmk: s.rmk ?? "", isManual: false } : i;
      }));
    } else {
      setItems(initialItems());
      setActiveConds([]);
    }
  };

  const toggleCond = (cid: string) => {
    const isRemove = activeConds.includes(cid);
    const next = isRemove ? activeConds.filter((x) => x !== cid) : [...activeConds, cid];
    setActiveConds(next);
    if (!isRemove) {
      const cond = CONDITION_ADDONS.find((c) => c.id === cid)!;
      setItems((prev) => prev.map((i) => cond.items[i.id]
        ? { ...i, ...cond.items[i.id], rmk: cond.items[i.id].rmk ?? i.rmk, isManual: false }
        : i));
    } else {
      const condRem = CONDITION_ADDONS.find((c) => c.id === cid)!;
      setItems((prev) => prev.map((item) => {
        if (condRem.items[item.id]) {
          const neededByStd = isStd && STANDARD_60D[item.id];
          const neededByOther = CONDITION_ADDONS.some((c) => next.includes(c.id) && c.items[item.id]);
          if (!neededByStd && !neededByOther) return { ...item, dM: "", dN: "", dE: "", rmk: "", qty: 0, isManual: false };
        }
        return item;
      }));
    }
  };

  const goNext = () => setStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1));
  const goPrev = () => setStep((s) => Math.max(0, s - 1));

  const curStep = WIZARD_STEPS[step];
  const tone = STEP_TONE[curStep.color] ?? "rose";
  const toneCls = TONE_CLASS[tone];
  const isSummary = step === WIZARD_STEPS.length - 1;

  return (
    <Shell breadcrumb={[{ label: "หน้าแรก", href: "/v2" }, { label: "Program Designer" }]}>
      {/* Page header */}
      <div className="mb-5 flex items-start gap-3">
        <IconChip icon={Palette} tone="rose" size={20} className="mt-0.5 h-10 w-10" />
        <div>
          <h1 className="font-head text-[23px] font-extrabold tracking-tight text-ink">Program Designer</h1>
          <p className="mt-1 max-w-2xl font-thai text-[13px] leading-[1.6] text-ink-60">
            ออกแบบ Full Course เฉพาะบุคคล · 5 ขั้นตอน · คำนวณจำนวนหน่วยอัตโนมัติ · ส่วนลด · PV + cashback · ส่งออกรายงาน HD
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr,320px]">
        {/* ── Main column ── */}
        <div className="space-y-5">
          {/* Toolbar: customer + name + timeline + standard */}
          <Card className="p-4">
            <div className="grid items-end gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-60">ลูกค้า (ไม่บังคับ)</span>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-rose focus:ring-2 focus:ring-rose-ultra"
                >
                  <option value="">— ระบุชื่อด้านขวา —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-60">ชื่อผู้รับบริการ</span>
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="ระบุชื่อ…"
                  className="min-h-[44px] w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:ring-2 focus:ring-rose-ultra"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold text-ink-60">ระยะเวลา</span>
              <div className="inline-flex rounded-full border border-ink-10 bg-white p-0.5" role="group" aria-label="ระยะเวลาโปรแกรม">
                {[30, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d as 30 | 60)}
                    aria-pressed={duration === d}
                    className={`min-h-[36px] rounded-full px-4 py-1.5 text-[12px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose ${
                      duration === d ? "bg-ink text-white" : "text-ink-60 hover:text-ink"
                    }`}
                  >
                    {d} วัน
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={toggleStd}
                aria-pressed={isStd}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose ${
                  isStd ? "border-rose bg-rose text-white" : "border-ink-10 bg-white text-ink-60 hover:border-rose hover:text-rose"
                }`}
              >
                {isStd ? <Check size={14} strokeWidth={2.5} aria-hidden /> : <Plus size={14} strokeWidth={2.5} aria-hidden />}
                Standard 60 วัน
              </button>
            </div>
          </Card>

          {/* Stepper (segmented + progress · SPEC §6 long-form progress) */}
          <Card className="p-4 lg:p-5">
            <ol className="flex items-center gap-1.5" aria-label="ขั้นตอน">
              {WIZARD_STEPS.map((s, idx) => {
                const c = TONE_CLASS[STEP_TONE[s.color] ?? "rose"];
                const isActive = step === idx;
                const isDone = step > idx;
                return (
                  <li key={s.id} className="flex flex-1 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStep(idx)}
                      aria-current={isActive ? "step" : undefined}
                      aria-label={`ขั้นที่ ${idx + 1}: ${s.title}`}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose ${
                        isActive ? `${c.solid} text-white` : isDone ? "bg-ink text-white" : "bg-ink-5 text-ink-40"
                      }`}
                    >
                      {isDone ? <Check size={15} strokeWidth={2.75} aria-hidden /> : idx + 1}
                    </button>
                    <span className={`hidden min-w-0 truncate text-[11px] font-semibold md:block ${isActive ? c.text : "text-ink-40"}`}>{s.title}</span>
                    {idx < WIZARD_STEPS.length - 1 && <div className={`h-px flex-1 ${isDone ? "bg-ink" : "bg-ink-10"}`} aria-hidden />}
                  </li>
                );
              })}
            </ol>
            {/* progress bar */}
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink-5" aria-hidden>
              <div className={`h-full rounded-full transition-all ${toneCls.solid}`} style={{ width: `${((step + 1) / WIZARD_STEPS.length) * 100}%` }} />
            </div>
          </Card>

          {/* Step content */}
          <Card className="p-4 lg:p-5">
            <div className="mb-5 flex items-start gap-2.5">
              <IconChip icon={STEP_ICON[curStep.color] ?? Zap} tone={tone} size={18} className="mt-0.5 h-9 w-9" />
              <div>
                <SectionLabel className={toneCls.text}>ขั้นที่ {step + 1} / {WIZARD_STEPS.length} · {curStep.title}</SectionLabel>
                <h2 className="mt-0.5 font-head text-[19px] font-extrabold tracking-tight text-ink">{curStep.desc}</h2>
              </div>
            </div>

            {!isSummary ? (
              <>
                {/* Targeted Care step → condition add-ons */}
                {curStep.title === "Targeted Care" && (
                  <div className="mb-5 rounded-2xl border border-amber-pale bg-amber-ultra p-4">
                    <div className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold text-amber">
                      <Zap size={14} strokeWidth={2.25} aria-hidden /> เสริมตามสภาวะสุขภาพ
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CONDITION_ADDONS.map((c) => {
                        const on = activeConds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleCond(c.id)}
                            aria-pressed={on}
                            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 py-1.5 font-thai text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber ${
                              on ? "bg-amber text-white" : "border border-ink-10 bg-white text-ink-60 hover:border-amber"
                            }`}
                          >
                            {on ? <Check size={13} strokeWidth={2.5} aria-hidden /> : <Plus size={13} strokeWidth={2.5} aria-hidden />}
                            {c.icon} {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  {PRODUCTS.filter((p) => curStep.cats.includes(p.cat)).map((prod) => {
                    const item = processed.find((i) => i.id === prod.id)!;
                    const isSelected = item.qty > 0;
                    const c = TONE_CLASS[STEP_TONE[prod.color] ?? "rose"];
                    return (
                      <div
                        key={prod.id}
                        className={`rounded-2xl border-2 p-4 transition-all ${isSelected ? `${c.ring} ${c.bg}` : "border-ink-10 bg-white"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => !isSelected && updateItem(prod.id, "qty", 1)}
                            disabled={isSelected}
                            className="min-w-0 flex-1 text-left disabled:cursor-default"
                            aria-label={isSelected ? prod.name : `เพิ่ม ${prod.name}`}
                          >
                            <div className="font-thai text-[14px] font-bold text-ink">{prod.name}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[10px] text-ink-40">
                              <span>฿{prod.price.toLocaleString()}</span>
                              <span aria-hidden>·</span>
                              <span>{prod.pack} {prod.doseUnit}/{prod.containerUnit}</span>
                              {prod.canDisc && <><span aria-hidden>·</span><span style={{ color: statusTextHex.optimal }}>ลด 15%</span></>}
                            </div>
                          </button>
                          {isSelected ? (
                            <div className="flex items-center gap-0.5 rounded-full border border-ink-10 bg-white px-0.5">
                              <button type="button" onClick={() => updateItem(item.id, "qty", Math.max(0, item.qty - 1))} aria-label="ลดจำนวน" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-60 hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose">
                                <Minus size={15} strokeWidth={2.5} aria-hidden />
                              </button>
                              <span className="w-6 text-center font-mono text-[13px] font-bold text-ink">{item.qty}</span>
                              <button type="button" onClick={() => updateItem(item.id, "qty", item.qty + 1)} aria-label="เพิ่มจำนวน" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-60 hover:text-wellness focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness">
                                <Plus size={15} strokeWidth={2.5} aria-hidden />
                              </button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => updateItem(prod.id, "qty", 1)} aria-label={`เพิ่ม ${prod.name}`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-5 text-ink-40 transition-colors hover:bg-rose-ultra hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose">
                              <Plus size={16} strokeWidth={2.5} aria-hidden />
                            </button>
                          )}
                        </div>

                        {isSelected && (
                          <div className="mt-3 space-y-2 border-t border-ink-10 pt-3">
                            <div className="text-[11px] font-semibold text-ink-60">โดส · เช้า / กลางวัน / เย็น</div>
                            <div className="flex gap-1.5">
                              {(["dM", "dN", "dE"] as const).map((f) => (
                                <input
                                  key={f}
                                  type="text" inputMode="decimal" placeholder="-"
                                  aria-label={`โดส ${f === "dM" ? "เช้า" : f === "dN" ? "กลางวัน" : "เย็น"} ของ ${prod.name}`}
                                  value={(item as any)[f]}
                                  onChange={(e) => updateItem(item.id, f, e.target.value)}
                                  className="h-11 w-12 rounded-lg border border-ink-10 bg-white text-center font-mono text-[14px] font-bold text-ink outline-none focus:border-rose focus:ring-2 focus:ring-rose-ultra"
                                />
                              ))}
                              <input
                                type="text" placeholder="หมายเหตุ…"
                                aria-label={`หมายเหตุ ${prod.name}`}
                                value={item.rmk}
                                onChange={(e) => updateItem(item.id, "rmk", e.target.value)}
                                className="h-11 flex-1 rounded-lg border border-ink-10 bg-white px-3 font-thai text-[12px] text-ink outline-none focus:border-rose focus:ring-2 focus:ring-rose-ultra"
                              />
                            </div>
                            <PackMath item={item} duration={duration} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <SummaryStep summary={summary} fees={fees} setFees={setFees} onUpdate={updateItem} onOpenReport={() => setReportOpen(true)} name={name} />
            )}

            {/* Nav */}
            <div className="mt-6 flex items-center justify-between border-t border-ink-10 pt-4">
              <button
                type="button" onClick={goPrev} disabled={step === 0}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-surface px-4 py-2 text-[13px] font-semibold text-ink-60 transition-colors hover:bg-ink-5 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose"
              >
                <ChevronLeft size={15} strokeWidth={2.5} aria-hidden /> ย้อนกลับ
              </button>
              {!isSummary ? (
                <button
                  type="button" onClick={goNext}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-rose px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-rose-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
                >
                  ถัดไป <ChevronRight size={15} strokeWidth={2.5} aria-hidden />
                </button>
              ) : <span className="w-20" />}
            </div>
          </Card>
        </div>

        {/* ── Sticky summary sidebar ── */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card className="p-4 lg:p-5">
            <div className="mb-3 flex items-center gap-1.5">
              <Package size={15} strokeWidth={2.25} className="text-rose" aria-hidden />
              <h2 className="font-head text-[15px] font-bold text-ink">ผลิตภัณฑ์ที่เลือก</h2>
              <span className="ml-auto rounded-full bg-ink-5 px-2 py-0.5 font-mono text-[11px] text-ink-60">{selected.length}</span>
            </div>
            <div className="max-h-[40vh] space-y-1.5 overflow-y-auto pr-1">
              {selected.length === 0 ? (
                <p className="py-3 text-center font-thai text-[12px] italic text-ink-40">ยังไม่ได้เลือก — เลือกผลิตภัณฑ์ตามขั้นตอน</p>
              ) : selected.map((i) => {
                const c = TONE_CLASS[STEP_TONE[i.color] ?? "rose"];
                return (
                  <div key={i.id} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-thai text-[12px] font-semibold text-ink">{i.name}</div>
                      <div className="font-mono text-[9px] text-ink-40">{i.qty} {i.containerUnit} · ฿{(i.price * i.qty).toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 border-t border-ink-10 pt-4">
              <SectionLabel>ยอดสุทธิ</SectionLabel>
              <div className="mt-1 font-head text-[28px] font-extrabold leading-none text-ink">฿{summary.net.toLocaleString()}</div>
              <div className="mt-1 font-mono text-[11px] text-ink-60">
                PV {Math.round(summary.pv).toLocaleString()} · cashback ฿{Math.round(summary.cb).toLocaleString()} ({summary.rate}%)
              </div>
            </div>
          </Card>
        </aside>
      </div>

      {reportOpen && (
        <ProgramReport
          onClose={() => setReportOpen(false)}
          name={name || "—"}
          duration={duration}
          items={selected}
          summary={summary}
          activeConds={activeConds}
          isStd={isStd}
        />
      )}
    </Shell>
  );
}

/** Icon per wizard step (keyed by the step's color, which is unique per step). */
const STEP_ICON: Record<string, typeof Zap> = {
  rose: Zap, wellness: Pill, science: ShieldPlus, amber: Sparkles, ink: Receipt,
};

/* ───────────────────────── Pack-math hint ───────────────────────── */

function PackMath({ item, duration }: { item: ItemState; duration: number }) {
  const dSum = (parseFloat(item.dM) || 0) + (parseFloat(item.dN) || 0) + (parseFloat(item.dE) || 0);
  if (dSum === 0) return null;
  const unitsTotal = dSum * duration;
  const containersNeeded = Math.ceil(unitsTotal / item.pack);
  const isOverride = item.isManual && item.qty !== containersNeeded;
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 font-mono text-[10px] text-ink-60">
      <span>{dSum} {item.doseUnit}/วัน × {duration} วัน = {unitsTotal} {item.doseUnit}</span>
      <ChevronRight size={11} strokeWidth={2.5} className="text-ink-40" aria-hidden />
      <span className={`font-bold ${isOverride ? "text-ink-40 line-through" : "text-ink"}`}>{containersNeeded} {item.containerUnit}</span>
      {isOverride && <span className="font-bold" style={{ color: statusTextHex.warning }}>· ปรับเอง: {item.qty} {item.containerUnit}</span>}
    </div>
  );
}

/* ───────────────────────── Summary step ───────────────────────── */

const FEE_DEFS = [
  { id: "reg" as const, label: "สมัครสมาชิกใหม่", sign: "+", val: 900 },
  { id: "estart" as const, label: "e-Starter", sign: "−", val: 300 },
  { id: "ajoy" as const, label: "A-Joy", sign: "−", val: 500 },
];

function SummaryStep({ summary, fees, setFees, onUpdate, onOpenReport, name }: {
  summary: ReturnType<typeof summarize>;
  fees: Fees;
  setFees: (f: Fees) => void;
  onUpdate: (id: string, field: keyof ItemState, val: any) => void;
  onOpenReport: () => void;
  name: string;
}) {
  return (
    <div className="space-y-5">
      {/* Editable stack — desktop table + mobile card list */}
      <div className="overflow-hidden rounded-2xl border border-ink-10">
        <div className="bg-surface px-4 py-2.5"><SectionLabel>รายการที่ปรับได้</SectionLabel></div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-ink-10 bg-surface">
              <tr className="text-[11px] font-semibold text-ink-60">
                <th className="px-4 py-3">ผลิตภัณฑ์</th>
                <th className="px-2 py-3 text-center">โดส ช/ก/ย</th>
                <th className="px-2 py-3 text-center">จำนวน</th>
                <th className="px-2 py-3 text-right">ส่วนลด</th>
                <th className="px-4 py-3 text-right">ยอดสุทธิ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-5">
              {summary.itemDetails.map((i) => (
                <tr key={i.id} className="hover:bg-surface/60">
                  <td className="px-4 py-3">
                    <div className="font-thai text-[13px] font-semibold text-ink">{i.name}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-ink-40">{i.cat}</div>
                    {i.rmk && <div className="mt-1 font-thai text-[11px] italic text-ink-60">{i.rmk}</div>}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex justify-center gap-1">
                      {(["dM", "dN", "dE"] as const).map((f) => (
                        <input key={f} type="text" inputMode="decimal" aria-label={`โดส ${f} ของ ${i.name}`}
                          value={(i as any)[f]} onChange={(e) => onUpdate(i.id, f, e.target.value)}
                          className="h-9 w-9 rounded-md border border-ink-10 bg-white text-center font-mono text-[12px] font-bold text-ink outline-none focus:border-rose focus:ring-2 focus:ring-rose-ultra" />
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => onUpdate(i.id, "qty", Math.max(0, i.qty - 1))} aria-label="ลดจำนวน" className="inline-flex h-8 w-8 items-center justify-center rounded text-ink-60 hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose"><Minus size={14} strokeWidth={2.5} aria-hidden /></button>
                      <span className="w-5 text-center font-mono text-[13px] font-bold text-ink">{i.qty}</span>
                      <button type="button" onClick={() => onUpdate(i.id, "qty", i.qty + 1)} aria-label="เพิ่มจำนวน" className="inline-flex h-8 w-8 items-center justify-center rounded text-ink-60 hover:text-wellness focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness"><Plus size={14} strokeWidth={2.5} aria-hidden /></button>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-right font-mono text-[12px]" style={{ color: i.discountVal > 0 ? statusTextHex.optimal : "#8A838E" }}>
                    {i.discountVal > 0 ? `−฿${i.discountVal.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[13px] font-bold text-ink">฿{i.lineTotal.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <ul className="divide-y divide-ink-5 sm:hidden">
          {summary.itemDetails.map((i) => (
            <li key={i.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-thai text-[13px] font-semibold text-ink">{i.name}</div>
                  <div className="font-mono text-[10px] text-ink-40">{i.cat}</div>
                </div>
                <div className="text-right font-mono text-[13px] font-bold text-ink">฿{i.lineTotal.toLocaleString()}</div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex gap-1">
                  {(["dM", "dN", "dE"] as const).map((f) => (
                    <input key={f} type="text" inputMode="decimal" aria-label={`โดส ${f} ของ ${i.name}`}
                      value={(i as any)[f]} onChange={(e) => onUpdate(i.id, f, e.target.value)}
                      className="h-10 w-10 rounded-md border border-ink-10 bg-white text-center font-mono text-[13px] font-bold text-ink outline-none focus:border-rose focus:ring-2 focus:ring-rose-ultra" />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => onUpdate(i.id, "qty", Math.max(0, i.qty - 1))} aria-label="ลดจำนวน" className="inline-flex h-10 w-10 items-center justify-center rounded text-ink-60 hover:text-rose"><Minus size={15} strokeWidth={2.5} aria-hidden /></button>
                  <span className="w-6 text-center font-mono text-[14px] font-bold text-ink">{i.qty}</span>
                  <button type="button" onClick={() => onUpdate(i.id, "qty", i.qty + 1)} aria-label="เพิ่มจำนวน" className="inline-flex h-10 w-10 items-center justify-center rounded text-ink-60 hover:text-wellness"><Plus size={15} strokeWidth={2.5} aria-hidden /></button>
                </div>
              </div>
              {i.discountVal > 0 && <div className="mt-1 font-mono text-[11px]" style={{ color: statusTextHex.optimal }}>ส่วนลด −฿{i.discountVal.toLocaleString()}</div>}
              {i.rmk && <div className="mt-1 font-thai text-[11px] italic text-ink-60">{i.rmk}</div>}
            </li>
          ))}
        </ul>
      </div>

      {/* Big total */}
      <div className="rounded-2xl bg-ink p-5 text-white lg:p-6">
        <div className="grid items-end gap-4 sm:grid-cols-[1fr,auto,auto]">
          <div>
            <div className="text-[11px] font-semibold text-white/55">ยอดลงทุนรวม</div>
            <div className="mt-1.5 font-head text-[36px] font-extrabold leading-none">฿{summary.net.toLocaleString()}</div>
          </div>
          <div className="hidden h-12 w-px bg-white/10 sm:block" aria-hidden />
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="text-[10px] font-semibold text-white/55">PV</div>
              <div className="mt-1 font-mono text-[20px] font-bold">{Math.round(summary.pv).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-white/55">Cashback ({summary.rate}%)</div>
              <div className="mt-1 font-mono text-[20px] font-bold">฿{Math.round(summary.cb).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fees */}
      <div className="rounded-2xl border border-ink-10 bg-white p-4">
        <SectionLabel>ค่าธรรมเนียม / ส่วนลดเพิ่ม</SectionLabel>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {FEE_DEFS.map((f) => {
            const on = fees[f.id];
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFees({ ...fees, [f.id]: !on })}
                aria-pressed={on}
                className={`rounded-xl border-2 px-4 py-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose ${
                  on ? "border-rose bg-rose-ultra" : "border-ink-10 bg-white hover:border-ink-20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-thai text-[13px] font-semibold text-ink">{f.label}</span>
                  {on ? <Check size={16} strokeWidth={2.5} className="text-rose" aria-hidden /> : <span className="inline-block h-4 w-4 rounded-full border-2 border-ink-20" aria-hidden />}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-ink-60">{f.sign}฿{f.val}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onOpenReport}
          disabled={summary.itemDetails.length === 0}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-6 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-rose-mid disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
        >
          <FileImage size={16} strokeWidth={2.25} aria-hidden /> สร้างรายงาน (HD PNG)
        </button>
        {!name && (
          <div className="inline-flex items-center gap-1.5 font-thai text-[12px]" style={{ color: statusTextHex.warning }}>
            <AlertTriangle size={14} strokeWidth={2.25} aria-hidden /> ระบุชื่อก่อนสร้างรายงาน
          </div>
        )}
      </div>
    </div>
  );
}
