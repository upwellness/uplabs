import React, { useEffect, useRef, useState } from "react";
import { ToolShell, Card, PrimaryButton, Disclaimer, StatusPill } from "../ui.jsx";

/* ---- credit-card calibration → px-per-mm ---------------------------- */
/* ISO/IEC 7810 ID-1 card = 85.6mm wide. User matches an on-screen box. */
function Calibration({ pxPerMM, setPxPerMM, onDone }) {
  const [w, setW] = useState(pxPerMM ? pxPerMM * 85.6 : 320);
  return (
    <Card>
      <h3 className="font-display text-lg font-semibold text-ink">ตั้งค่าขนาดหน้าจอก่อน</h3>
      <p className="mt-1 text-[14px] leading-relaxed text-ink2">
        หยิบ <b>บัตรประชาชนหรือบัตรเครดิต</b> มาทาบกับสี่เหลี่ยมด้านล่าง แล้วเลื่อนแถบจนกรอบ
        กว้างเท่าบัตรพอดี (เพื่อให้ตัวอักษรทดสอบมีขนาดจริง)
      </p>
      <div className="my-5 flex justify-center">
        <div className="rounded-xl border-2 border-dashed" style={{ width: w, height: w / 1.5857, borderColor: "var(--accent)", background: "var(--accent-soft)" }}>
          <div className="flex h-full items-center justify-center text-[13px] font-semibold" style={{ color: "var(--accent-strong)" }}>ทาบบัตรตรงนี้</div>
        </div>
      </div>
      <input type="range" min={200} max={520} step={1} value={w} onChange={(e) => setW(Number(e.target.value))}
        style={{ "--fill": `${((w - 200) / 320) * 100}%` }} aria-label="ปรับความกว้างให้เท่าบัตร" />
      <PrimaryButton onClick={() => { setPxPerMM(w / 85.6); onDone(); }} className="mt-4 w-full">ตั้งค่าเรียบร้อย</PrimaryButton>
    </Card>
  );
}

/* ---- near visual acuity (self-report smallest readable line) -------- */
const ACUITY_LINES = [
  { mm: 7.3, label: "20/50", letters: "H V Z" },
  { mm: 5.8, label: "20/40", letters: "N D F R" },
  { mm: 4.4, label: "20/30", letters: "Z K C T V" },
  { mm: 2.9, label: "20/20", letters: "R H S D N C" },
  { mm: 2.2, label: "20/15", letters: "K V C Z T H" },
];
function Acuity({ pxPerMM }) {
  const [pick, setPick] = useState(null);
  const res = pick == null ? null : ACUITY_LINES[pick];
  const good = pick != null && pick >= 3;
  return (
    <div>
      <p className="mb-3 text-[14px] leading-relaxed text-ink2">
        ถือมือถือห่างประมาณ <b>1 ช่วงแขน (40 ซม.)</b> ปิดตาทีละข้าง แล้วแตะบรรทัด <b>เล็กที่สุด</b> ที่ยังอ่านออกชัด
      </p>
      <Card className="!p-4">
        <div className="grid gap-3">
          {ACUITY_LINES.map((l, i) => (
            <button key={i} type="button" onClick={() => setPick(i)}
              className={"flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors " + (pick === i ? "bg-accent-soft" : "hover:bg-surface2")}
              style={pick === i ? { outline: "2px solid var(--accent)" } : undefined}>
              <span className="font-display font-bold tracking-[0.15em] text-ink" style={{ fontSize: `${l.mm * pxPerMM}px`, lineHeight: 1 }}>{l.letters}</span>
              <span className="shrink-0 text-[11px] font-semibold text-mut tabular-nums">{l.label}</span>
            </button>
          ))}
        </div>
      </Card>
      {res && (
        <div className="mt-3 rounded-xl px-4 py-3" style={{ background: good ? "var(--good-bg)" : "var(--warn-bg)", color: good ? "var(--good)" : "var(--warn)" }}>
          <span className="text-[14px] font-semibold">
            {good ? `เยี่ยม — อ่านได้ถึงระดับ ${res.label} สายตาระยะใกล้อยู่ในเกณฑ์ดี` : `อ่านได้ถึง ${res.label} — หากปกติเคยชัดกว่านี้ หรืออ่านตัวเล็กลำบาก ควรตรวจวัดสายตา`}
          </span>
        </div>
      )}
      <p className="mt-2 text-[12px] text-mut">* ผลขึ้นกับระยะถือและการตั้งค่าหน้าจอ เป็นการคัดกรองคร่าว ๆ เท่านั้น</p>
    </div>
  );
}

