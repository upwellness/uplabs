"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ProgramReport } from "./ProgramReport";
import {
  PRODUCTS, WIZARD_STEPS, CONDITION_ADDONS, STANDARD_60D,
  initialItems, processItems, summarize,
  type ItemState, type Fees, type WizardStep,
} from "./ProgramData";

interface CustomerOpt { id: string; name: string }

const COLOR_CLASS: Record<string, { ring: string; bg: string; text: string; dot: string; pillBg: string; pillText: string }> = {
  rose:     { ring: "border-rose",     bg: "bg-rose-ultra",     text: "text-rose",     dot: "bg-rose",     pillBg: "bg-rose",     pillText: "text-white" },
  wellness: { ring: "border-wellness", bg: "bg-wellness-ultra", text: "text-wellness", dot: "bg-wellness", pillBg: "bg-wellness", pillText: "text-white" },
  science:  { ring: "border-science",  bg: "bg-science-ultra",  text: "text-science",  dot: "bg-science",  pillBg: "bg-science",  pillText: "text-white" },
  amber:    { ring: "border-amber",    bg: "bg-amber-ultra",    text: "text-amber",    dot: "bg-amber",    pillBg: "bg-amber",    pillText: "text-white" },
  ink:      { ring: "border-ink",      bg: "bg-surface",        text: "text-ink",      dot: "bg-ink",      pillBg: "bg-ink",      pillText: "text-white" },
};

