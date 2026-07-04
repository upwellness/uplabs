import React, { useEffect, useRef, useState } from "react";
import { clamp, fmt, STATUS } from "./logic.js";

export const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function StatusPill({ status, text }) {
  const s = STATUS[status];
  if (!s) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-semibold leading-5"
      style={{ color: s.fg, background: s.bg }}>
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="currentColor" /></svg>
      {text || s.label}
    </span>
  );
}

export function CountUp({ value, digits = 0, duration = 750 }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(0), firstRef = useRef(true);
  useEffect(() => {
    if (reduceMotion()) { setShown(value); return; }
    const from = firstRef.current ? 0 : fromRef.current;
    firstRef.current = false;
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = clamp((t - t0) / duration, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(from + (value - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{fmt(shown, digits)}</>;
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div>
      {label && <div className="mb-2 text-sm font-semibold text-ink2">{label}</div>}
      <div className={"grid gap-1 rounded-xl bg-surface2 p-1 " + (options.length > 2 ? "grid-cols-3" : "grid-cols-2")}
        role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={"rounded-lg px-3 py-2.5 text-[15px] font-semibold transition-colors " +
              (value === o.id ? "bg-surface text-ink shadow-card" : "text-ink2 hover:text-ink")}>
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SliderField({ label, unit, value, min, max, step = 1, onChange, hint }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-1 flex items-end justify-between gap-3">
        <label className="text-sm font-semibold text-ink2">
          {label}{hint ? <span className="ml-1.5 font-normal text-mut">{hint}</span> : null}
        </label>
        <div className="flex items-baseline gap-1.5">
          <input type="number" inputMode="decimal" value={value} min={min} max={max} step={step}
            onChange={(e) => { const v = e.target.value === "" ? min : Number(e.target.value); if (!Number.isNaN(v)) onChange(v); }}
            onBlur={(e) => onChange(clamp(Number(e.target.value) || min, min, max))}
            className="w-[76px] rounded-lg border border-line bg-surface px-2 py-1 text-right font-display text-xl font-semibold text-ink tabular-nums focus:border-accent"
            aria-label={label} />
          <span className="text-sm text-mut">{unit}</span>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={clamp(value, min, max)}
        style={{ "--fill": fill + "%" }} onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label + " (แถบเลื่อน)"} />
    </div>
  );
}

export function OptionCards({ label, options, value, onChange, cols = 1 }) {
  return (
    <div>
      {label && <div className="mb-2 text-sm font-semibold text-ink2">{label}</div>}
      <div className={"grid gap-2 " + (cols === 2 ? "sm:grid-cols-2" : "")} role="radiogroup" aria-label={label}>
        {options.map((o, i) => {
          const id = o.id ?? i;
          const active = value === id;
          return (
            <button key={id} type="button" role="radio" aria-checked={active} onClick={() => onChange(id)}
              className={"flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors " +
                (active ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-mut")}>
              <span>
                <span className={"block text-[15px] font-semibold " + (active ? "text-accent-strong" : "text-ink")}>{o.name}</span>
                {o.desc && <span className="block text-[13px] text-ink2">{o.desc}</span>}
              </span>
              <span aria-hidden="true"
                className={"grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 " + (active ? "border-accent bg-accent" : "border-line")}>
                {active && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5.2 4 7.6 8.5 2.6" stroke="var(--on-accent)" strokeWidth="2" strokeLinecap="round" /></svg>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, desc }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <span>
        <span className="block text-[15px] font-semibold text-ink">{label}</span>
        {desc && <span className="block text-[13px] text-ink2">{desc}</span>}
      </span>
      <span className="relative inline-block h-7 w-12 shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={label} />
        <span className="absolute inset-0 rounded-full bg-surface2 transition-colors peer-checked:bg-accent" />
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-surface shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Tile({ eyebrow, status, statusText, children, note, delay = 0, wide = false }) {
  return (
    <section className={"reveal print-block rounded-card bg-surface p-5 shadow-card " + (wide ? "sm:col-span-2" : "")}
      style={{ "--d": delay + "ms" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-mut">{eyebrow}</h3>
        {status ? <StatusPill status={status} text={statusText} /> : null}
      </div>
      {children}
      {note ? <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink2">{note}</p> : null}
    </section>
  );
}

export function BigValue({ children, unit, sub }) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-[34px] font-bold leading-none text-ink tabular-nums">{children}</span>
        {unit ? <span className="text-sm font-semibold text-ink2">{unit}</span> : null}
      </div>
      {sub ? <div className="mt-1 text-[13px] text-mut">{sub}</div> : null}
    </div>
  );
}

export function PrimaryButton({ children, onClick, className = "" }) {
  return (
    <button type="button" onClick={onClick}
      className={"rounded-xl px-6 py-3.5 font-display text-[17px] font-semibold shadow-card transition-transform hover:scale-[1.01] active:scale-[0.99] " + className}
      style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
      {children}
    </button>
  );
}

/* wrapper for every tool screen — sticky back bar + title */
export function ToolShell({ title, kicker, onBack, children, accentIcon }) {
  return (
    <div className="reveal" style={{ "--d": "0ms" }}>
      <button type="button" onClick={onBack}
        className="no-print mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[14px] font-semibold text-ink2 transition-colors hover:text-ink">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        เครื่องมือทั้งหมด
      </button>
      <div className="mb-5 flex items-start gap-3">
        {accentIcon && <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>{accentIcon}</div>}
        <div>
          {kicker && <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-accent">{kicker}</p>}
          <h2 className="font-display text-[24px] font-bold leading-tight text-ink sm:text-[28px]" style={{ textWrap: "balance" }}>{title}</h2>
        </div>
      </div>
      {children}
    </div>
  );
}

export function Disclaimer({ children }) {
  return (
    <p className="reveal mt-5 text-[12.5px] leading-relaxed text-mut" style={{ "--d": "760ms" }}>{children}</p>
  );
}

/* shared basic profile — entered once, reused across calculators */
export function ProfileFields({ profile, set, showHeightWeight = true }) {
  return (
    <div className="grid gap-5">
      <Segmented label="เพศ (ตามสรีระ)" value={profile.sex} onChange={(v) => set({ sex: v })}
        options={[{ id: "f", name: "หญิง" }, { id: "m", name: "ชาย" }]} />
      <SliderField label="อายุ" unit="ปี" value={profile.age} min={15} max={90} onChange={(v) => set({ age: v })} />
      {showHeightWeight && (
        <>
          <SliderField label="ส่วนสูง" unit="ซม." value={profile.height} min={130} max={210} onChange={(v) => set({ height: v })} />
          <SliderField label="น้ำหนัก" unit="กก." value={profile.weight} min={35} max={180} step={0.5} onChange={(v) => set({ weight: v })} />
        </>
      )}
    </div>
  );
}

export function bmiOf(p) { return p.weight / (p.height / 100) ** 2; }

export function Card({ children, className = "" }) {
  return <section className={"rounded-card bg-surface p-5 shadow-card sm:p-6 " + className}>{children}</section>;
}
