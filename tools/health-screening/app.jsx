import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmt = (n, digits = 0) =>
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* status roles — colors come from CSS tokens so both themes work */
const STATUS = {
  good: { label: "เกณฑ์ดี", fg: "var(--good)", bg: "var(--good-bg)" },
  warn: { label: "เฝ้าระวัง", fg: "var(--warn)", bg: "var(--warn-bg)" },
  risk: { label: "ควรใส่ใจ", fg: "var(--risk)", bg: "var(--risk-bg)" },
};

function StatusPill({ status, text }) {
  const s = STATUS[status];
  if (!s) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-semibold leading-5"
      style={{ color: s.fg, background: s.bg }}
    >
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
        <circle cx="4" cy="4" r="4" fill="currentColor" />
      </svg>
      {text || s.label}
    </span>
  );
}

/* count-up number that respects reduced motion */
function CountUp({ value, digits = 0, duration = 750 }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(0);
  const firstRef = useRef(true);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    const from = firstRef.current ? 0 : fromRef.current;
    firstRef.current = false;
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = clamp((t - t0) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (value - from) * eased;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{fmt(shown, digits)}</>;
}

/* ------------------------------------------------------------------ */
/* domain logic                                                        */
/* ------------------------------------------------------------------ */

const ACTIVITIES = [
  { f: 1.2, name: "แทบไม่ออกกำลังกาย", desc: "นั่งทำงานเป็นหลัก แทบไม่ได้ขยับ" },
  { f: 1.375, name: "ขยับบ้างเล็กน้อย", desc: "ออกกำลังเบา ๆ 1–3 วัน/สัปดาห์" },
  { f: 1.55, name: "ออกกำลังสม่ำเสมอ", desc: "3–5 วัน/สัปดาห์" },
  { f: 1.725, name: "ออกกำลังหนัก", desc: "เกือบทุกวัน 6–7 วัน/สัปดาห์" },
  { f: 1.9, name: "หนักมาก / นักกีฬา", desc: "ซ้อมวันละ 2 รอบ หรืองานใช้แรงกาย" },
];

const GOALS = [
  { id: "lose", name: "ลดไขมัน", desc: "ลดน้ำหนักแบบรักษากล้ามเนื้อ" },
  { id: "fit", name: "สุขภาพดี คงน้ำหนัก", desc: "กินให้พอดีกับที่ใช้" },
  { id: "gain", name: "เพิ่มกล้ามเนื้อ", desc: "สร้างกล้ามแบบไขมันไม่พุ่ง" },
];

function bmiInfo(bmi) {
  /* เกณฑ์ WHO Asia-Pacific สำหรับคนเอเชีย */
  if (bmi < 18.5)
    return { cat: "น้ำหนักน้อยกว่าเกณฑ์", status: "warn", advice: "เพิ่มพลังงานและโปรตีนให้พอ ร่วมกับเวทเทรนนิ่งเบา ๆ เพื่อสร้างมวลกล้ามเนื้อ" };
  if (bmi < 23)
    return { cat: "สมส่วน", status: "good", advice: "รักษาน้ำหนักช่วงนี้ไว้ — กินพอดี ขยับสม่ำเสมอ" };
  if (bmi < 25)
    return { cat: "น้ำหนักเกิน (ท้วม)", status: "warn", advice: "ลดเบา ๆ 0.25–0.5 กก./สัปดาห์ ก็เห็นผลชัดใน 2–3 เดือน" };
  if (bmi < 30)
    return { cat: "อ้วนระดับ 1", status: "risk", advice: "ลด 5–10% ของน้ำหนักตัว ช่วยลดความเสี่ยงเบาหวาน–ความดันได้มาก" };
  return { cat: "อ้วนระดับ 2", status: "risk", advice: "แนะนำปรึกษาแพทย์หรือนักกำหนดอาหาร เพื่อวางแผนลดน้ำหนักอย่างปลอดภัย" };
}

function whtrInfo(r, sex, waist) {
  const waistCut = sex === "m" ? 90 : 80;
  const over = waist >= waistCut;
  if (r < 0.5)
    return {
      cat: "สัดส่วนดี",
      status: over ? "warn" : "good",
      advice: over
        ? `รอบเอวเกิน ${waistCut} ซม. ซึ่งเป็นเกณฑ์อ้วนลงพุงของคนไทย ควรเริ่มคุมอาหาร`
        : "รอบเอวน้อยกว่าครึ่งหนึ่งของส่วนสูง — เกณฑ์ที่ดีของไขมันช่องท้อง",
    };
  if (r < 0.6)
    return { cat: "เริ่มเสี่ยงอ้วนลงพุง", status: "warn", advice: "ไขมันช่องท้องเริ่มสะสม — ลดของหวาน/แอลกอฮอล์ เพิ่มเดินเร็ววันละ 30 นาที" };
  return { cat: "เสี่ยงอ้วนลงพุงสูง", status: "risk", advice: "สัมพันธ์กับเบาหวาน ไขมันพอกตับ ความดัน — ควรตรวจสุขภาพประจำปีและปรับพฤติกรรมจริงจัง" };
}

function bodyFatInfo(bf, sex) {
  const [lo, hi] = sex === "m" ? [10, 20] : [18, 28];
  if (bf < lo) return { status: "warn", note: `ต่ำกว่าช่วงอ้างอิงทั่วไป (${lo}–${hi}%)` };
  if (bf <= hi) return { status: "good", note: `อยู่ในช่วงอ้างอิงทั่วไป (${lo}–${hi}%)` };
  return { status: bf > hi + 7 ? "risk" : "warn", note: `สูงกว่าช่วงอ้างอิงทั่วไป (${lo}–${hi}%)` };
}

function calc({ sex, age, height, weight, waist, act, goal }) {
  const h2 = (height / 100) ** 2;
  const bmi = weight / h2;
  const bmr =
    sex === "m"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;
  const tdee = bmr * ACTIVITIES[act].f;

  const floor = sex === "m" ? 1500 : 1200;
  const kcalLose = Math.max(tdee - 500, floor);
  const kcalGain = tdee + 300;

  let protein;
  if (goal === "lose") protein = [1.6, 2.0];
  else if (goal === "gain") protein = [1.6, 2.2];
  else protein = act <= 1 ? [1.0, 1.2] : [1.2, 1.6];
  const pLo = protein[0] * weight;
  const pHi = protein[1] * weight;

  const water = weight * 33;
  const bodyFat =
    1.2 * bmi + 0.23 * age - 10.8 * (sex === "m" ? 1 : 0) - 5.4;
  const idealLo = 18.5 * h2;
  const idealHi = 22.9 * h2;
  const hrMax = 208 - 0.7 * age;
  const zone2 = [hrMax * 0.6, hrMax * 0.7];
  const whtr = waist ? waist / height : null;

  return {
    bmi, bmr, tdee, kcalLose, kcalGain, protein, pLo, pHi,
    water, bodyFat, idealLo, idealHi, hrMax, zone2, whtr,
  };
}

/* ------------------------------------------------------------------ */
/* input controls                                                      */
/* ------------------------------------------------------------------ */

function Segmented({ options, value, onChange, label }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-ink2">{label}</div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface2 p-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={
              "rounded-lg px-3 py-2.5 text-[15px] font-semibold transition-colors " +
              (value === o.id
                ? "bg-surface text-ink shadow-card"
                : "text-ink2 hover:text-ink")
            }
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function SliderField({ label, unit, value, min, max, step = 1, onChange, hint }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-1 flex items-end justify-between gap-3">
        <label className="text-sm font-semibold text-ink2">
          {label}
          {hint ? <span className="ml-1.5 font-normal text-mut">{hint}</span> : null}
        </label>
        <div className="flex items-baseline gap-1.5">
          <input
            type="number"
            inputMode="decimal"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = e.target.value === "" ? min : Number(e.target.value);
              if (!Number.isNaN(v)) onChange(v);
            }}
            onBlur={(e) => onChange(clamp(Number(e.target.value) || min, min, max))}
            className="w-[76px] rounded-lg border border-line bg-surface px-2 py-1 text-right font-display text-xl font-semibold text-ink tabular-nums focus:border-accent"
            aria-label={label}
          />
          <span className="text-sm text-mut">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamp(value, min, max)}
        style={{ "--fill": fill + "%" }}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label + " (แถบเลื่อน)"}
      />
    </div>
  );
}