export function DesignerClient() {
  const [step,        setStep]        = useState(0);
  const [duration,    setDuration]    = useState<30 | 60>(60);
  const [name,        setName]        = useState("");
  const [customerId,  setCustomerId]  = useState("");
  const [customers,   setCustomers]   = useState<CustomerOpt[]>([]);
  const [isStd,       setIsStd]       = useState(false);
  const [activeConds, setActiveConds] = useState<string[]>([]);
  const [items,       setItems]       = useState<ItemState[]>(initialItems);
  const [fees,        setFees]        = useState<Fees>({ reg: false, estart: false, ajoy: false });
  const [reportOpen,  setReportOpen]  = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/customers/list");
        const json = await res.json();
        setCustomers((json.customers ?? []).map((c: any) => ({ id: c.id, name: c.name })));
      } catch {}
    })();
  }, []);

  // Auto-fill name from selected customer
  useEffect(() => {
    if (customerId) {
      const c = customers.find((c) => c.id === customerId);
      if (c) setName(c.name);
    }
  }, [customerId, customers]);

  const processed = useMemo(() => processItems(items, duration, isStd, activeConds), [items, duration, isStd, activeConds]);
  const summary   = useMemo(() => summarize(processed, fees), [processed, fees]);
  const selected  = processed.filter((i) => i.qty > 0);

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
        return s
          ? { ...i, dM: s.dM ?? "", dN: s.dN ?? "", dE: s.dE ?? "", rmk: s.rmk ?? "", isManual: false }
          : i;
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
          const neededByStd   = isStd && STANDARD_60D[item.id];
          const neededByOther = CONDITION_ADDONS.some((c) => next.includes(c.id) && c.items[item.id]);
          if (!neededByStd && !neededByOther) return { ...item, dM: "", dN: "", dE: "", rmk: "", qty: 0, isManual: false };
        }
        return item;
      }));
    }
  };

  const goNext = () => setStep((s) => Math.min(4, s + 1));
  const goPrev = () => setStep((s) => Math.max(0, s - 1));

  const curStep = WIZARD_STEPS[step];
  const curColor = COLOR_CLASS[curStep.color];

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,320px]">
      {/* ─── Main column ──────────────────────────────────── */}
      <div className="space-y-6">

        {/* Toolbar */}
        <section className="rounded-3xl border border-ink-10 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr,1fr,auto] items-end">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Customer (optional)</span>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm focus:border-rose focus:outline-none"
              >
                <option value="">— ระบุชื่อด้านล่าง —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">ชื่อผู้รับบริการ</span>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="ระบุชื่อ..."
                className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm focus:border-rose focus:outline-none"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full border border-ink-10 bg-white p-0.5">
                <button onClick={() => setDuration(30)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${duration === 30 ? "bg-ink text-white" : "text-ink-40"}`}>
                  30 วัน
                </button>
                <button onClick={() => setDuration(60)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${duration === 60 ? "bg-ink text-white" : "text-ink-40"}`}>
                  60 วัน
                </button>
              </div>
              <Button variant={isStd ? "rose" : "outline"} size="sm" onClick={toggleStd}>
                {isStd ? "✓ Standard 60D" : "+ Standard 60D"}
              </Button>
            </div>
          </div>
        </section>

        {/* Stepper */}
        <section className="rounded-3xl border border-ink-10 bg-white px-6 py-5">
          <div className="flex items-center justify-between gap-2">
            {WIZARD_STEPS.map((s, idx) => {
              const c = COLOR_CLASS[s.color];
              const isActive = step === idx;
              const isDone   = step > idx;
              return (
                <div key={s.id} className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => setStep(idx)}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold transition-all
                      ${isActive ? `${c.pillBg} ${c.pillText}` : isDone ? "bg-ink text-white" : "bg-ink-5 text-ink-40"}`}>
                    {isDone ? "✓" : idx + 1}
                  </button>
                  <div className="hidden md:block min-w-0">
                    <div className={`font-mono text-[9px] uppercase tracking-[0.1em] ${isActive ? c.text : "text-ink-40"}`}>{s.title}</div>
                  </div>
                  {idx < WIZARD_STEPS.length - 1 && (
                    <div className={`h-px flex-1 ${isDone ? "bg-ink" : "bg-ink-10"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Step content */}
        <section className="rounded-3xl border border-ink-10 bg-white p-6">
          <div className="mb-5">
            <div className={`font-mono text-[10px] uppercase tracking-[0.14em] ${curColor.text}`}>
              Step {String(step + 1).padStart(2, "0")} · {curStep.title}
            </div>
            <h2 className="mt-1 font-head text-[22px] font-extrabold tracking-tight text-ink">{curStep.desc}</h2>
          </div>

          {step < 4 ? (
            <>
              {step === 3 && (
                <div className={`mb-5 rounded-2xl border border-amber/30 ${COLOR_CLASS.amber.bg} p-4`}>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber font-bold mb-3">
                    ⚡ เสริมเพิ่มตามสภาวะสุขภาพ
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CONDITION_ADDONS.map((c) => {
                      const on = activeConds.includes(c.id);
                      return (
                        <button key={c.id} onClick={() => toggleCond(c.id)}
                          className={`rounded-full px-4 py-1.5 font-thai text-[12px] font-semibold transition-colors
                            ${on ? "bg-amber text-white" : "bg-white text-ink-60 border border-ink-10 hover:border-amber"}`}>
                          {on ? "✓ " : "+ "}{c.icon} {c.name}
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
                  const c = COLOR_CLASS[prod.color];
                  return (
                    <div
                      key={prod.id}
                      onClick={() => !isSelected && updateItem(prod.id, "qty", 1)}
                      className={`rounded-2xl border-2 p-4 transition-all cursor-pointer
                        ${isSelected ? `${c.ring} ${c.bg}` : "border-ink-10 bg-white hover:border-ink-20"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-thai text-[14px] font-bold text-ink">{prod.name}</div>
                          <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-ink-40">
                            <span>฿{prod.price.toLocaleString()}</span>
                            <span>·</span>
                            <span>{prod.pack} {prod.doseUnit}/{prod.containerUnit}</span>
                            {prod.canDisc && <><span>·</span><span className="text-status-optimal">15%</span></>}
                          </div>
                        </div>
                        {isSelected ? (
                          <div className="flex items-center gap-1 rounded-full border border-ink-10 bg-white px-1" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => updateItem(item.id, "qty", Math.max(0, item.qty - 1))}
                              className="h-6 w-6 text-ink-40 hover:text-rose">−</button>
                            <span className="w-5 text-center font-mono text-[12px] font-bold text-ink">{item.qty}</span>
                            <button onClick={() => updateItem(item.id, "qty", item.qty + 1)}
                              className="h-6 w-6 text-ink-40 hover:text-wellness">+</button>
                          </div>
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-ink-5 text-ink-40 flex items-center justify-center text-sm">+</div>
                        )}
                      </div>

                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-ink-10 space-y-2" onClick={(e) => e.stopPropagation()}>
                          <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-40">โดส · ช / ก / ย</div>
                          <div className="flex gap-1.5">
                            {(["dM", "dN", "dE"] as const).map((f) => (
                              <input
                                key={f}
                                type="text" placeholder="-"
                                value={(item as any)[f]}
                                onChange={(e) => updateItem(item.id, f, e.target.value)}
                                className="h-9 w-12 rounded-lg border border-ink-10 bg-white text-center font-mono text-sm font-bold text-ink focus:border-rose focus:outline-none"
                              />
                            ))}
                            <input
                              type="text" placeholder="หมายเหตุ..."
                              value={item.rmk}
                              onChange={(e) => updateItem(item.id, "rmk", e.target.value)}
                              className="flex-1 h-9 rounded-lg border border-ink-10 bg-white px-3 font-thai text-xs text-ink focus:border-rose focus:outline-none"
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
            <SummaryStep
              summary={summary} fees={fees} setFees={setFees}
              items={processed} duration={duration}
              onUpdate={updateItem}
              onOpenReport={() => setReportOpen(true)}
              name={name}
            />
          )}

          {/* Nav */}
          <div className="mt-6 flex items-center justify-between border-t border-ink-10 pt-4">
            <Button variant="ghost" size="sm" onClick={goPrev} disabled={step === 0}>← ย้อนกลับ</Button>
            <div className="flex gap-1">
              {WIZARD_STEPS.map((s, idx) => (
                <div key={idx} className={`h-1.5 rounded-full transition-all ${step === idx ? `w-10 ${COLOR_CLASS[curStep.color].pillBg}` : "w-2 bg-ink-10"}`} />
              ))}
            </div>
            {step < 4 ? (
              <Button variant="rose" size="sm" onClick={goNext}>ถัดไป →</Button>
            ) : <div className="w-20" />}
          </div>
        </section>
      </div>

      {/* ─── Sticky sidebar ───────────────────────────────── */}
      <aside className="lg:sticky lg:top-20 self-start space-y-4">
        <div className="rounded-3xl border border-ink-10 bg-white p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Stack</div>
          <h3 className="mt-1 font-head text-[16px] font-extrabold text-ink">
            ผลิตภัณฑ์ ({selected.length})
          </h3>
          <div className="mt-3 space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
            {selected.length === 0 ? (
              <div className="font-thai text-[12px] text-ink-40 italic py-3 text-center">ยังไม่ได้เลือก · เลือกผลิตภัณฑ์ตามขั้นตอน</div>
            ) : selected.map((i) => {
              const c = COLOR_CLASS[i.color];
              return (
                <div key={i.id} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
                  <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-thai text-[12px] font-semibold text-ink truncate">{i.name}</div>
                    <div className="font-mono text-[9px] text-ink-40">{i.qty} {i.containerUnit} · ฿{(i.price * i.qty).toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 border-t border-ink-10 pt-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Net total</div>
            <div className="mt-1 font-head text-[28px] font-extrabold text-ink leading-none">
              ฿{summary.net.toLocaleString()}
            </div>
            <div className="mt-1 font-mono text-[11px] text-ink-60">
              PV {Math.round(summary.pv).toLocaleString()} · CB ฿{Math.round(summary.cb).toLocaleString()} ({summary.rate}%)
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Report modal ─────────────────────────────────── */}
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
    </div>
  );
}

/* ─── Pack math hint (shown under dose inputs) ──────────────── */

function PackMath({ item, duration }: { item: ItemState; duration: number }) {
  const dSum = (parseFloat(item.dM) || 0) + (parseFloat(item.dN) || 0) + (parseFloat(item.dE) || 0);
  if (dSum === 0) return null;
  const unitsTotal = dSum * duration;
  const containersNeeded = Math.ceil(unitsTotal / item.pack);
  const isOverride = item.isManual && item.qty !== containersNeeded;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 font-mono text-[10px] text-ink-60">
      <span>{dSum} {item.doseUnit}/วัน × {duration} วัน = {unitsTotal} {item.doseUnit}</span>
      <span className="text-ink-40">→</span>
      <span className={`font-bold ${isOverride ? "text-ink-40 line-through" : "text-ink"}`}>{containersNeeded} {item.containerUnit}</span>
      {isOverride && (
        <span className="font-bold text-status-warning">· manual: {item.qty} {item.containerUnit}</span>
      )}
    </div>
  );
}

/* ─── Summary step ─────────────────────────────────────────── */

function SummaryStep({
  summary, fees, setFees, items, onUpdate, onOpenReport, name,
}: {
  summary: ReturnType<typeof summarize>;
  fees: Fees;
  setFees: (f: Fees) => void;
  items: ItemState[];
  duration: number;
  onUpdate: (id: string, field: keyof ItemState, val: any) => void;
  onOpenReport: () => void;
  name: string;
}) {
  return (
    <div className="space-y-6">
      {/* Editable table */}
      <div className="rounded-2xl border border-ink-10 overflow-hidden">
        <div className="bg-surface px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
          Personalized stack (editable)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface border-b border-ink-10">
              <tr className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-40">
                <th className="px-4 py-3 w-[28%]">ผลิตภัณฑ์</th>
                <th className="px-2 py-3 text-center w-[24%]">โดส ช/ก/ย</th>
                <th className="px-2 py-3 text-center w-[10%]">จำนวน</th>
                <th className="px-2 py-3 text-right w-[12%]">ส่วนลด</th>
                <th className="px-4 py-3 text-right w-[16%]">ยอดสุทธิ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-5">
              {summary.itemDetails.map((i) => (
                <tr key={i.id} className="hover:bg-surface/50">
                  <td className="px-4 py-3">
                    <div className="font-thai text-[13px] font-semibold text-ink">{i.name}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-ink-40">{i.cat}</div>
                    {i.rmk && (
                      <div className="mt-1 font-thai text-[11px] italic text-ink-60">📝 {i.rmk}</div>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex justify-center gap-1">
                      {(["dM", "dN", "dE"] as const).map((f) => (
                        <input key={f} type="text"
                          value={(i as any)[f]}
                          onChange={(e) => onUpdate(i.id, f, e.target.value)}
                          className="h-8 w-9 rounded-md border border-ink-10 bg-white text-center font-mono text-xs font-bold text-ink focus:border-rose focus:outline-none" />
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => onUpdate(i.id, "qty", Math.max(0, i.qty - 1))} className="text-ink-40 hover:text-rose">−</button>
                      <span className="font-mono text-sm font-bold text-ink w-5 text-center">{i.qty}</span>
                      <button onClick={() => onUpdate(i.id, "qty", i.qty + 1)} className="text-ink-40 hover:text-wellness">+</button>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-right font-mono text-xs text-status-optimal">
                    {i.discountVal > 0 ? `−฿${i.discountVal.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold text-ink">
                    ฿{i.lineTotal.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Big total */}
      <div className="rounded-2xl bg-ink p-6 text-white">
        <div className="grid gap-4 sm:grid-cols-[1fr,auto,auto] items-end">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">Total investment</div>
            <div className="mt-2 font-head text-[40px] font-extrabold leading-none">฿{summary.net.toLocaleString()}</div>
          </div>
          <div className="h-12 w-px bg-white/10 hidden sm:block" />
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">PV</div>
              <div className="mt-1 font-mono text-[20px] font-bold">{Math.round(summary.pv).toLocaleString()}</div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">Cashback ({summary.rate}%)</div>
              <div className="mt-1 font-mono text-[20px] font-bold">฿{Math.round(summary.cb).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fees */}
      <div className="rounded-2xl border border-ink-10 bg-white p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 mb-3">ค่าธรรมเนียม / ส่วนลดเพิ่ม</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { id: "reg" as const,    label: "สมัครสมาชิกใหม่",  sign: "+", val: 900 },
            { id: "estart" as const, label: "e-Starter",         sign: "−", val: 300 },
            { id: "ajoy" as const,   label: "A-Joy",             sign: "−", val: 500 },
          ].map((f) => (
            <button key={f.id}
              onClick={() => setFees({ ...fees, [f.id]: !fees[f.id] })}
              className={`rounded-xl border-2 px-4 py-3 text-left transition-all
                ${fees[f.id] ? "border-rose bg-rose-ultra" : "border-ink-10 bg-white hover:border-ink-20"}`}>
              <div className="flex items-center justify-between">
                <span className="font-thai text-[13px] font-semibold text-ink">{f.label}</span>
                <span className={`text-lg ${fees[f.id] ? "text-rose" : "text-ink-20"}`}>{fees[f.id] ? "✓" : "○"}</span>
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-ink-60">{f.sign}฿{f.val}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Action */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="rose" size="lg" onClick={onOpenReport} disabled={items.length === 0}>
          📥 สร้างรายงาน (HD PNG)
        </Button>
        {!name && (
          <div className="font-thai text-[12px] text-status-warning">⚠️ ระบุชื่อก่อนสร้างรายงาน</div>
        )}
      </div>
    </div>
  );
}
