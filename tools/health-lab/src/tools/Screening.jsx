import React, { useMemo, useRef, useState } from "react";
import { fmt, screening, bmiInfo, whtrInfo, bodyFatInfo, ACTIVITIES, GOALS } from "../logic.js";
import {
  ToolShell, Card, ProfileFields, Segmented, SliderField, OptionCards, Toggle,
  Tile, BigValue, CountUp, StatusPill, PrimaryButton, Disclaimer, reduceMotion,
} from "../ui.jsx";

function BmiGauge({ bmi }) {
  const W = 300, H = 172, cx = 150, cy = 150, R = 116, SW = 16, DOM = [15, 35];
  const toAngle = (v) => 180 - (Math.min(35, Math.max(15, v)) - DOM[0]) / (DOM[1] - DOM[0]) * 180;
  const pt = (a, r = R) => [cx + r * Math.cos((a * Math.PI) / 180), cy - r * Math.sin((a * Math.PI) / 180)];
  const arc = (v0, v1) => {
    const G = 1.6, a0 = toAngle(v0) - G, a1 = toAngle(v1) + G;
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const bands = [[15, 18.5, "var(--warn-bg)"], [18.5, 23, "var(--good-bg)"], [23, 25, "var(--warn-bg)"], [25, 35, "var(--risk-bg)"]];
  const [mx, my] = pt(toAngle(bmi));
  return (
    <div className="mx-auto w-full max-w-[320px]">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`BMI ${fmt(bmi, 1)}`} className="w-full">
        {bands.map((b, i) => <path key={i} d={arc(b[0], b[1])} stroke={b[2]} strokeWidth={SW} strokeLinecap="round" fill="none" />)}
        {[18.5, 23, 25].map((t) => { const [tx, ty] = pt(toAngle(t), R + SW / 2 + 12); return <text key={t} x={tx} y={ty} textAnchor="middle" fontSize="11" fill="var(--mut)" fontFamily="Anuphan, sans-serif">{t}</text>; })}
        <circle cx={mx} cy={my} r="9" fill="var(--ink)" stroke="var(--surface)" strokeWidth="3.5" />
        <text x={cx} y={cy - 34} textAnchor="middle" fontFamily="Prompt, sans-serif" fontWeight="700" fontSize="46" fill="var(--ink)">{fmt(bmi, 1)}</text>
        <text x={cx} y={cy - 12} textAnchor="middle" fontSize="13" fill="var(--ink2)" fontFamily="Anuphan, sans-serif">BMI (เกณฑ์คนเอเชีย)</text>
      </svg>
    </div>
  );
}