function OptionCards({ label, options, value, onChange }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-ink2">{label}</div>
      <div className="grid gap-2" role="radiogroup" aria-label={label}>
        {options.map((o, i) => {
          const active = value === (o.id ?? i);
          return (
            <button
              key={o.id ?? i}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.id ?? i)}
              className={
                "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors " +
                (active
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface hover:border-mut")
              }
            >
              <span>
                <span className={"block text-[15px] font-semibold " + (active ? "text-accent-strong" : "text-ink")}>
                  {o.name}
                </span>
                <span className="block text-[13px] text-ink2">{o.desc}</span>
              </span>
              <span
                aria-hidden="true"
                className={
                  "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 " +
                  (active ? "border-accent bg-accent" : "border-line")
                }
              >
                {active && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5.2 4 7.6 8.5 2.6" stroke="var(--on-accent)" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* viz pieces                                                          */
/* ------------------------------------------------------------------ */

function BmiGauge({ bmi }) {
  const W = 300, H = 172, cx = 150, cy = 150, R = 116, SW = 16;
  const DOM = [15, 35];
  const toAngle = (v) => 180 - (clamp(v, DOM[0], DOM[1]) - DOM[0]) / (DOM[1] - DOM[0]) * 180;
  const pt = (a, r = R) => [cx + r * Math.cos((a * Math.PI) / 180), cy - r * Math.sin((a * Math.PI) / 180)];
  const arc = (v0, v1) => {
    const GAP = 1.6; /* deg — แทน 2px spacer ระหว่างแถบ */
    const a0 = toAngle(v0) - GAP, a1 = toAngle(v1) + GAP;
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const bands = [
    { v: [15, 18.5], c: "var(--warn-bg)" },
    { v: [18.5, 23], c: "var(--good-bg)" },
    { v: [23, 25], c: "var(--warn-bg)" },
    { v: [25, 35], c: "var(--risk-bg)" },
  ];
  const info = bmiInfo(bmi);
  const [mx, my] = pt(toAngle(bmi));
  const ticks = [18.5, 23, 25];
  return (
    <div className="mx-auto w-full max-w-[320px]">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`BMI ${fmt(bmi, 1)} — ${info.cat}`} className="w-full">
        {bands.map((b, i) => (
          <path key={i} d={arc(b.v[0], b.v[1])} stroke={b.c} strokeWidth={SW} strokeLinecap="round" fill="none" />
        ))}
        {ticks.map((t) => {
          const [tx, ty] = pt(toAngle(t), R + SW / 2 + 12);
          return (
            <text key={t} x={tx} y={ty} textAnchor="middle" fontSize="11"
              fill="var(--mut)" fontFamily="Anuphan, sans-serif">{t}</text>
          );
        })}
        <circle cx={mx} cy={my} r="9" fill="var(--ink)" stroke="var(--surface)" strokeWidth="3.5" />
        <text x={cx} y={cy - 34} textAnchor="middle" fontFamily="Prompt, sans-serif" fontWeight="700"
          fontSize="46" fill="var(--ink)">{fmt(bmi, 1)}</text>
        <text x={cx} y={cy - 12} textAnchor="middle" fontSize="13" fill="var(--ink2)"
          fontFamily="Anuphan, sans-serif">BMI (เกณฑ์คนเอเชีย)</text>
      </svg>
    </div>
  );
}

function WhtrBar({ value }) {
  /* domain 0.35–0.70 */
  const DOM = [0.35, 0.7];
  const pos = ((clamp(value, DOM[0], DOM[1]) - DOM[0]) / (DOM[1] - DOM[0])) * 100;
  const seg = (v0, v1) => ({
    left: ((v0 - DOM[0]) / (DOM[1] - DOM[0])) * 100 + "%",
    width: ((v1 - v0) / (DOM[1] - DOM[0])) * 100 + "%",
  });
  return (
    <div className="mt-3">
      <div className="relative h-3 w-full">
        <div className="absolute inset-y-0 rounded-full" style={{ ...seg(0.35, 0.5), background: "var(--good-bg)", marginRight: 2 }} />
        <div className="absolute inset-y-0" style={{ ...seg(0.502, 0.6), background: "var(--warn-bg)" }} />
        <div className="absolute inset-y-0 rounded-r-full" style={{ ...seg(0.602, 0.7), background: "var(--risk-bg)" }} />
        <div className="absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full"
          style={{ left: `calc(${pos}% - 1.5px)`, background: "var(--ink)" }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-mut tabular-nums">
        <span>0.35</span><span>0.50</span><span>0.60</span><span>0.70</span>
      </div>
    </div>
  );
}

function HrZones({ hrMax }) {
  const zones = [
    { z: "Z1", pct: [50, 60], name: "วอร์มอัพ" },
    { z: "Z2", pct: [60, 70], name: "เผาผลาญไขมัน" },
    { z: "Z3", pct: [70, 80], name: "แอโรบิก" },
    { z: "Z4", pct: [80, 90], name: "หนัก" },
    { z: "Z5", pct: [90, 100], name: "สูงสุด" },
  ];
  return (
    <div className="mt-3 grid gap-1">
      {zones.map((zn, i) => {
        const lo = Math.round((hrMax * zn.pct[0]) / 100);
        const hi = Math.round((hrMax * zn.pct[1]) / 100);
        const hot = i === 1; /* Zone 2 คือพระเอกของสายสุขภาพ */
        return (
          <div key={zn.z}
            className={"flex items-center justify-between rounded-lg px-3 py-1.5 text-[13px] " + (hot ? "font-semibold" : "")}
            style={{
              background: hot ? "var(--accent-soft)" : "var(--surface2)",
              color: hot ? "var(--accent-strong)" : "var(--ink2)",
            }}>
            <span className="flex items-center gap-2">
              <span className="font-display text-xs font-semibold tabular-nums">{zn.z}</span>
              {zn.name}
            </span>
            <span className="tabular-nums">{lo}–{hi} ครั้ง/นาที</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* result tiles                                                        */
/* ------------------------------------------------------------------ */

function Tile({ eyebrow, status, statusText, children, note, delay = 0, wide = false }) {
  return (
    <section
      className={"reveal print-block rounded-card bg-surface p-5 shadow-card " + (wide ? "sm:col-span-2" : "")}
      style={{ "--d": delay + "ms" }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-mut">{eyebrow}</h3>
        {status ? <StatusPill status={status} text={statusText} /> : null}
      </div>
      {children}
      {note ? <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink2">{note}</p> : null}
    </section>
  );
}

function BigValue({ children, unit, sub }) {
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

/* ------------------------------------------------------------------ */
/* app                                                                 */
/* ------------------------------------------------------------------ */

function App() {
  const [sex, setSex] = useState("f");
  const [age, setAge] = useState(35);
  const [height, setHeight] = useState(162);
  const [weight, setWeight] = useState(60);
  const [waistOn, setWaistOn] = useState(false);
  const [waist, setWaist] = useState(80);
  const [act, setAct] = useState(1);
  const [goal, setGoal] = useState("fit");
  const [shown, setShown] = useState(false);
  const [runId, setRunId] = useState(0);
  const resultRef = useRef(null);

  const r = useMemo(
    () => calc({ sex, age, height, weight, waist: waistOn ? waist : null, act, goal }),
    [sex, age, height, weight, waist, waistOn, act, goal]
  );
  const bmiI = bmiInfo(r.bmi);
  const whtrI = r.whtr ? whtrInfo(r.whtr, sex, waist) : null;
  const bfI = bodyFatInfo(r.bodyFat, sex);
  const goalKcal = goal === "lose" ? r.kcalLose : goal === "gain" ? r.kcalGain : r.tdee;

  const show = () => {
    setShown(true);
    setRunId((n) => n + 1);
    requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" })
    );
  };

  const toggleTheme = () => {
    const el = document.documentElement;
    const dark =
      el.dataset.theme === "dark" ||
      (!el.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    el.dataset.theme = dark ? "light" : "dark";
  };

  const D = (i) => i * 70; /* stagger */

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-16 pt-6 sm:px-6">
      {/* ---------- header ---------- */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">
            Upwellness · Health Lab
          </p>
          <h1 className="mt-1 font-display text-[30px] font-bold leading-tight text-ink sm:text-[36px]" style={{ textWrap: "balance" }}>
            <span className="whitespace-nowrap">เช็กสุขภาพเบื้องต้น</span>
            {"​"}
            <span className="whitespace-nowrap">ใน 60 วินาที</span>
          </h1>
          <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-ink2">
            กรอกข้อมูล 6 อย่าง แล้วรับรายงานส่วนตัว — BMI แบบเกณฑ์คนเอเชีย, พลังงานที่ร่างกายใช้จริง,
            โปรตีน น้ำ และโซนหัวใจที่เหมาะกับคุณ
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="no-print mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink2 shadow-card transition-colors hover:text-ink"
          aria-label="สลับโหมดสว่าง/มืด"
          title="สลับโหมดสว่าง/มืด"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
          </svg>
        </button>
      </header>

      {/* ---------- pulse divider ---------- */}
      <div className="mb-6 overflow-hidden" aria-hidden="true">
        <svg viewBox="0 0 640 40" className="w-full" preserveAspectRatio="none" style={{ height: 34 }}>
          <path
            className="pulse-line"
            d="M0 20 H210 L228 20 238 6 250 34 260 14 268 20 H340 L356 20 366 9 377 31 386 17 393 20 H640"
            fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9"
          />
        </svg>
      </div>

      {/* ---------- input card ---------- */}
      <main>
        <section className="no-print rounded-card bg-surface p-5 shadow-card sm:p-7" aria-label="กรอกข้อมูลของคุณ">
          <h2 className="mb-5 font-display text-lg font-semibold text-ink">ข้อมูลของคุณ</h2>
          <div className="grid gap-5">
            <Segmented
              label="เพศ (ตามสรีระ)"
              value={sex}
              onChange={setSex}
              options={[
                { id: "f", name: "หญิง" },
                { id: "m", name: "ชาย" },
              ]}
            />
            <SliderField label="อายุ" unit="ปี" value={age} min={15} max={90} onChange={setAge} />
            <SliderField label="ส่วนสูง" unit="ซม." value={height} min={130} max={210} onChange={setHeight} />
            <SliderField label="น้ำหนัก" unit="กก." value={weight} min={35} max={180} step={0.5} onChange={setWeight} />

            <div className="rounded-xl border border-line p-4">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold text-ink2">วัดรอบเอวมาด้วย (แนะนำ)</span>
                  <span className="block text-[13px] text-mut">วัดผ่านสะดือขณะหายใจออก — บอกความเสี่ยง “อ้วนลงพุง” ได้ดีกว่า BMI</span>
                </span>
                <span className="relative inline-block h-7 w-12 shrink-0">
                  <input
                    type="checkbox"
                    checked={waistOn}
                    onChange={(e) => setWaistOn(e.target.checked)}
                    className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="เพิ่มข้อมูลรอบเอว"
                  />
                  <span className="absolute inset-0 rounded-full bg-surface2 transition-colors peer-checked:bg-accent" />
                  <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-surface shadow transition-transform peer-checked:translate-x-5" />
                </span>
              </label>
              {waistOn && (
                <div className="mt-4">
                  <SliderField label="รอบเอว" unit="ซม." value={waist} min={50} max={150} onChange={setWaist} />
                </div>
              )}
            </div>

            <OptionCards label="กิจกรรมในแต่ละสัปดาห์" options={ACTIVITIES} value={act} onChange={setAct} />
            <OptionCards label="เป้าหมายของคุณ" options={GOALS} value={goal} onChange={setGoal} />

            <button
              type="button"
              onClick={show}
              className="mt-1 rounded-xl bg-accent px-6 py-3.5 font-display text-[17px] font-semibold text-on-accent shadow-card transition-transform hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: "var(--accent)", color: "var(--on-accent)" }}
            >
              {shown ? "อัปเดตผลของฉัน" : "ดูผลของฉัน"}
            </button>
          </div>
        </section>

        {/* ---------- results ---------- */}
        {shown && (
          <div ref={resultRef} key={runId} className="mt-8 scroll-mt-4">
            <div className="reveal mb-4 flex items-end justify-between gap-3" style={{ "--d": "0ms" }}>
              <h2 className="font-display text-[22px] font-bold text-ink">ผลเช็กอัปของคุณ</h2>
              <button
                type="button"
                onClick={() => window.print()}
                className="no-print rounded-lg border border-line bg-surface px-3.5 py-2 text-[13.5px] font-semibold text-ink2 transition-colors hover:text-ink"
              >
                พิมพ์ / บันทึกเป็น PDF
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* BMI hero */}
              <Tile eyebrow="ดัชนีมวลกาย" status={bmiI.status} statusText={bmiI.cat} note={bmiI.advice} delay={D(0)} wide>
                <BmiGauge bmi={r.bmi} />
                <p className="mt-1 text-center text-[13px] text-mut">
                  น้ำหนักที่เหมาะกับส่วนสูงของคุณ: <span className="font-semibold text-ink2 tabular-nums">{fmt(r.idealLo, 0)}–{fmt(r.idealHi, 0)} กก.</span>
                </p>
              </Tile>

              {/* WHtR */}
              {whtrI && (
                <Tile eyebrow="รอบเอว ÷ ส่วนสูง" status={whtrI.status} statusText={whtrI.cat} note={whtrI.advice} delay={D(1)} wide>
                  <BigValue unit="" sub="เป้าหมาย: น้อยกว่า 0.50 — “รอบเอวไม่เกินครึ่งหนึ่งของส่วนสูง”">
                    <CountUp value={r.whtr} digits={2} />
                  </BigValue>
                  <WhtrBar value={r.whtr} />
                </Tile>
              )}

              {/* BMR */}
              <Tile eyebrow="BMR · พลังงานขั้นต่ำ" note="พลังงานที่ร่างกายใช้ตอนพักเฉย ๆ ทั้งวัน (สูตร Mifflin–St Jeor) — ไม่ควรกินต่ำกว่านี้ติดต่อกันนาน ๆ" delay={D(2)}>
                <BigValue unit="กิโลแคลอรี่/วัน">
                  <CountUp value={r.bmr} />
                </BigValue>
              </Tile>

              {/* TDEE */}
              <Tile eyebrow="TDEE · ที่ใช้จริงต่อวัน" note="รวมกิจกรรมที่คุณเลือกแล้ว — กินเท่านี้ น้ำหนักจะคงที่" delay={D(3)}>
                <BigValue unit="กิโลแคลอรี่/วัน">
                  <CountUp value={r.tdee} />
                </BigValue>
              </Tile>

              {/* kcal target */}
              <Tile eyebrow="เป้าพลังงานตามเป้าหมาย" delay={D(4)} wide
                note={
                  goal === "lose"
                    ? "ลดจาก TDEE ราว 500 กิโลแคลอรี่/วัน ≈ ลดไขมัน 0.5 กก./สัปดาห์ แบบไม่โหดเกินไป"
                    : goal === "gain"
                      ? "เกินจาก TDEE ราว 300 กิโลแคลอรี่/วัน พอให้สร้างกล้ามโดยไขมันไม่พุ่ง — ต้องเวทเทรนนิ่งควบคู่"
                      : "กินใกล้เคียง TDEE แล้วโฟกัสคุณภาพอาหาร: โปรตีนพอ ผักครึ่งจาน ลดหวาน–มัน–เค็ม"
                }>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "lose", name: "ลดไขมัน", v: r.kcalLose },
                    { id: "fit", name: "คงน้ำหนัก", v: r.tdee },
                    { id: "gain", name: "เพิ่มกล้าม", v: r.kcalGain },
                  ].map((o) => {
                    const hot = o.id === goal;
                    return (
                      <div key={o.id}
                        className="rounded-xl px-3 py-3 text-center"
                        style={{
                          background: hot ? "var(--accent-soft)" : "var(--surface2)",
                          outline: hot ? "2px solid var(--accent)" : "none",
                        }}>
                        <div className="text-[12.5px] font-semibold" style={{ color: hot ? "var(--accent-strong)" : "var(--ink2)" }}>
                          {o.name}{hot ? " ✓" : ""}
                        </div>
                        <div className="mt-0.5 font-display text-[22px] font-bold text-ink tabular-nums">
                          {hot ? <CountUp value={o.v} /> : fmt(o.v)}
                        </div>
                        <div className="text-[11.5px] text-mut">กิโลแคลอรี่/วัน</div>
                      </div>
                    );
                  })}
                </div>
              </Tile>

              {/* protein */}
              <Tile eyebrow="โปรตีนต่อวัน" delay={D(5)}
                note={`คิดที่ ${r.protein[0]}–${r.protein[1]} กรัม/กก. ตามเป้าหมายของคุณ ≈ อกไก่ ${fmt(r.pLo / 23 * 100 / 100, 1)}–${fmt(r.pHi / 23 * 100 / 100, 1)} ขีด หรือไข่ ${fmt(r.pLo / 7, 0)}–${fmt(r.pHi / 7, 0)} ฟอง (เลือกรวมหลายแหล่งได้)`}>
                <BigValue unit="กรัม">
                  <CountUp value={r.pLo} />–{fmt(r.pHi)}
                </BigValue>
              </Tile>

              {/* water */}
              <Tile eyebrow="น้ำดื่มต่อวัน" delay={D(6)}
                note={`≈ แก้วละ 250 มล. จำนวน ${fmt(r.water / 250, 0)} แก้ว — เพิ่มอีกเมื่อออกกำลังหรืออากาศร้อน`}>
                <BigValue unit="ลิตร">
                  <CountUp value={r.water / 1000} digits={1} />
                </BigValue>
              </Tile>

              {/* body fat */}
              <Tile eyebrow="ไขมันร่างกาย (ประมาณ)" status={bfI.status} delay={D(7)}
                note={`${bfI.note} — คำนวณจาก BMI+อายุ (สูตร Deurenberg) เป็นค่าคร่าว ๆ วัดจริงด้วยเครื่อง InBody/DEXA จะแม่นกว่า`}>
                <BigValue unit="%">
                  <CountUp value={r.bodyFat} digits={1} />
                </BigValue>
              </Tile>

              {/* heart */}
              <Tile eyebrow="โซนหัวใจของคุณ" delay={D(8)}
                note={`หัวใจสูงสุดโดยประมาณ ${fmt(r.hrMax)} ครั้ง/นาที (สูตร Tanaka) — เดินเร็ว/วิ่งเบาให้หัวใจอยู่ Zone 2 คือช่วงเผาผลาญไขมันที่ยั่งยืนที่สุด`}>
                <BigValue unit="ครั้ง/นาที" sub="Zone 2 · เผาผลาญไขมัน">
                  <CountUp value={r.zone2[0]} />–{fmt(r.zone2[1])}
                </BigValue>
                <HrZones hrMax={r.hrMax} />
              </Tile>

              {/* daily habits */}
              <Tile eyebrow="ตัวเลขที่คนสุขภาพดีจำขึ้นใจ" delay={D(9)} wide>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {[
                    ["น้ำตาลไม่เกิน 6 ช้อนชา/วัน", "≈ 24 กรัม — ชานมไข่มุก 1 แก้วก็เกินแล้ว"],
                    ["โซเดียมไม่เกิน 2,000 มก./วัน", "≈ น้ำปลา 4 ช้อนชา — ระวังน้ำซุป น้ำจิ้ม ของหมักดอง"],
                    ["นอน 7–9 ชั่วโมง", "อดนอนทำให้หิวเก่งขึ้นและเผาผลาญแย่ลง"],
                    ["เดินให้ถึง 8,000 ก้าว/วัน", "ลดความเสี่ยงโรคหัวใจได้ชัดเจนโดยไม่ต้องเข้ายิม"],
                  ].map(([t, d]) => (
                    <li key={t} className="rounded-xl bg-surface2 px-4 py-3">
                      <div className="text-[14.5px] font-semibold text-ink">{t}</div>
                      <div className="text-[13px] text-ink2">{d}</div>
                    </li>
                  ))}
                </ul>
              </Tile>
            </div>

            {/* disclaimer */}
            <p className="reveal mt-5 text-[12.5px] leading-relaxed text-mut" style={{ "--d": D(10) + "ms" }}>
              เครื่องมือนี้ให้ความรู้เบื้องต้นเท่านั้น ไม่ใช่การวินิจฉัยทางการแพทย์ — ค่า BMI ใช้เกณฑ์ WHO เอเชีย-แปซิฟิก,
              พลังงานคำนวณด้วยสูตร Mifflin–St Jeor, อัตราหัวใจสูงสุดด้วยสูตร Tanaka
              หากตั้งครรภ์ มีโรคประจำตัว หรืออายุต่ำกว่า 18 ปี ควรปรึกษาแพทย์หรือนักกำหนดอาหารก่อนปรับการกิน
            </p>
          </div>
        )}
      </main>

      <footer className="mt-10 border-t border-line pt-5 text-center text-[12.5px] text-mut">
        จัดทำโดย Upwellness — แจกฟรีในงานสัมมนา ส่งต่อไฟล์นี้ให้คนที่คุณรักได้เลย
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