/* ---- pseudo-Ishihara colour plates (canvas) ------------------------- */
function ColorPlate({ digit, figure, ground, size = 240 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current, ctx = cv.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = size * dpr; cv.height = size * dpr; ctx.scale(dpr, dpr);
    /* offscreen mask of the digit */
    const mc = document.createElement("canvas"); mc.width = size; mc.height = size;
    const mx = mc.getContext("2d");
    mx.fillStyle = "#000"; mx.fillRect(0, 0, size, size);
    mx.fillStyle = "#fff";
    mx.font = `bold ${size * 0.62}px Prompt, sans-serif`;
    mx.textAlign = "center"; mx.textBaseline = "middle";
    mx.fillText(String(digit), size / 2, size / 2 + size * 0.02);
    const mask = mx.getImageData(0, 0, size, size).data;
    /* seeded pseudo-random so plates are stable across renders */
    let seed = digit * 9301 + 49297;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    ctx.clearRect(0, 0, size, size);
    const R = size / 2;
    const dots = Math.floor(size * 5.2);
    for (let i = 0; i < dots; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (R - 6);
      const x = R + r * Math.cos(a), y = R + r * Math.sin(a);
      const rad = 3 + rnd() * 4.5;
      const px = Math.floor(x), py = Math.floor(y);
      const on = mask[(py * size + px) * 4] > 128;
      const pal = on ? figure : ground;
      ctx.fillStyle = pal[Math.floor(rnd() * pal.length)];
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    }
  }, [digit, size]);
  return <canvas ref={ref} style={{ width: size, height: size, borderRadius: "50%" }} aria-label={`แผ่นทดสอบสี หมายเลข ${digit}`} />;
}

const PLATES = [
  { digit: 5, figure: ["#e08a2e", "#d97b1f", "#e89b45"], ground: ["#7f9a4e", "#8ba85a", "#6f8a44", "#9bb36b"] },
  { digit: 8, figure: ["#c96b4a", "#d97a58", "#bd5f3f"], ground: ["#7d9b7a", "#8fae8b", "#6d8a6a"] },
  { digit: 6, figure: ["#d98a3a", "#e0994f", "#cf7d29"], ground: ["#6f9488", "#80a498", "#5f8478"] },
];
function ColorTest() {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState([]);
  const plate = PLATES[i];
  const record = (ok) => {
    const next = [...answers, ok]; setAnswers(next);
    if (i + 1 < PLATES.length) setI(i + 1);
    else setI(-1);
  };
  if (i === -1) {
    const correct = answers.filter(Boolean).length;
    const good = correct === PLATES.length;
    return (
      <div className="rounded-xl px-4 py-4" style={{ background: good ? "var(--good-bg)" : "var(--warn-bg)", color: good ? "var(--good)" : "var(--warn)" }}>
        <div className="text-[15px] font-semibold">{correct}/{PLATES.length} แผ่นที่มองเห็นตัวเลขถูกต้อง</div>
        <p className="mt-1 text-[13.5px] leading-relaxed">
          {good ? "การแยกสีแดง–เขียวอยู่ในเกณฑ์ปกติ" : "มองเห็นบางแผ่นไม่ชัด — อาจเป็นภาวะตาบอดสีเล็กน้อย (พบได้ ~8% ในผู้ชาย) แนะนำตรวจยืนยันกับจักษุแพทย์ด้วยแผ่น Ishihara มาตรฐาน"}
        </p>
        <button type="button" onClick={() => { setI(0); setAnswers([]); }} className="mt-2 text-[13px] font-semibold underline">ลองใหม่</button>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-3 text-[14px] leading-relaxed text-ink2">คุณเห็นตัวเลขอะไรในวงกลม? (แผ่นที่ {i + 1}/{PLATES.length})</p>
      <div className="flex justify-center"><ColorPlate {...plate} /></div>
      <p className="mt-3 text-center text-[14px] font-semibold text-ink">คุณเห็นเลข “{plate.digit}” ชัดไหม?</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => record(true)} className="rounded-xl border-2 border-line px-4 py-3 font-display font-semibold text-ink hover:border-accent hover:bg-accent-soft">เห็นชัด</button>
        <button type="button" onClick={() => record(false)} className="rounded-xl border-2 border-line px-4 py-3 font-display font-semibold text-ink2 hover:border-mut">ไม่เห็น / ไม่แน่ใจ</button>
      </div>
    </div>
  );
}

