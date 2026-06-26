"use client";

/**
 * UPLabs v2 — DESIGN PREVIEW (static mockups · no real data, no logic)
 * ───────────────────────────────────────────────────────────────────
 * Track 2 "clinical-warm" reset direction for review only.
 * Principles vs current app:
 *   - no glassmorphism / no aurora — crisp warm-white surfaces + soft shadows
 *   - Lucide icons (no emoji-as-icon) · friendly sentence-case Thai labels
 *     (no monospace-UPPERCASE everywhere) · comfortable text sizes
 *   - ONE status color system · consistent radius/spacing · airy layout
 *   - rose primary, wellness green = positive health, science teal = data
 * Public route (middleware allowlist) so it can be shared for feedback.
 */

import { useState } from "react";
import {
  Users, ClipboardList, Scale, Droplet, Activity, Apple, Leaf, Wand2,
  Phone, MessageCircle, PlusCircle, Network, Bell, CalendarDays, ChevronRight,
  Heart, FlaskConical, TrendingUp, TrendingDown, Moon, Sparkles, ArrowRight,
  Stethoscope, Search,
} from "lucide-react";

/* ── shared status system (single source) ── */
const STATUS: Record<string, { dot: string; text: string; bg: string; label: string }> = {
  optimal: { dot: "bg-status-optimal", text: "text-status-optimal", bg: "bg-status-bg-optimal", label: "ดีเยี่ยม" },
  good:    { dot: "bg-status-good",    text: "text-[#4d7c0f]",      bg: "bg-status-bg-good",    label: "ดี" },
  caution: { dot: "bg-status-caution", text: "text-[#a16207]",      bg: "bg-status-bg-caution", label: "เริ่มต้องดู" },
  warning: { dot: "bg-status-warning", text: "text-[#c2410c]",      bg: "bg-status-bg-warning", label: "ต้องดูแล" },
  danger:  { dot: "bg-status-danger",  text: "text-status-danger",  bg: "bg-status-bg-danger",  label: "เร่งด่วน" },
};

const CARD = "rounded-2xl border border-ink-10 bg-white shadow-[0_1px_2px_rgba(24,21,26,0.04),0_12px_32px_-20px_rgba(24,21,26,0.22)]";

/* ── tiny building blocks ── */
function IconChip({ icon: Icon, tone = "rose" }: { icon: any; tone?: string }) {
  const tones: Record<string, string> = {
    rose: "bg-rose-ultra text-rose", wellness: "bg-wellness-ultra text-wellness",
    science: "bg-science-ultra text-science", amber: "bg-amber-ultra text-amber",
    ink: "bg-ink-5 text-ink-60",
  };
  return (
    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>
      <Icon size={20} strokeWidth={2} />
    </span>
  );
}

