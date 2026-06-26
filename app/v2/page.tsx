"use client";

/**
 * UPLabs v2 — DESIGN PREVIEW · clickable journey prototype (mock data only)
 * ───────────────────────────────────────────────────────────────────────
 * Track 2 "clinical-warm" reset. NO real data / logic — walk-through only.
 * Journey: หน้าแรก → ลูกค้า → โปรไฟล์ 360 → นำเข้า Wearable → Report (แบบพี่ปุ๊)
 *          + Check Form (พร้อมผลวิเคราะห์)
 * Principles: no glass/aurora · Lucide icons · friendly sentence-case labels ·
 *   one status system · airy spacing · rose primary / wellness = positive.
 * Public route (middleware allowlist) so it can be shared for feedback.
 */

import { useState } from "react";
import {
  Users, ClipboardList, Scale, Droplet, Activity, Apple, Leaf, Wand2,
  Phone, MessageCircle, PlusCircle, Network, Bell, CalendarDays, ChevronRight,
  ChevronLeft, Heart, FlaskConical, TrendingUp, TrendingDown, Moon, Sparkles,
  ArrowRight, Stethoscope, Search, Upload, Watch, FileText, Printer, Wind,
  HeartPulse, Bed, CheckCircle2, AlertTriangle, Pill, Plus, Home as HomeIcon,
} from "lucide-react";

type Go = (s: string, ctx?: any) => void;

/* ── single status system ── */
const STATUS: Record<string, { dot: string; text: string; bg: string; label: string; hex: string }> = {
  optimal: { dot: "bg-status-optimal", text: "text-status-optimal", bg: "bg-status-bg-optimal", label: "ดีเยี่ยม", hex: "#16A34A" },
  good:    { dot: "bg-status-good",    text: "text-[#4d7c0f]",      bg: "bg-status-bg-good",    label: "ดี",       hex: "#65A30D" },
  caution: { dot: "bg-status-caution", text: "text-[#a16207]",      bg: "bg-status-bg-caution", label: "เริ่มต้องดู", hex: "#CA8A04" },
  warning: { dot: "bg-status-warning", text: "text-[#c2410c]",      bg: "bg-status-bg-warning", label: "ต้องดูแล",  hex: "#EA580C" },
  danger:  { dot: "bg-status-danger",  text: "text-status-danger",  bg: "bg-status-bg-danger",  label: "เร่งด่วน",  hex: "#DC2626" },
};
const CARD = "rounded-2xl border border-ink-10 bg-white shadow-[0_1px_2px_rgba(24,21,26,0.04),0_12px_32px_-20px_rgba(24,21,26,0.22)]";
const TONE: Record<string, string> = {
  rose: "bg-rose-ultra text-rose", wellness: "bg-wellness-ultra text-wellness",
  science: "bg-science-ultra text-science", amber: "bg-amber-ultra text-amber", ink: "bg-ink-5 text-ink-60",
};

/* ── tiny blocks ── */
function IconChip({ icon: Icon, tone = "rose" }: { icon: any; tone?: string }) {
  return <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${TONE[tone]}`}><Icon size={20} strokeWidth={2} /></span>;
}
function StatusPill({ s }: { s: string }) {
  const c = STATUS[s] ?? STATUS.good;
  return <span className={`inline-flex items-center gap-1.5 rounded-full ${c.bg} px-2.5 py-1 text-[12px] font-semibold ${c.text}`}><span className={`h-2 w-2 rounded-full ${c.dot}`} /> {c.label}</span>;
}
function SectionHead({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>{eyebrow && <div className="font-thai text-[12.5px] text-ink-40">{eyebrow}</div>}<h2 className="font-head text-[19px] font-bold tracking-tight text-ink">{title}</h2></div>
      {action && <button onClick={onAction} className="inline-flex items-center gap-1 font-thai text-[13px] font-semibold text-rose transition-all hover:gap-1.5">{action} <ChevronRight size={15} /></button>}
    </div>
  );
}
function Back({ label, onClick }: { label: string; onClick: () => void }) {
  return <button onClick={onClick} className="mb-4 inline-flex items-center gap-1 font-thai text-[13px] font-semibold text-ink-40 transition-colors hover:text-rose"><ChevronLeft size={16} /> {label}</button>;
}
function Gauge({ v, max = 100, color, label, sub, unit = "" }: { v: number; max?: number; color: string; label: string; sub?: string; unit?: string }) {
  const r = 52, circ = 2 * Math.PI * r, frac = Math.min(1, v / max);
  return (
    <div className={`${CARD} flex flex-col items-center p-4`}>
      <div className="relative flex h-24 w-24 items-center justify-center">
        <svg viewBox="0 0 120 120" className="h-24 w-24 -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#EDE8DE" strokeWidth="11" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${circ * frac} ${circ}`} />
        </svg>
        <div className="absolute text-center"><div className="font-head text-[24px] font-extrabold leading-none text-ink">{v}<span className="text-[12px] font-bold text-ink-40">{unit}</span></div></div>
      </div>
      <div className="mt-2 font-head text-[14px] font-bold text-ink">{label}</div>
      {sub && <div className="mt-0.5 text-center font-thai text-[11.5px] text-ink-40">{sub}</div>}
    </div>
  );
}
function Sparkline({ data, color, h = 56 }: { data: number[]; color: string; h?: number }) {
  const w = 320, min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d - min) / span) * (h - 8) - 4}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: h }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ════════ HOME ════════ */