/* ---- astigmatism fan ------------------------------------------------ */
function Astig() {
  const [ans, setAns] = useState(null);
  const lines = Array.from({ length: 18 });
  return (
    <div>
      <p className="mb-3 text-[14px] leading-relaxed text-ink2">ปิดตาทีละข้าง มองที่จุดกลาง — เส้นทุกเส้น <b>ดำเข้มเท่ากันหมด</b> หรือมีบางเส้นเข้ม/ชัดกว่าเส้นอื่น?</p>
      <div className="flex justify-center">
        <svg width="240" height="240" viewBox="0 0 240 240" role="img" aria-label="แผ่นทดสอบสายตาเอียง">
          {lines.map((_, i) => {
            const a = (i / lines.length) * Math.PI;
            const x = Math.cos(a) * 110, y = Math.sin(a) * 110;
            return <line key={i} x1={120 - x} y1={120 - y} x2={120 + x} y2={120 + y} stroke="var(--ink)" strokeWidth="2" />;
          })}
          <circle cx="120" cy="120" r="4" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setAns("even")} className={"rounded-xl border-2 px-4 py-3 font-display font-semibold " + (ans === "even" ? "border-accent bg-accent-soft text-accent-strong" : "border-line text-ink")}>เข้มเท่ากันหมด</button>
        <button type="button" onClick={() => setAns("uneven")} className={"rounded-xl border-2 px-4 py-3 font-display font-semibold " + (ans === "uneven" ? "border-accent bg-accent-soft text-accent-strong" : "border-line text-ink")}>บางเส้นเข้มกว่า</button>
      </div>
      {ans && (
        <div className="mt-3 rounded-xl px-4 py-3" style={{ background: ans === "even" ? "var(--good-bg)" : "var(--warn-bg)", color: ans === "even" ? "var(--good)" : "var(--warn)" }}>
          <span className="text-[14px] font-semibold">{ans === "even" ? "ดี — ไม่พบสัญญาณสายตาเอียงชัดเจน" : "บางเส้นเข้มกว่าอาจบ่งชี้สายตาเอียง (astigmatism) แนะนำวัดสายตากับผู้เชี่ยวชาญ"}</span>
        </div>
      )}
    </div>
  );
}