function StatusPill({ s, withDot = true }: { s: keyof typeof STATUS | string; withDot?: boolean }) {
  const c = STATUS[s] ?? STATUS.good;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${c.bg} px-2.5 py-1 text-[12px] font-semibold ${c.text}`}>
      {withDot && <span className={`h-2 w-2 rounded-full ${c.dot}`} />} {c.label}
    </span>
  );
}

function SectionHead({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="font-thai text-[12.5px] text-ink-40">{eyebrow}</div>}
        <h2 className="font-head text-[19px] font-bold tracking-tight text-ink">{title}</h2>
      </div>
      {action && (
        <button className="inline-flex items-center gap-1 font-thai text-[13px] font-semibold text-rose hover:gap-1.5 transition-all">
          {action} <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

/* ════════════════════════ SCREEN 1 · HOME ════════════════════════ */
function HomeMock() {
  const apps = [
    { icon: Users, tone: "rose", name: "ลูกค้า", desc: "โปรไฟล์ · ผลตรวจ · ติดตาม" },
    { icon: ClipboardList, tone: "science", name: "Check Form", desc: "ประเมิน prospect + AI" },
    { icon: Scale, tone: "wellness", name: "องค์ประกอบร่างกาย", desc: "น้ำหนัก · ไขมัน · กล้ามเนื้อ" },
    { icon: Droplet, tone: "amber", name: "น้ำตาลต่อเนื่อง", desc: "CGM analyzer" },
    { icon: Activity, tone: "science", name: "UP Pulse", desc: "Whoop · Apple · Fit" },
    { icon: Apple, tone: "wellness", name: "NutriScan", desc: "วิเคราะห์อาหาร" },
    { icon: Leaf, tone: "wellness", name: "Plate Planner", desc: "ออกแบบจานอาหาร" },
    { icon: Wand2, tone: "rose", name: "Program Designer", desc: "ออกแบบโปรแกรม" },
  ];
  const recent = [
    { initial: "ป", name: "พี่ปุ๊", note: "ผล Whoop ใหม่ 62 วัน", s: "good" },
    { initial: "อ", name: "นส. ตัวอย่าง", note: "LDL เริ่มสูง · ควรติดตาม", s: "caution" },
    { initial: "ส", name: "พี่สุ", note: "เริ่ม Metformin · ตรวจ B12", s: "warning" },
  ];
  return (
    <div className="space-y-7">
      {/* greeting */}
      <div>
        <div className="font-thai text-[14px] text-ink-40">สวัสดีตอนสาย ☀️</div>
        <h1 className="mt-1 font-head text-[30px] font-extrabold tracking-tight text-ink">ต้น</h1>
        <p className="mt-1 font-thai text-[14px] text-ink-60">วันนี้มีลูกค้า <b className="text-rose">3 คน</b> ที่ควรติดตาม</p>
      </div>

      {/* today stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Users, tone: "rose", n: "24", l: "ลูกค้าทั้งหมด" },
          { icon: Bell, tone: "amber", n: "3", l: "รอติดตาม" },
          { icon: CalendarDays, tone: "science", n: "2", l: "นัดวันนี้" },
        ].map((s) => (
          <div key={s.l} className={`${CARD} p-5`}>
            <IconChip icon={s.icon} tone={s.tone} />
            <div className="mt-3 font-head text-[28px] font-extrabold leading-none text-ink">{s.n}</div>
            <div className="mt-1 font-thai text-[13px] text-ink-60">{s.l}</div>
          </div>
        ))}
      </div>

      {/* apps */}
      <div>
        <SectionHead eyebrow="เครื่องมือของคุณ" title="เริ่มทำงาน" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {apps.map((a) => (
            <button key={a.name} className={`${CARD} group p-5 text-left transition-all hover:-translate-y-0.5 hover:border-ink-20`}>
              <IconChip icon={a.icon} tone={a.tone} />
              <div className="mt-3 font-head text-[15px] font-bold text-ink">{a.name}</div>
              <div className="mt-0.5 font-thai text-[12.5px] leading-snug text-ink-40">{a.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* recent customers */}
      <div>
        <SectionHead eyebrow="อัปเดตล่าสุด" title="ลูกค้าที่ควรดู" action="ดูทั้งหมด" />
        <div className={`${CARD} divide-y divide-ink-5 overflow-hidden`}>
          {recent.map((r) => (
            <button key={r.name} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-ultra font-head text-[16px] font-bold text-rose">{r.initial}</span>
              <div className="min-w-0 flex-1">
                <div className="font-head text-[15px] font-bold text-ink">{r.name}</div>
                <div className="font-thai text-[12.5px] text-ink-40">{r.note}</div>
              </div>
              <StatusPill s={r.s} />
              <ChevronRight size={18} className="text-ink-20" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════ SCREEN 2 · CUSTOMER 360 ════════════════════════ */
function CustomerMock() {
  const metrics = [
    { l: "HbA1c", v: "5.9", u: "%", s: "caution", trend: "down" },
    { l: "LDL", v: "138", u: "mg/dL", s: "warning", trend: "up" },
    { l: "น้ำหนัก", v: "68", u: "kg", s: "good", trend: "down" },
    { l: "ไขมันในช่องท้อง", v: "9", u: "lv", s: "good", trend: "down" },
    { l: "น้ำตาลขณะอด", v: "102", u: "mg/dL", s: "caution", trend: "flat" },
    { l: "อายุร่างกาย", v: "38", u: "ปี", s: "good", trend: "down" },
  ];
  const insights = [
    { icon: TrendingUp, tone: "warning", t: "LDL ขยับขึ้น", d: "จาก 124 → 138 ใน 3 เดือน · คุยเรื่องอาหาร + โอเมก้า" },
    { icon: Heart, tone: "wellness", t: "น้ำหนักลงต่อเนื่อง", d: "−2.4 กก. ใน 2 เดือน เก่งมากค่ะ ไปต่อ" },
    { icon: Moon, tone: "science", t: "การนอนดีขึ้น", d: "หลับลึกเฉลี่ย 18% · สม่ำเสมอขึ้น" },
  ];
  return (
    <div className="space-y-5">
      {/* identity */}
      <div className={`${CARD} p-6`}>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-ultra to-rose-pale font-head text-[24px] font-extrabold text-rose">อ</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-head text-[22px] font-extrabold tracking-tight text-ink">นส. ตัวอย่าง</h1>
              <StatusPill s="good" />
            </div>
            <div className="mt-1 font-thai text-[13.5px] text-ink-60">หญิง · 34 ปี · 162 ซม. · ผลเลือดล่าสุด 2 เดือนก่อน</div>
          </div>
        </div>
        {/* actions — one primary, rest secondary */}
        <div className="mt-5 flex flex-wrap gap-2.5">
          <button className="inline-flex items-center gap-1.5 rounded-full bg-rose px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-rose-deep">
            <Phone size={15} /> โทร
          </button>
          {[
            { icon: MessageCircle, t: "LINE" },
            { icon: PlusCircle, t: "เพิ่มผลตรวจ" },
            { icon: Network, t: "แผนผังยา & อาหารเสริม" },
          ].map((b) => (
            <button key={b.t} className="inline-flex items-center gap-1.5 rounded-full border border-ink-20 bg-white px-4 py-2 text-[13px] font-semibold text-ink-80 transition-colors hover:border-ink-20 hover:bg-surface">
              <b.icon size={15} /> {b.t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* left: score + metrics */}
        <div className="space-y-5 lg:col-span-2">
          {/* health score */}
          <div className={`${CARD} flex items-center gap-6 p-6`}>
            <div className="relative flex h-28 w-28 flex-none items-center justify-center">
              <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#EDE8DE" strokeWidth="12" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="#396755" strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52 * 0.78} ${2 * Math.PI * 52}`} />
              </svg>
              <div className="absolute text-center">
                <div className="font-head text-[30px] font-extrabold leading-none text-ink">78</div>
                <div className="font-thai text-[11px] text-ink-40">/ 100</div>
              </div>
            </div>
            <div className="min-w-0">
              <div className="font-thai text-[13px] text-ink-40">สุขภาพโดยรวม</div>
              <div className="mt-0.5 font-head text-[20px] font-bold text-wellness">อยู่ในเกณฑ์ดี</div>
              <p className="mt-1.5 font-thai text-[13.5px] leading-relaxed text-ink-60">
                ดีขึ้นจากเดือนก่อน <b className="text-wellness">+4 คะแนน</b> — โฟกัสเรื่องไขมัน (LDL) อีกนิดจะเยี่ยมเลยค่ะ
              </p>
            </div>
          </div>

          {/* metrics */}
          <div>
            <SectionHead eyebrow="ค่าสำคัญล่าสุด" title="ตัวเลขสุขภาพ" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {metrics.map((m) => {
                const c = STATUS[m.s];
                const T = m.trend === "up" ? TrendingUp : m.trend === "down" ? TrendingDown : ArrowRight;
                return (
                  <div key={m.l} className={`${CARD} p-4`}>
                    <div className="flex items-center justify-between">
                      <span className="font-thai text-[12.5px] text-ink-40">{m.l}</span>
                      <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="font-head text-[26px] font-extrabold leading-none text-ink">{m.v}</span>
                      <span className="font-thai text-[12px] text-ink-40">{m.u}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <T size={13} className={c.text} />
                      <span className={`text-[12px] font-semibold ${c.text}`}>{c.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* right: insights */}
        <div className="space-y-5">
          <div className={`${CARD} p-5`}>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={17} className="text-rose" />
              <h2 className="font-head text-[16px] font-bold text-ink">สิ่งที่น่าสังเกต</h2>
            </div>
            <div className="space-y-3">
              {insights.map((i) => (
                <div key={i.t} className="flex gap-3">
                  <span className="mt-0.5"><IconChip icon={i.icon} tone={i.tone} /></span>
                  <div className="min-w-0">
                    <div className="font-head text-[14px] font-bold text-ink">{i.t}</div>
                    <div className="font-thai text-[12.5px] leading-snug text-ink-60">{i.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={`${CARD} bg-wellness-ultra/60 p-5`}>
            <div className="flex items-center gap-2">
              <Stethoscope size={17} className="text-wellness" />
              <h2 className="font-head text-[15px] font-bold text-wellness-deep">ก้าวต่อไป</h2>
            </div>
            <p className="mt-1.5 font-thai text-[13px] leading-relaxed text-ink-80">นัดตรวจไขมันซ้ำใน 6 สัปดาห์ · เริ่มโอเมก้า-3 · คุยเรื่องอาหารคาร์บต่ำตอนเย็น</p>
            <button className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-wellness px-4 py-2 text-[13px] font-semibold text-white hover:bg-wellness-deep transition-colors">
              สร้างแผนดูแล <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════ SCREEN 3 · CHECK FORM ════════════════════════ */
function CheckFormMock() {
  const steps = ["ข้อมูลทั่วไป", "ไลฟ์สไตล์", "สุขภาพ", "เป้าหมาย", "สรุป"];
  const active = 2;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-head text-[24px] font-extrabold tracking-tight text-ink">ประเมินสุขภาพเบื้องต้น</h1>
        <p className="mt-1 font-thai text-[14px] text-ink-60">ตอบไม่กี่ข้อ เดี๋ยวเราช่วยดูให้ว่าควรเริ่มตรงไหน 🌿</p>
      </div>

      {/* progress steps */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold ${i < active ? "bg-wellness text-white" : i === active ? "bg-rose text-white" : "bg-ink-5 text-ink-40"}`}>
                {i < active ? "✓" : i + 1}
              </span>
            </div>
            {i < steps.length - 1 && <div className={`h-0.5 flex-1 rounded-full ${i < active ? "bg-wellness" : "bg-ink-10"}`} />}
          </div>
        ))}
      </div>
      <div className="font-thai text-[13px] text-ink-40">ขั้นที่ {active + 1} จาก {steps.length} · <b className="text-ink-80">{steps[active]}</b></div>

      {/* form card */}
      <div className={`${CARD} space-y-5 p-6`}>
        <Field label="มีโรคประจำตัวไหม?" hint="เลือกได้มากกว่า 1">
          <div className="flex flex-wrap gap-2">
            {["เบาหวาน", "ความดัน", "ไขมันสูง", "ไม่มี"].map((o, i) => (
              <span key={o} className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${i === 0 ? "border-rose bg-rose-ultra text-rose" : "border-ink-20 text-ink-60 hover:border-ink-20"}`}>{o}</span>
            ))}
          </div>
        </Field>
        <Field label="ทานยาประจำอยู่หรือเปล่า?">
          <input readOnly value="Metformin 500mg เช้า-เย็น"
            className="w-full rounded-xl border border-ink-20 bg-surface px-4 py-2.5 font-thai text-[14px] text-ink outline-none focus:border-rose" />
        </Field>
        <Field label="ระดับความเครียดช่วงนี้" hint="0 = สบายมาก, 10 = เครียดสุด">
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={10} defaultValue={6} className="flex-1 accent-rose" readOnly />
            <span className="font-head text-[18px] font-bold text-rose">6</span>
          </div>
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <button className="rounded-full border border-ink-20 bg-white px-5 py-2.5 text-[14px] font-semibold text-ink-60 hover:bg-surface">ย้อนกลับ</button>
        <button className="inline-flex items-center gap-2 rounded-full bg-rose px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-rose-deep transition-colors">
          ถัดไป <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-head text-[14px] font-bold text-ink">{label}</label>
      {hint && <div className="mb-2 mt-0.5 font-thai text-[12px] text-ink-40">{hint}</div>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </div>
  );
}

/* ════════════════════════ SHELL + SWITCHER ════════════════════════ */
const SCREENS = [
  { id: "home", label: "หน้าแรก", icon: Search },
  { id: "customer", label: "ลูกค้า 360", icon: Users },
  { id: "checkform", label: "Check Form", icon: ClipboardList },
];

export default function V2Preview() {
  const [screen, setScreen] = useState("home");
  return (
    <div className="min-h-screen bg-[#FAF7F2] font-body text-ink antialiased">
      {/* preview banner */}
      <div className="border-b border-amber/20 bg-amber-ultra">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-5 py-2 font-thai text-[12.5px] text-amber">
          <Sparkles size={14} /> <b>UPLabs v2 · ตัวอย่างดีไซน์</b> — mock ยังไม่ใช่ของจริง · เอาไว้ดู "แนว" ก่อนทำจริง
        </div>
      </div>

      {/* top bar + screen switcher */}
      <header className="sticky top-0 z-20 border-b border-ink-10 bg-warm-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose text-white"><Leaf size={17} /></span>
            <span className="font-head text-[16px] font-extrabold text-ink">UP<span className="text-rose">Labs</span></span>
            <span className="ml-1 rounded-full bg-ink-5 px-2 py-0.5 font-mono text-[10px] font-bold text-ink-40">v2</span>
          </div>
          <nav className="flex items-center gap-1 rounded-full bg-ink-5 p-1">
            {SCREENS.map((s) => (
              <button key={s.id} onClick={() => setScreen(s.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${screen === s.id ? "bg-white text-ink shadow-sm" : "text-ink-40 hover:text-ink"}`}>
                <s.icon size={14} /> {s.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        {screen === "home" && <HomeMock />}
        {screen === "customer" && <CustomerMock />}
        {screen === "checkform" && <CheckFormMock />}
      </main>

      <footer className="mx-auto max-w-5xl px-5 pb-10 pt-4 font-thai text-[12px] text-ink-40">
        ดีไซน์ทิศทาง "clinical-warm" · ไม่มี glass/aurora · Lucide icons · label อ่านง่ายอบอุ่น · ระบบสีสถานะเดียว — เทียบกับของเดิมเพื่อตัดสินใจ
      </footer>
    </div>
  );
}