function WhtrBar({ value }) {
  const DOM = [0.35, 0.7];
  const pos = ((Math.min(0.7, Math.max(0.35, value)) - DOM[0]) / (DOM[1] - DOM[0])) * 100;
  const seg = (v0, v1) => ({ left: ((v0 - DOM[0]) / (DOM[1] - DOM[0])) * 100 + "%", width: ((v1 - v0) / (DOM[1] - DOM[0])) * 100 + "%" });
  return (
    <div className="mt-3">
      <div className="relative h-3 w-full">
        <div className="absolute inset-y-0 rounded-l-full" style={{ ...seg(0.35, 0.5), background: "var(--good-bg)" }} />
        <div className="absolute inset-y-0" style={{ ...seg(0.502, 0.6), background: "var(--warn-bg)" }} />
        <div className="absolute inset-y-0 rounded-r-full" style={{ ...seg(0.602, 0.7), background: "var(--risk-bg)" }} />
        <div className="absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full" style={{ left: `calc(${pos}% - 1.5px)`, background: "var(--ink)" }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-mut tabular-nums"><span>0.35</span><span>0.50</span><span>0.60</span><span>0.70</span></div>
    </div>
  );
}

function HrZones({ hrMax }) {
  const zones = [["Z1", 50, 60, "วอร์มอัพ"], ["Z2", 60, 70, "เผาผลาญไขมัน"], ["Z3", 70, 80, "แอโรบิก"], ["Z4", 80, 90, "หนัก"], ["Z5", 90, 100, "สูงสุด"]];
  return (
    <div className="mt-3 grid gap-1">
      {zones.map((z, i) => {
        const lo = Math.round((hrMax * z[1]) / 100), hi = Math.round((hrMax * z[2]) / 100), hot = i === 1;
        return (
          <div key={z[0]} className={"flex items-center justify-between rounded-lg px-3 py-1.5 text-[13px] " + (hot ? "font-semibold" : "")}
            style={{ background: hot ? "var(--accent-soft)" : "var(--surface2)", color: hot ? "var(--accent-strong)" : "var(--ink2)" }}>
            <span className="flex items-center gap-2"><span className="font-display text-xs font-semibold tabular-nums">{z[0]}</span>{z[3]}</span>
            <span className="tabular-nums">{lo}–{hi} ครั้ง/นาที</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Screening({ profile, set, onBack }) {
  const [waistOn, setWaistOn] = useState(false);
  const [waist, setWaist] = useState(80);
  const [act, setAct] = useState(1);
  const [goal, setGoal] = useState("fit");
  const [shown, setShown] = useState(false);
  const [runId, setRunId] = useState(0);
  const resultRef = useRef(null);

  const r = useMemo(() => screening({ ...profile, waist: waistOn ? waist : null, act, goal }), [profile, waist, waistOn, act, goal]);
  const bmiI = bmiInfo(r.bmi);
  const whtrI = r.whtr ? whtrInfo(r.whtr, profile.sex, waist) : null;
  const bfI = bodyFatInfo(r.bodyFat, profile.sex);

  const show = () => {
    setShown(true); setRunId((n) => n + 1);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" }));
  };
  const D = (i) => i * 70;

  return (
    <ToolShell onBack={onBack} kicker="เครื่องมือ 1" title="เช็กสุขภาพเบื้องต้นใน 60 วินาที"
      accentIcon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2 5 4-12 2 7h6" /></svg>}>
      <Card className="no-print">
        <h3 className="mb-5 font-display text-lg font-semibold text-ink">ข้อมูลของคุณ</h3>
        <div className="grid gap-5">
          <ProfileFields profile={profile} set={set} />
          <Toggle checked={waistOn} onChange={setWaistOn} label="วัดรอบเอวมาด้วย (แนะนำ)"
            desc="วัดผ่านสะดือขณะหายใจออก — บอกความเสี่ยงอ้วนลงพุงได้ดีกว่า BMI" />
          {waistOn && <SliderField label="รอบเอว" unit="ซม." value={waist} min={50} max={150} onChange={setWaist} />}
          <OptionCards label="กิจกรรมในแต่ละสัปดาห์" options={ACTIVITIES} value={act} onChange={setAct} />
          <OptionCards label="เป้าหมายของคุณ" options={GOALS.map((g, i) => ({ ...g, id: g.id }))} value={goal} onChange={setGoal} />
          <PrimaryButton onClick={show} className="mt-1">{shown ? "อัปเดตผลของฉัน" : "ดูผลของฉัน"}</PrimaryButton>
        </div>
      </Card>

      {shown && (
        <div ref={resultRef} key={runId} className="mt-8 scroll-mt-4">
          <div className="reveal mb-4 flex items-end justify-between gap-3" style={{ "--d": "0ms" }}>
            <h3 className="font-display text-[20px] font-bold text-ink">ผลเช็กอัปของคุณ</h3>
            <button type="button" onClick={() => window.print()} className="no-print rounded-lg border border-line bg-surface px-3.5 py-2 text-[13.5px] font-semibold text-ink2 hover:text-ink">พิมพ์ / บันทึก PDF</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Tile eyebrow="ดัชนีมวลกาย" status={bmiI.status} statusText={bmiI.cat} note={bmiI.advice} delay={D(0)} wide>
              <BmiGauge bmi={r.bmi} />
              <p className="mt-1 text-center text-[13px] text-mut">น้ำหนักที่เหมาะกับส่วนสูง: <span className="font-semibold text-ink2 tabular-nums">{fmt(r.idealLo)}–{fmt(r.idealHi)} กก.</span></p>
            </Tile>
            {whtrI && (
              <Tile eyebrow="รอบเอว ÷ ส่วนสูง" status={whtrI.status} statusText={whtrI.cat} note={whtrI.advice} delay={D(1)} wide>
                <BigValue sub="เป้าหมาย: น้อยกว่า 0.50"><CountUp value={r.whtr} digits={2} /></BigValue>
                <WhtrBar value={r.whtr} />
              </Tile>
            )}
            <Tile eyebrow="BMR · พลังงานขั้นต่ำ" note="พลังงานที่ร่างกายใช้ตอนพัก (Mifflin–St Jeor) — ไม่ควรกินต่ำกว่านี้นาน ๆ" delay={D(2)}>
              <BigValue unit="กิโลแคลอรี่/วัน"><CountUp value={r.bmr} /></BigValue>
            </Tile>
            <Tile eyebrow="TDEE · ที่ใช้จริงต่อวัน" note="รวมกิจกรรมแล้ว — กินเท่านี้น้ำหนักคงที่" delay={D(3)}>
              <BigValue unit="กิโลแคลอรี่/วัน"><CountUp value={r.tdee} /></BigValue>
            </Tile>
            <Tile eyebrow="เป้าพลังงานตามเป้าหมาย" delay={D(4)} wide
              note={goal === "lose" ? "ลดจาก TDEE ~500 กิโลแคลอรี่/วัน ≈ ลดไขมัน 0.5 กก./สัปดาห์" : goal === "gain" ? "เกินจาก TDEE ~300 กิโลแคลอรี่/วัน + เวทเทรนนิ่ง" : "กินใกล้ TDEE โฟกัสคุณภาพ: โปรตีนพอ ผักครึ่งจาน ลดหวาน–มัน–เค็ม"}>
              <div className="grid grid-cols-3 gap-2">
                {[["lose", "ลดไขมัน", r.kcalLose], ["fit", "คงน้ำหนัก", r.tdee], ["gain", "เพิ่มกล้าม", r.kcalGain]].map(([id, name, v]) => {
                  const hot = id === goal;
                  return (
                    <div key={id} className="rounded-xl px-3 py-3 text-center" style={{ background: hot ? "var(--accent-soft)" : "var(--surface2)", outline: hot ? "2px solid var(--accent)" : "none" }}>
                      <div className="text-[12.5px] font-semibold" style={{ color: hot ? "var(--accent-strong)" : "var(--ink2)" }}>{name}{hot ? " ✓" : ""}</div>
                      <div className="mt-0.5 font-display text-[22px] font-bold text-ink tabular-nums">{hot ? <CountUp value={v} /> : fmt(v)}</div>
                      <div className="text-[11.5px] text-mut">กิโลแคลอรี่/วัน</div>
                    </div>
                  );
                })}
              </div>
            </Tile>
            <Tile eyebrow="โปรตีนต่อวัน" delay={D(5)}
              note={`คิดที่ ${r.protein[0]}–${r.protein[1]} กรัม/กก. ≈ ไข่ ${fmt(r.pLo / 7)}–${fmt(r.pHi / 7)} ฟอง (รวมหลายแหล่งได้)`}>
              <BigValue unit="กรัม"><CountUp value={r.pLo} />–{fmt(r.pHi)}</BigValue>
            </Tile>
            <Tile eyebrow="น้ำดื่มต่อวัน" delay={D(6)} note={`≈ ${fmt(r.water / 250)} แก้ว (250 มล.) — เพิ่มเมื่อออกกำลังหรืออากาศร้อน`}>
              <BigValue unit="ลิตร"><CountUp value={r.water / 1000} digits={1} /></BigValue>
            </Tile>
            <Tile eyebrow="ไขมันร่างกาย (ประมาณ)" status={bfI.status} delay={D(7)} note={`${bfI.note} — คำนวณจาก BMI+อายุ (Deurenberg) เป็นค่าคร่าว ๆ วัด InBody จะแม่นกว่า`}>
              <BigValue unit="%"><CountUp value={r.bodyFat} digits={1} /></BigValue>
            </Tile>
            <Tile eyebrow="โซนหัวใจของคุณ" delay={D(8)} note={`หัวใจสูงสุด ~${fmt(r.hrMax)} ครั้ง/นาที (Tanaka) — Zone 2 คือช่วงเผาผลาญไขมันที่ยั่งยืนที่สุด`}>
              <BigValue unit="ครั้ง/นาที" sub="Zone 2 · เผาผลาญไขมัน"><CountUp value={r.zone2[0]} />–{fmt(r.zone2[1])}</BigValue>
              <HrZones hrMax={r.hrMax} />
            </Tile>
          </div>
          <Disclaimer>ค่า BMI ใช้เกณฑ์ WHO เอเชีย-แปซิฟิก, พลังงานคำนวณด้วย Mifflin–St Jeor, อัตราหัวใจสูงสุดด้วย Tanaka — เป็นความรู้เบื้องต้น ไม่ใช่การวินิจฉัยทางการแพทย์</Disclaimer>
        </div>
      )}
    </ToolShell>
  );
}