/* ---- Amsler grid ---------------------------------------------------- */
function Amsler() {
  const [ans, setAns] = useState(null);
  const n = 20, cell = 240 / n;
  return (
    <div>
      <p className="mb-3 text-[14px] leading-relaxed text-ink2">ปิดตาทีละข้าง จ้องที่ <b>จุดกลาง</b> ห่างจอ ~30 ซม. — เส้นตารางตรงและครบทุกช่องไหม หรือมีส่วนที่ <b>บิดเบี้ยว โค้ง หรือหายไป</b>?</p>
      <div className="flex justify-center">
        <svg width="240" height="240" viewBox="0 0 240 240" role="img" aria-label="ตาราง Amsler">
          {Array.from({ length: n + 1 }).map((_, i) => (
            <g key={i}>
              <line x1={i * cell} y1="0" x2={i * cell} y2="240" stroke="var(--ink)" strokeWidth="1" opacity="0.85" />
              <line x1="0" y1={i * cell} x2="240" y2={i * cell} stroke="var(--ink)" strokeWidth="1" opacity="0.85" />
            </g>
          ))}
          <circle cx="120" cy="120" r="5" fill="var(--accent)" />
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setAns("ok")} className={"rounded-xl border-2 px-4 py-3 font-display font-semibold " + (ans === "ok" ? "border-accent bg-accent-soft text-accent-strong" : "border-line text-ink")}>ตรงและครบดี</button>
        <button type="button" onClick={() => setAns("bad")} className={"rounded-xl border-2 px-4 py-3 font-display font-semibold " + (ans === "bad" ? "border-accent bg-accent-soft text-accent-strong" : "border-line text-ink")}>มีบิดเบี้ยว/หาย</button>
      </div>
      {ans && (
        <div className="mt-3 rounded-xl px-4 py-3" style={{ background: ans === "ok" ? "var(--good-bg)" : "var(--risk-bg)", color: ans === "ok" ? "var(--good)" : "var(--risk)" }}>
          <span className="text-[14px] font-semibold">{ans === "ok" ? "ดี — ไม่พบสัญญาณผิดปกติของจุดรับภาพชัด (macula)" : "เส้นบิดเบี้ยวหรือหายไปอาจเป็นสัญญาณของโรคจุดภาพชัดเสื่อม (AMD) ควรพบจักษุแพทย์เพื่อตรวจโดยเร็ว"}</span>
        </div>
      )}
    </div>
  );
}

const SUBTESTS = [
  { id: "acuity", name: "สายตาระยะใกล้", icon: "🔤" },
  { id: "color", name: "ตาบอดสี", icon: "🎨" },
  { id: "astig", name: "สายตาเอียง", icon: "✳️" },
  { id: "amsler", name: "จุดภาพชัด", icon: "🔲" },
];

export default function Vision({ pxPerMM, setPxPerMM, onBack }) {
  const [calDone, setCalDone] = useState(!!pxPerMM);
  const [tab, setTab] = useState("acuity");
  return (
    <ToolShell onBack={onBack} kicker="เครื่องมือ 3" title="ทดสอบสายตา 4 แบบ"
      accentIcon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>}>
      {!calDone ? (
        <Calibration pxPerMM={pxPerMM} setPxPerMM={setPxPerMM} onDone={() => setCalDone(true)} />
      ) : (
        <div>
          <div className="no-print mb-4 grid grid-cols-4 gap-1 rounded-xl bg-surface2 p-1" role="tablist">
            {SUBTESTS.map((s) => (
              <button key={s.id} role="tab" aria-selected={tab === s.id} onClick={() => setTab(s.id)}
                className={"rounded-lg px-1 py-2 text-center text-[12.5px] font-semibold transition-colors " + (tab === s.id ? "bg-surface text-ink shadow-card" : "text-ink2 hover:text-ink")}>
                <span className="block text-lg leading-none" aria-hidden="true">{s.icon}</span>
                <span className="mt-1 block">{s.name}</span>
              </button>
            ))}
          </div>
          <Card>
            {tab === "acuity" && <Acuity pxPerMM={pxPerMM} />}
            {tab === "color" && <ColorTest />}
            {tab === "astig" && <Astig />}
            {tab === "amsler" && <Amsler />}
          </Card>
          <button type="button" onClick={() => setCalDone(false)} className="no-print mt-3 text-[13px] font-semibold text-mut underline">ตั้งค่าขนาดหน้าจอใหม่</button>
          <Disclaimer>ชุดทดสอบนี้เป็นการคัดกรองเบื้องต้นเพื่อสร้างความตระหนัก ไม่สามารถแทนการตรวจวัดสายตาโดยจักษุแพทย์หรือผู้วัดสายตาได้ หากมีอาการผิดปกติหรือผลไม่ปกติ ควรพบผู้เชี่ยวชาญ</Disclaimer>
        </div>
      )}
    </ToolShell>
  );
}
