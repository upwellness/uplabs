import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Screening from "./tools/Screening.jsx";
import Hearing from "./tools/Hearing.jsx";
import Vision from "./tools/Vision.jsx";
import Heart from "./tools/Heart.jsx";
import Diabetes from "./tools/Diabetes.jsx";

const icon = (d, extra) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}{extra}</svg>
);

const TOOLS = [
  { id: "screening", n: "1", name: "เช็กสุขภาพ 60 วิ", desc: "BMI · พลังงาน · โปรตีน · น้ำ · โซนหัวใจ", time: "1 นาที",
    icon: icon(<path d="M3 12h4l2 5 4-12 2 7h6" />) },
  { id: "heart", n: "4", name: "อายุหัวใจ", desc: "หัวใจคุณแก่กว่าอายุจริงไหม + ความเสี่ยง 10 ปี", time: "1 นาที", star: true,
    icon: icon(<path d="M19 14c1.5-1.6 3-3.5 3-5.5A3.5 3.5 0 0 0 12 6 3.5 3.5 0 0 0 2 8.5c0 2 1.5 3.9 3 5.5l7 7z" />) },
  { id: "diabetes", n: "5", name: "เสี่ยงเบาหวาน 12 ปี", desc: "แบบประเมินคนไทย ไม่ต้องเจาะเลือด", time: "40 วิ",
    icon: icon(<><path d="M12 2.5C12 2.5 5 10.2 5 15a7 7 0 0 0 14 0c0-4.8-7-12.5-7-12.5z" /><path d="M9.5 14.5h5" /></>) },
  { id: "hearing", n: "2", name: "ทดสอบอายุหู", desc: "ฟังเสียงแหลม รู้ว่าหูคุณอายุเท่าไหร่", time: "1 นาที", star: true,
    icon: icon(<><path d="M6 8a6 6 0 0 1 12 0c0 3-2 4-3 6s-1 4-4 4a3 3 0 0 1-3-3" /><path d="M9 8a3 3 0 0 1 5 2" /></>) },
  { id: "vision", n: "3", name: "ทดสอบสายตา 4 แบบ", desc: "สายตาใกล้ · ตาบอดสี · สายตาเอียง · จุดภาพชัด", time: "2 นาที",
    icon: icon(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>) },
];

function ThemeToggle() {
  return (
    <button type="button" onClick={() => {
      const el = document.documentElement;
      const dark = el.dataset.theme === "dark" || (!el.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
      el.dataset.theme = dark ? "light" : "dark";
    }}
      className="no-print grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink2 shadow-card transition-colors hover:text-ink"
      aria-label="สลับโหมดสว่าง/มืด" title="สลับโหมดสว่าง/มืด">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
      </svg>
    </button>
  );
}

function Hub({ go }) {
  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">Upwellness · Health Lab</p>
          <h1 className="mt-1 font-display text-[30px] font-bold leading-tight text-ink sm:text-[38px]" style={{ textWrap: "balance" }}>
            <span className="whitespace-nowrap">เช็กสุขภาพตัวเอง</span>{" "}<span className="whitespace-nowrap">แบบ ว้าว</span>
          </h1>
          <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-ink2">
            เครื่องมือคัดกรองสุขภาพเบื้องต้น 5 อย่าง เล่นได้ฟรีในเบราว์เซอร์ ไม่ต้องลงแอป ไม่เก็บข้อมูล
            เลือกเครื่องมือที่อยากลองได้เลย
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div className="mb-6 overflow-hidden" aria-hidden="true">
        <svg viewBox="0 0 640 40" className="w-full" preserveAspectRatio="none" style={{ height: 34 }}>
          <path className="pulse-line" d="M0 20 H210 L228 20 238 6 250 34 260 14 268 20 H340 L356 20 366 9 377 31 386 17 393 20 H640"
            fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
        </svg>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TOOLS.map((t, i) => (
          <button key={t.id} type="button" onClick={() => go(t.id)}
            className="reveal group flex items-start gap-4 rounded-card bg-surface p-5 text-left shadow-card transition-transform hover:-translate-y-0.5"
            style={{ "--d": `${i * 60}ms` }}>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-colors" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>{t.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-[17px] font-semibold text-ink">{t.name}</h2>
                {t.star && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>ยอดฮิต</span>}
              </div>
              <p className="mt-0.5 text-[13.5px] leading-snug text-ink2">{t.desc}</p>
              <p className="mt-2 text-[12px] font-semibold text-mut">⏱ {t.time}</p>
            </div>
            <svg className="mt-1 shrink-0 text-mut transition-transform group-hover:translate-x-0.5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        ))}
      </div>

      <footer className="mt-10 border-t border-line pt-5 text-center text-[12.5px] text-mut">
        จัดทำโดย Upwellness — แจกฟรีในงานสัมมนา · เครื่องมือคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัยทางการแพทย์ · ไม่มีการเก็บหรือส่งข้อมูลของคุณ
      </footer>
    </div>
  );
}

function App() {
  const [route, setRoute] = useState("hub");
  const [profile, setProfile] = useState({ sex: "f", age: 35, height: 162, weight: 60 });
  const [pxPerMM, setPxPerMM] = useState(null);
  const set = (patch) => setProfile((p) => ({ ...p, ...patch }));
  const go = (r) => { setRoute(r); requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" })); };
  const back = () => go("hub");

  return (
    <div className="mx-auto max-w-hub px-4 pb-16 pt-6 sm:px-6">
      {route === "hub" && <Hub go={go} />}
      {route === "screening" && <Screening profile={profile} set={set} onBack={back} />}
      {route === "hearing" && <Hearing onBack={back} />}
      {route === "vision" && <Vision pxPerMM={pxPerMM} setPxPerMM={setPxPerMM} onBack={back} />}
      {route === "heart" && <Heart profile={profile} set={set} onBack={back} />}
      {route === "diabetes" && <Diabetes profile={profile} set={set} onBack={back} />}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