function HomeMock({ go }: { go: Go }) {
  const apps = [
    { icon: Users, tone: "rose", name: "ลูกค้า", desc: "โปรไฟล์ · ผลตรวจ · ติดตาม", to: "customers" },
    { icon: ClipboardList, tone: "science", name: "Check Form", desc: "ประเมิน prospect + AI", to: "checkform" },
    { icon: Activity, tone: "science", name: "UP Pulse", desc: "Whoop · Apple · Fit", to: "import" },
    { icon: Scale, tone: "wellness", name: "องค์ประกอบร่างกาย", desc: "น้ำหนัก · ไขมัน · กล้ามเนื้อ", to: "customers" },
    { icon: Droplet, tone: "amber", name: "น้ำตาลต่อเนื่อง", desc: "CGM analyzer", to: "customers" },
    { icon: Apple, tone: "wellness", name: "NutriScan", desc: "วิเคราะห์อาหาร", to: "home" },
    { icon: Leaf, tone: "wellness", name: "Plate Planner", desc: "ออกแบบจานอาหาร", to: "home" },
    { icon: Wand2, tone: "rose", name: "Program Designer", desc: "ออกแบบโปรแกรม", to: "home" },
  ];
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-thai text-[14px] text-ink-40">สวัสดีตอนสาย ☀️</div>
          <h1 className="mt-1 font-head text-[30px] font-extrabold tracking-tight text-ink">ต้น</h1>
          <p className="mt-1 font-thai text-[14px] text-ink-60">วันนี้มีลูกค้า <b className="text-rose">3 คน</b> ที่ควรติดตาม</p>
        </div>
        <button onClick={() => go("customers")} className="inline-flex items-center gap-2 rounded-full bg-rose px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-rose-deep">
          เริ่มดู journey ตัวอย่าง <ArrowRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[{ icon: Users, tone: "rose", n: "24", l: "ลูกค้าทั้งหมด" }, { icon: Bell, tone: "amber", n: "3", l: "รอติดตาม" }, { icon: CalendarDays, tone: "science", n: "2", l: "นัดวันนี้" }].map((s) => (
          <div key={s.l} className={`${CARD} p-5`}><IconChip icon={s.icon} tone={s.tone} /><div className="mt-3 font-head text-[28px] font-extrabold leading-none text-ink">{s.n}</div><div className="mt-1 font-thai text-[13px] text-ink-60">{s.l}</div></div>
        ))}
      </div>
      <div>
        <SectionHead eyebrow="เครื่องมือของคุณ" title="เริ่มทำงาน" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {apps.map((a) => (
            <button key={a.name} onClick={() => go(a.to)} className={`${CARD} group p-5 text-left transition-all hover:-translate-y-0.5 hover:border-ink-20`}>
              <IconChip icon={a.icon} tone={a.tone} /><div className="mt-3 font-head text-[15px] font-bold text-ink">{a.name}</div><div className="mt-0.5 font-thai text-[12.5px] leading-snug text-ink-40">{a.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <SectionHead eyebrow="อัปเดตล่าสุด" title="ลูกค้าที่ควรดู" action="ดูทั้งหมด" onAction={() => go("customers")} />
        <div className={`${CARD} divide-y divide-ink-5 overflow-hidden`}>
          {[{ initial: "ป", name: "พี่ปุ๊", note: "ผล Whoop ใหม่ 62 วัน", s: "good" }, { initial: "อ", name: "นส. ตัวอย่าง", note: "LDL เริ่มสูง · ควรติดตาม", s: "caution" }, { initial: "ส", name: "พี่สุ", note: "เริ่ม Metformin · ตรวจ B12", s: "warning" }].map((r) => (
            <button key={r.name} onClick={() => go("customer")} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-ultra font-head text-[16px] font-bold text-rose">{r.initial}</span>
              <div className="min-w-0 flex-1"><div className="font-head text-[15px] font-bold text-ink">{r.name}</div><div className="font-thai text-[12.5px] text-ink-40">{r.note}</div></div>
              <StatusPill s={r.s} /><ChevronRight size={18} className="text-ink-20" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════ CUSTOMERS LIST ════════ */
function CustomersMock({ go }: { go: Go }) {
  const list = [
    { initial: "ป", name: "พี่ปุ๊", meta: "หญิง · 52 ปี", tags: ["Whoop", "Lipid"], s: "good", last: "2 วันก่อน" },
    { initial: "อ", name: "นส. ตัวอย่าง", meta: "หญิง · 34 ปี", tags: ["Labs"], s: "caution", last: "1 สัปดาห์ก่อน" },
    { initial: "ส", name: "พี่สุ", meta: "หญิง · 58 ปี", tags: ["เบาหวาน", "Metformin"], s: "warning", last: "3 วันก่อน" },
    { initial: "ต", name: "พี่ตูน", meta: "ชาย · 49 ปี", tags: ["BCA"], s: "good", last: "วันนี้" },
    { initial: "จ", name: "จิ้น", meta: "หญิง · 45 ปี", tags: ["Whoop", "CGM"], s: "optimal", last: "เมื่อวาน" },
  ];
  return (
    <div className="space-y-5">
      <Back label="หน้าแรก" onClick={() => go("home")} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="font-thai text-[12.5px] text-ink-40">24 คน</div><h1 className="font-head text-[26px] font-extrabold tracking-tight text-ink">ลูกค้า</h1></div>
        <button className="inline-flex items-center gap-2 rounded-full bg-rose px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-rose-deep transition-colors"><Plus size={16} /> เพิ่มลูกค้า</button>
      </div>
      <div className={`${CARD} flex items-center gap-2 px-4 py-2.5`}>
        <Search size={17} className="text-ink-40" /><span className="font-thai text-[13.5px] text-ink-40">ค้นหาชื่อลูกค้า…</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {list.map((c) => (
          <button key={c.name} onClick={() => go("customer")} className={`${CARD} group flex items-center gap-4 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-ink-20`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-rose-ultra to-rose-pale font-head text-[17px] font-bold text-rose">{c.initial}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="font-head text-[15px] font-bold text-ink">{c.name}</span><StatusPill s={c.s} /></div>
              <div className="font-thai text-[12.5px] text-ink-40">{c.meta} · อัปเดต {c.last}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">{c.tags.map((t) => <span key={t} className="rounded-md bg-surface px-2 py-0.5 font-thai text-[11px] text-ink-60">{t}</span>)}</div>
            </div>
            <ChevronRight size={18} className="text-ink-20" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ════════ CUSTOMER 360 ════════ */
function CustomerMock({ go }: { go: Go }) {
  const metrics = [
    { l: "HbA1c", v: "5.9", u: "%", s: "caution", t: "down" }, { l: "LDL", v: "138", u: "mg/dL", s: "warning", t: "up" },
    { l: "น้ำหนัก", v: "68", u: "kg", s: "good", t: "down" }, { l: "ไขมันช่องท้อง", v: "9", u: "lv", s: "good", t: "down" },
    { l: "น้ำตาลขณะอด", v: "102", u: "mg/dL", s: "caution", t: "flat" }, { l: "อายุร่างกาย", v: "38", u: "ปี", s: "good", t: "down" },
  ];
  const insights = [
    { icon: TrendingUp, tone: "amber", t: "LDL ขยับขึ้น", d: "124 → 138 ใน 3 เดือน · คุยเรื่องอาหาร + โอเมก้า" },
    { icon: Heart, tone: "wellness", t: "น้ำหนักลงต่อเนื่อง", d: "−2.4 กก. ใน 2 เดือน เก่งมากค่ะ" },
    { icon: Moon, tone: "science", t: "การนอนดีขึ้น", d: "หลับลึกเฉลี่ย 18% · สม่ำเสมอขึ้น" },
  ];
  return (
    <div className="space-y-5">
      <Back label="ลูกค้าทั้งหมด" onClick={() => go("customers")} />
      <div className={`${CARD} p-6`}>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-ultra to-rose-pale font-head text-[24px] font-extrabold text-rose">อ</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5"><h1 className="font-head text-[22px] font-extrabold tracking-tight text-ink">นส. ตัวอย่าง</h1><StatusPill s="good" /></div>
            <div className="mt-1 font-thai text-[13.5px] text-ink-60">หญิง · 34 ปี · 162 ซม. · ผลเลือดล่าสุด 2 เดือนก่อน</div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <button className="inline-flex items-center gap-1.5 rounded-full bg-rose px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-deep transition-colors"><Phone size={15} /> โทร</button>
          <button className="inline-flex items-center gap-1.5 rounded-full border border-ink-20 bg-white px-4 py-2 text-[13px] font-semibold text-ink-80 hover:bg-surface"><MessageCircle size={15} /> LINE</button>
          <button onClick={() => go("import")} className="inline-flex items-center gap-1.5 rounded-full border border-ink-20 bg-white px-4 py-2 text-[13px] font-semibold text-ink-80 hover:bg-surface"><Upload size={15} /> นำเข้า Wearable</button>
          <button onClick={() => go("report")} className="inline-flex items-center gap-1.5 rounded-full border border-science/30 bg-science-ultra px-4 py-2 text-[13px] font-semibold text-science hover:bg-science hover:text-white transition-colors"><FileText size={15} /> เปิด Report</button>
          <button className="inline-flex items-center gap-1.5 rounded-full border border-ink-20 bg-white px-4 py-2 text-[13px] font-semibold text-ink-80 hover:bg-surface"><Network size={15} /> แผนผังยา</button>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className={`${CARD} flex items-center gap-6 p-6`}>
            <Gauge v={78} color="#396755" label="" />
            <div className="min-w-0">
              <div className="font-thai text-[13px] text-ink-40">สุขภาพโดยรวม</div>
              <div className="mt-0.5 font-head text-[20px] font-bold text-wellness">อยู่ในเกณฑ์ดี</div>
              <p className="mt-1.5 font-thai text-[13.5px] leading-relaxed text-ink-60">ดีขึ้นจากเดือนก่อน <b className="text-wellness">+4 คะแนน</b> — โฟกัสเรื่องไขมัน (LDL) อีกนิดจะเยี่ยมเลยค่ะ</p>
              <button onClick={() => go("report")} className="mt-3 inline-flex items-center gap-1.5 font-thai text-[13px] font-semibold text-science hover:gap-2 transition-all">ดูรายงานเต็ม <ArrowRight size={14} /></button>
            </div>
          </div>
          <div>
            <SectionHead eyebrow="ค่าสำคัญล่าสุด" title="ตัวเลขสุขภาพ" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {metrics.map((m) => { const c = STATUS[m.s]; const T = m.t === "up" ? TrendingUp : m.t === "down" ? TrendingDown : ArrowRight; return (
                <div key={m.l} className={`${CARD} p-4`}>
                  <div className="flex items-center justify-between"><span className="font-thai text-[12.5px] text-ink-40">{m.l}</span><span className={`h-2 w-2 rounded-full ${c.dot}`} /></div>
                  <div className="mt-2 flex items-baseline gap-1"><span className="font-head text-[26px] font-extrabold leading-none text-ink">{m.v}</span><span className="font-thai text-[12px] text-ink-40">{m.u}</span></div>
                  <div className="mt-2 flex items-center gap-1"><T size={13} className={c.text} /><span className={`text-[12px] font-semibold ${c.text}`}>{c.label}</span></div>
                </div>); })}
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <div className={`${CARD} p-5`}>
            <div className="mb-3 flex items-center gap-2"><Sparkles size={17} className="text-rose" /><h2 className="font-head text-[16px] font-bold text-ink">สิ่งที่น่าสังเกต</h2></div>
            <div className="space-y-3">{insights.map((i) => (<div key={i.t} className="flex gap-3"><IconChip icon={i.icon} tone={i.tone} /><div className="min-w-0"><div className="font-head text-[14px] font-bold text-ink">{i.t}</div><div className="font-thai text-[12.5px] leading-snug text-ink-60">{i.d}</div></div></div>))}</div>
          </div>
          <div className={`${CARD} bg-wellness-ultra/60 p-5`}>
            <div className="flex items-center gap-2"><Stethoscope size={17} className="text-wellness" /><h2 className="font-head text-[15px] font-bold text-wellness-deep">ก้าวต่อไป</h2></div>
            <p className="mt-1.5 font-thai text-[13px] leading-relaxed text-ink-80">นัดตรวจไขมันซ้ำใน 6 สัปดาห์ · เริ่มโอเมก้า-3 · คุยอาหารคาร์บต่ำตอนเย็น</p>
            <button className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-wellness px-4 py-2 text-[13px] font-semibold text-white hover:bg-wellness-deep transition-colors">สร้างแผนดูแล <ArrowRight size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════ WEARABLE IMPORT ════════ */
function ImportMock({ go }: { go: Go }) {
  const [done, setDone] = useState(false);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Back label="โปรไฟล์ นส. ตัวอย่าง" onClick={() => go("customer")} />
      <div><div className="font-thai text-[12.5px] text-ink-40">UP Pulse</div><h1 className="font-head text-[24px] font-extrabold tracking-tight text-ink">นำเข้าข้อมูล Wearable</h1></div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[{ icon: Watch, n: "WHOOP", d: "CSV / เชื่อมต่อ" }, { icon: Apple, n: "Apple Watch", d: "ไฟล์ export" }, { icon: Activity, n: "Google Fit", d: "เชื่อมบัญชี" }].map((p, i) => (
          <div key={p.n} className={`${CARD} p-5 text-center ${i === 0 ? "ring-2 ring-rose/30" : ""}`}>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-ultra text-rose"><p.icon size={22} /></span>
            <div className="mt-3 font-head text-[15px] font-bold text-ink">{p.n}</div><div className="font-thai text-[12px] text-ink-40">{p.d}</div>
          </div>
        ))}
      </div>
      {!done ? (
        <div className={`${CARD} p-8 text-center`}>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-ultra text-rose"><Upload size={26} /></div>
          <div className="mt-4 font-head text-[16px] font-bold text-ink">ลากไฟล์ WHOOP มาวาง หรือเลือกไฟล์</div>
          <div className="mt-1 font-thai text-[12.5px] text-ink-40">รองรับ physiological_cycles.csv · sleeps · workouts · journal</div>
          <button onClick={() => setDone(true)} className="mt-5 inline-flex items-center gap-2 rounded-full bg-rose px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-rose-deep transition-colors"><Upload size={16} /> เลือกไฟล์ (ตัวอย่าง)</button>
        </div>
      ) : (
        <div className={`${CARD} p-8 text-center`}>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-status-bg-optimal text-status-optimal"><CheckCircle2 size={26} /></div>
          <div className="mt-4 font-head text-[16px] font-bold text-ink">นำเข้าสำเร็จ — 62 วัน</div>
          <div className="mt-1 font-thai text-[12.5px] text-ink-40">11 เม.ย. – 14 มิ.ย. 2026 · Recovery, การนอน, HRV, SpO₂ ครบ</div>
          <button onClick={() => go("report")} className="mt-5 inline-flex items-center gap-2 rounded-full bg-science px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-science-deep transition-colors"><FileText size={16} /> ดู Report ที่ได้ <ArrowRight size={15} /></button>
        </div>
      )}
    </div>
  );
}

/* ════════ REPORT (แบบพี่ปุ๊) ════════ */
function ReportMock({ go }: { go: Go }) {
  const rec = [34, 54, 71, 74, 80, 85, 93, 94, 86, 77, 60, 89, 56, 90, 83, 81, 61, 57, 46, 91, 87, 43, 75, 48, 61, 39, 53, 69, 73, 86, 64, 88, 84, 95, 75];
  const hrv = [18, 22, 26, 30, 28, 32, 37, 39, 33, 30, 37, 39, 30, 37, 43, 38, 31, 29, 27, 39, 39, 25, 36, 30, 33, 25, 30, 32, 34, 35, 37, 39, 33, 44, 35];
  const sleep = [{ d: "deep", v: 28, c: "#3D5826" }, { d: "REM", v: 16, c: "#5BBDD4" }, { d: "หลับตื้น", v: 51, c: "#BAB5BD" }, { d: "ตื่น", v: 5, c: "#EDE8DE" }];
  const labs = [
    { n: "Cholesterol รวม", v: "212", u: "mg/dL", ref: "< 200", s: "caution" },
    { n: "Triglyceride", v: "168", u: "mg/dL", ref: "< 150", s: "caution" },
    { n: "HDL", v: "58", u: "mg/dL", ref: "> 50", s: "optimal" },
    { n: "LDL", v: "138", u: "mg/dL", ref: "< 130", s: "warning" },
  ];
  const levels = [
    { l: "L1", t: "ไลฟ์สไตล์ · ฐานสำคัญที่สุด", c: "wellness", items: ["นอนตะแคง + ยกหัวเตียง → ดัน SpO₂ ≥95%", "เข้านอน-ตื่นเวลาเดิม → เพิ่ม REM", "ห้องเย็น 18–20°C", "งดแอลกอฮอล์ (ทำได้ดีมาก)"] },
    { l: "L2", t: "ติดตามค่า · Biomarker", c: "science", items: ["เฝ้า SpO₂ ทุกเช้า", "ดู HRV แนวโน้ม 7 วัน", "ตรวจเลือดปีละ 1–2 ครั้ง (hs-CRP, Vit D, ไทรอยด์)"] },
    { l: "L3", t: "อาหารเสริม 🌿 Nutrilite", c: "amber", items: ["Triple Omega — HRV + การอักเสบ", "Cal Mag D — กระดูก + การนอน", "Vitamin B Plus — พลังงาน + ประสาท", "Double X — ฐาน micronutrient"] },
    { l: "L4", t: "การแพทย์ (ปรึกษาแพทย์)", c: "rose", items: ["ตรวจการนอนหลับ (Sleep Study) — ถ้า SpO₂ ตกซ้ำ", "ปรึกษาแพทย์เรื่องวัยหมดประจำเดือน"] },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Back label="โปรไฟล์ นส. ตัวอย่าง" onClick={() => go("customer")} />
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-full border border-ink-20 bg-white px-4 py-2 text-[13px] font-semibold text-ink-80 hover:bg-surface"><Printer size={15} /> พิมพ์ / PDF</button>
      </div>
      {/* hero */}
      <div className={`${CARD} overflow-hidden`}>
        <div className="bg-gradient-to-br from-wellness to-wellness-deep p-6 text-white">
          <div className="font-thai text-[12.5px] text-white/70">Longevity Wearable Report · WHOOP</div>
          <h1 className="mt-1 font-head text-[24px] font-extrabold">สุขภาพเชิงลึก · นส. ตัวอย่าง</h1>
          <div className="mt-2 flex flex-wrap gap-2 font-thai text-[12.5px] text-white/85">
            <span className="rounded-full bg-white/15 px-3 py-1">📅 11 เม.ย. – 14 มิ.ย. 2026</span>
            <span className="rounded-full bg-white/15 px-3 py-1">🛌 64 วันต่อเนื่อง</span>
            <span className="rounded-full bg-white/15 px-3 py-1">🏃 106 ครั้งออกกำลังกาย</span>
          </div>
        </div>
      </div>
      {/* score gauges */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Gauge v={67} color="#CA8A04" label="Recovery" sub="🟢 34 · 🟡 29 · 🔴 2" unit="%" />
        <Gauge v={84} color="#396755" label="การนอน" sub="เฉลี่ย 7.1 ชม./คืน" unit="%" />
        <Gauge v={32} max={60} color="#2A7B8F" label="HRV" sub="ช่วง 18–44 ms · ↑" unit="" />
        <Gauge v={94} color="#EA580C" label="SpO₂" sub="⚠️ 16 คืน < 93%" unit="%" />
      </div>
      {/* exec summary */}
      <div>
        <SectionHead eyebrow="Executive Summary" title="ภาพรวม 4 ประเด็น" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: CheckCircle2, tone: "wellness", t: "จุดแข็ง · โครงสร้างการนอนดีเยี่ยม", d: "หลับลึกเฉลี่ย 28.7% สูงกว่ามาตรฐาน (15–20%) · ประสิทธิภาพการนอน 91%" },
            { icon: AlertTriangle, tone: "amber", t: "ต้องโฟกัส · ออกซิเจนตกตอนนอน", d: "16 คืน SpO₂ < 93% (ต่ำสุด 89%) — ควรตรวจการนอนเพิ่ม" },
            { icon: TrendingUp, tone: "science", t: "แนวโน้มดี · หนี้การนอนลดลง", d: "Sleep debt 47 → 30 นาที (−38%) · REM +9%" },
            { icon: Heart, tone: "rose", t: "พฤติกรรมยอดเยี่ยม", d: "งดแอลกอฮอล์ 100% · ทำอาหารเอง · ออกกำลังสม่ำเสมอ" },
          ].map((f) => (
            <div key={f.t} className={`${CARD} flex gap-3 p-5`}><IconChip icon={f.icon} tone={f.tone} /><div><div className="font-head text-[14.5px] font-bold text-ink">{f.t}</div><p className="mt-1 font-thai text-[12.5px] leading-snug text-ink-60">{f.d}</p></div></div>
          ))}
        </div>
      </div>
      {/* charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${CARD} p-5`}>
          <div className="flex items-center gap-2"><HeartPulse size={16} className="text-wellness" /><h3 className="font-head text-[15px] font-bold text-ink">Recovery รายวัน</h3><span className="ml-auto font-head text-[13px] font-bold text-ink-60">เฉลี่ย 67%</span></div>
          <div className="mt-3"><Sparkline data={rec} color="#5A7A3A" /></div>
        </div>
        <div className={`${CARD} p-5`}>
          <div className="flex items-center gap-2"><Activity size={16} className="text-science" /><h3 className="font-head text-[15px] font-bold text-ink">HRV (ความแปรปรวนหัวใจ)</h3><span className="ml-auto font-head text-[13px] font-bold text-ink-60">32 ms ↑</span></div>
          <div className="mt-3"><Sparkline data={hrv} color="#2A7B8F" /></div>
        </div>
        <div className={`${CARD} p-5`}>
          <div className="flex items-center gap-2"><Bed size={16} className="text-ink-60" /><h3 className="font-head text-[15px] font-bold text-ink">สัดส่วนการนอน</h3></div>
          <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full">{sleep.map((s) => <div key={s.d} style={{ width: `${s.v}%`, background: s.c }} title={`${s.d} ${s.v}%`} />)}</div>
          <div className="mt-3 flex flex-wrap gap-3">{sleep.map((s) => <span key={s.d} className="inline-flex items-center gap-1.5 font-thai text-[12px] text-ink-60"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.c }} /> {s.d} {s.v}%</span>)}</div>
        </div>
        <div className={`${CARD} p-5`}>
          <div className="flex items-center gap-2"><Wind size={16} className="text-status-warning" /><h3 className="font-head text-[15px] font-bold text-ink">SpO₂ · จุดที่ต้องดู</h3></div>
          <div className="mt-3 rounded-xl bg-status-bg-warning/60 p-3 font-thai text-[12.5px] leading-relaxed text-[#c2410c]"><b>16 คืน</b> ออกซิเจนต่ำกว่า 93% (ต่ำสุด 89%) — อาจเป็นสัญญาณการหายใจติดขัดขณะหลับ · แนะนำปรึกษาแพทย์เพื่อตรวจการนอน</div>
        </div>
      </div>
      {/* lab */}
      <div>
        <SectionHead eyebrow="Lab" title="ผลไขมันในเลือด" />
        <div className={`${CARD} divide-y divide-ink-5 overflow-hidden`}>
          {labs.map((l) => { const c = STATUS[l.s]; return (
            <div key={l.n} className="flex items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1"><div className="font-thai text-[13.5px] font-semibold text-ink">{l.n}</div><div className="font-thai text-[11.5px] text-ink-40">ปกติ {l.ref}</div></div>
              <div className="text-right"><div className="font-head text-[16px] font-bold text-ink">{l.v} <span className="text-[11px] font-normal text-ink-40">{l.u}</span></div></div>
              <StatusPill s={l.s} />
            </div>); })}
        </div>
      </div>
      {/* longevity protocol */}
      <div>
        <SectionHead eyebrow="Longevity Protocol" title="แผนดูแล 4 ระดับ" />
        <div className="space-y-4">
          {levels.map((lv) => (
            <div key={lv.l} className={`${CARD} p-5`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl font-head text-[14px] font-extrabold ${TONE[lv.c]}`}>{lv.l}</span>
                <h3 className="font-head text-[15.5px] font-bold text-ink">{lv.t}</h3>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">{lv.items.map((it) => (<li key={it} className="flex gap-2 font-thai text-[13px] leading-snug text-ink-60"><CheckCircle2 size={15} className="mt-0.5 flex-none text-wellness" /> {it}</li>))}</ul>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-amber-ultra/60 p-4 font-thai text-[12px] leading-relaxed text-[#a16207]"><b>⚕️ หมายเหตุ:</b> รายงานเชิง wellness · ไม่ใช่การวินิจฉัย · ค่า SpO₂ จาก wearable มีคลาดเคลื่อนได้ · อาหารเสริมควรปรึกษาเภสัช/แพทย์ก่อน</div>
    </div>
  );
}

/* ════════ CHECK FORM ════════ */
function CheckFormMock({ go }: { go: Go }) {
  const [show, setShow] = useState(false);
  const steps = ["ข้อมูลทั่วไป", "ไลฟ์สไตล์", "สุขภาพ", "เป้าหมาย", "สรุป"];
  const active = 2;
  if (show) return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Back label="แก้ไขฟอร์ม" onClick={() => setShow(false)} />
      <div className={`${CARD} overflow-hidden`}>
        <div className="bg-gradient-to-br from-science to-science-deep p-6 text-white">
          <div className="font-thai text-[12.5px] text-white/70">ผลวิเคราะห์ AI</div>
          <h1 className="mt-1 font-head text-[22px] font-extrabold">เหมาะกับโปรแกรม Longevity Care</h1>
          <p className="mt-1.5 font-thai text-[13px] text-white/85">โปรไฟล์เมตาบอลิกเริ่มมีสัญญาณ — เป็นจังหวะที่ดีในการเริ่มดูแลเชิงป้องกัน</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          {[{ l: "ความพร้อม", v: "8.2", s: "good" }, { l: "ความเร่งด่วน", v: "ปานกลาง", s: "caution" }, { l: "งบที่เหมาะ", v: "Full Course", s: "optimal" }].map((x) => (
            <div key={x.l} className="rounded-xl bg-surface p-4 text-center"><div className="font-thai text-[12px] text-ink-40">{x.l}</div><div className="mt-1 font-head text-[18px] font-extrabold text-ink">{x.v}</div></div>
          ))}
        </div>
      </div>
      <div className={`${CARD} p-5`}>
        <h3 className="font-head text-[15px] font-bold text-ink">คลิปที่แนะนำให้ส่งต่อ</h3>
        <div className="mt-3 space-y-2">{["สายโทรผิด · อรนงค์", "ไม่ต้องเก่ง · นพ.ชนันต์"].map((c) => (<div key={c} className="flex items-center gap-3 rounded-xl border border-ink-10 p-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-ultra text-rose"><ChevronRight size={16} /></span><span className="font-thai text-[13px] text-ink">{c}</span></div>))}</div>
      </div>
      <button onClick={() => go("customer")} className="inline-flex items-center gap-2 rounded-full bg-rose px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-rose-deep transition-colors">บันทึกเป็นลูกค้า <ArrowRight size={16} /></button>
    </div>
  );
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Back label="หน้าแรก" onClick={() => go("home")} />
      <div><h1 className="font-head text-[24px] font-extrabold tracking-tight text-ink">ประเมินสุขภาพเบื้องต้น</h1><p className="mt-1 font-thai text-[14px] text-ink-60">ตอบไม่กี่ข้อ เดี๋ยวเราช่วยดูให้ว่าควรเริ่มตรงไหน 🌿</p></div>
      <div className="flex items-center gap-2">{steps.map((s, i) => (<div key={s} className="flex flex-1 items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold ${i < active ? "bg-wellness text-white" : i === active ? "bg-rose text-white" : "bg-ink-5 text-ink-40"}`}>{i < active ? "✓" : i + 1}</span>{i < steps.length - 1 && <div className={`h-0.5 flex-1 rounded-full ${i < active ? "bg-wellness" : "bg-ink-10"}`} />}</div>))}</div>
      <div className="font-thai text-[13px] text-ink-40">ขั้นที่ {active + 1} จาก {steps.length} · <b className="text-ink-80">{steps[active]}</b></div>
      <div className={`${CARD} space-y-5 p-6`}>
        <Field label="มีโรคประจำตัวไหม?" hint="เลือกได้มากกว่า 1"><div className="flex flex-wrap gap-2">{["เบาหวาน", "ความดัน", "ไขมันสูง", "ไม่มี"].map((o, i) => <span key={o} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${i === 0 ? "border-rose bg-rose-ultra text-rose" : "border-ink-20 text-ink-60 hover:border-ink-40"}`}>{o}</span>)}</div></Field>
        <Field label="ทานยาประจำอยู่หรือเปล่า?"><input readOnly value="Metformin 500mg เช้า-เย็น" className="w-full rounded-xl border border-ink-20 bg-surface px-4 py-2.5 font-thai text-[14px] text-ink outline-none focus:border-rose" /></Field>
        <Field label="ระดับความเครียดช่วงนี้" hint="0 = สบายมาก, 10 = เครียดสุด"><div className="flex items-center gap-3"><input type="range" min={0} max={10} defaultValue={6} className="flex-1 accent-rose" readOnly /><span className="font-head text-[18px] font-bold text-rose">6</span></div></Field>
      </div>
      <div className="flex items-center justify-between">
        <button className="rounded-full border border-ink-20 bg-white px-5 py-2.5 text-[14px] font-semibold text-ink-60 hover:bg-surface">ย้อนกลับ</button>
        <button onClick={() => setShow(true)} className="inline-flex items-center gap-2 rounded-full bg-rose px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-rose-deep transition-colors">ดูผลวิเคราะห์ <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div><label className="font-head text-[14px] font-bold text-ink">{label}</label>{hint && <div className="mb-2 mt-0.5 font-thai text-[12px] text-ink-40">{hint}</div>}<div className={hint ? "" : "mt-2"}>{children}</div></div>;
}

/* ════════ SHELL ════════ */
const NAV = [
  { id: "home", label: "หน้าแรก", icon: HomeIcon },
  { id: "customers", label: "ลูกค้า", icon: Users },
  { id: "checkform", label: "Check Form", icon: ClipboardList },
  { id: "report", label: "Report", icon: FileText },
];

export default function V2Preview() {
  const [screen, setScreen] = useState("home");
  const go: Go = (s) => { setScreen(s); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  return (
    <div className="min-h-screen bg-[#FAF7F2] font-body text-ink antialiased">
      <div className="border-b border-amber/20 bg-amber-ultra">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-5 py-2 font-thai text-[12.5px] text-amber"><Sparkles size={14} /> <b>UPLabs v2 · ตัวอย่างดีไซน์</b> — mock ยังไม่ใช่ของจริง · คลิกไล่ดูได้ทั้ง journey</div>
      </div>
      <header className="sticky top-0 z-20 border-b border-ink-10 bg-warm-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <button onClick={() => go("home")} className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose text-white"><Leaf size={17} /></span>
            <span className="font-head text-[16px] font-extrabold text-ink">UP<span className="text-rose">Labs</span></span>
            <span className="ml-1 rounded-full bg-ink-5 px-2 py-0.5 font-mono text-[10px] font-bold text-ink-40">v2</span>
          </button>
          <nav className="flex items-center gap-1 rounded-full bg-ink-5 p-1">
            {NAV.map((s) => (
              <button key={s.id} onClick={() => go(s.id)} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${screen === s.id || (s.id === "customers" && screen === "customer") || (s.id === "report" && screen === "import") ? "bg-white text-ink shadow-sm" : "text-ink-40 hover:text-ink"}`}><s.icon size={14} /> <span className="hidden sm:inline">{s.label}</span></button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">
        {screen === "home" && <HomeMock go={go} />}
        {screen === "customers" && <CustomersMock go={go} />}
        {screen === "customer" && <CustomerMock go={go} />}
        {screen === "import" && <ImportMock go={go} />}
        {screen === "report" && <ReportMock go={go} />}
        {screen === "checkform" && <CheckFormMock go={go} />}
      </main>
      <footer className="mx-auto max-w-5xl px-5 pb-10 pt-4 font-thai text-[12px] text-ink-40">ดีไซน์ทิศทาง "clinical-warm" · journey: หน้าแรก → ลูกค้า → โปรไฟล์ → นำเข้า Wearable → Report · mock data ทั้งหมด</footer>
    </div>
  );
}
