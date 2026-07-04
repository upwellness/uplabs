import React, { useMemo, useRef, useState } from "react";
import { diabetesScore, fmt } from "../logic.js";
import {
  ToolShell, Card, ProfileFields, bmiOf, SliderField, Toggle, Tile, StatusPill,
  PrimaryButton, Disclaimer, CountUp, reduceMotion,
} from "../ui.jsx";

export default function Diabetes({ profile, set, onBack }) {
  const [waist, setWaist] = useState(profile.sex === "m" ? 88 : 78);
  const [htn, setHtn] = useState(false);
  const [family, setFamily] = useState(false);
  const [shown, setShown] = useState(false);
  const [runId, setRunId] = useState(0);
  const resultRef = useRef(null);

  const bmi = bmiOf(profile);
  const res = useMemo(() => diabetesScore({ sex: profile.sex, age: profile.age, bmi, waist, hypertension: htn, family }), [profile.sex, profile.age, bmi, waist, htn, family]);

  const show = () => {
    setShown(true); setRunId((n) => n + 1);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" }));
  };

  const pct = (res.score / res.max) * 100;

  return (
    <ToolShell onBack={onBack} kicker="เครื่องมือ 5" title="ความเสี่ยงเบาหวานใน 12 ปี"
      accentIcon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5C12 2.5 5 10.2 5 15a7 7 0 0 0 14 0c0-4.8-7-12.5-7-12.5z" /><path d="M9.5 14.5h5" /></svg>}>
      <Card className="no-print">
        <h3 className="mb-5 font-display text-lg font-semibold text-ink">ข้อมูลของคุณ</h3>
        <div className="grid gap-5">
          <ProfileFields profile={profile} set={set} />
          <SliderField label="รอบเอว" unit="ซม." value={waist} min={50} max={150} onChange={setWaist}
            hint={profile.sex === "m" ? "(เกณฑ์ชาย 90)" : "(เกณฑ์หญิง 80)"} />
          <div className="grid gap-2">
            <Toggle checked={htn} onChange={setHtn} label="มีความดันโลหิตสูง" desc="หมอเคยบอกว่าเป็น หรือกินยาความดันอยู่" />
            <Toggle checked={family} onChange={setFamily} label="ญาติสายตรงเป็นเบาหวาน" desc="พ่อ แม่ พี่ หรือน้อง เป็นเบาหวาน" />
          </div>
          <PrimaryButton onClick={show} className="mt-1">{shown ? "ประเมินใหม่" : "ประเมินความเสี่ยง"}</PrimaryButton>
        </div>
      </Card>

      {shown && (
        <div ref={resultRef} key={runId} className="mt-8 scroll-mt-4">
          <div className="reveal grid gap-3" style={{ "--d": "0ms" }}>
            <div className="rounded-card bg-surface p-5 text-center shadow-card">
              <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-mut">คะแนนความเสี่ยง</p>
              <div className="mt-2 flex items-baseline justify-center gap-1">
                <span className="font-display text-[56px] font-bold leading-none text-ink tabular-nums"><CountUp value={res.score} /></span>
                <span className="text-xl font-semibold text-mut">/ {res.max}</span>
              </div>
              <div className="mt-3 flex justify-center"><StatusPill status={res.status} text={res.cat} /></div>
              <p className="mt-2 text-[14px] text-ink2">โอกาสเกิดเบาหวานใน 12 ปี: <span className="font-semibold text-ink">{res.risk}</span></p>
              <div className="mx-auto mt-4 h-3 max-w-[360px] overflow-hidden rounded-full bg-surface2">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: res.status === "good" ? "var(--good)" : res.status === "warn" ? "var(--warn)" : "var(--risk)" }} />
              </div>
            </div>

            <Tile eyebrow="คะแนนมาจากอะไรบ้าง" delay={70} wide>
              <ul className="grid gap-1.5">
                {res.parts.map((p) => (
                  <li key={p.k} className="flex items-center justify-between gap-3 rounded-lg bg-surface2 px-3.5 py-2">
                    <span className="text-[14px] text-ink2"><span className="font-semibold text-ink">{p.k}</span> · {p.txt}</span>
                    <span className="shrink-0 font-display text-[14px] font-bold tabular-nums" style={{ color: p.v > 0 ? "var(--ink)" : "var(--mut)" }}>+{p.v}<span className="text-[11px] font-normal text-mut"> / {p.of}</span></span>
                  </li>
                ))}
              </ul>
            </Tile>

            <Tile eyebrow="คำแนะนำสำหรับคุณ" status={res.status} delay={140} wide note={res.advice}>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ["🥗 ลดข้าว–แป้ง–ของหวาน", "โดยเฉพาะน้ำหวาน ชานมไข่มุก ขนมหวาน"],
                  ["🏃 ขยับ 150 นาที/สัปดาห์", "เดินเร็ววันละ 30 นาที 5 วัน"],
                  ["⚖️ ลดน้ำหนัก 5–7%", "ลดความเสี่ยงเบาหวานได้เกินครึ่ง"],
                  ["🩸 ตรวจน้ำตาลในเลือด", res.score >= 6 ? "ควรตรวจ FBS เร็ว ๆ นี้" : "ตรวจสุขภาพประจำปี"],
                ].map(([t, d]) => (
                  <div key={t} className="rounded-xl bg-surface2 px-4 py-3">
                    <div className="text-[14px] font-semibold text-ink">{t}</div>
                    <div className="text-[13px] text-ink2">{d}</div>
                  </div>
                ))}
              </div>
            </Tile>
          </div>
          <div className="no-print mt-3">
            <button type="button" onClick={() => window.print()} className="rounded-lg border border-line bg-surface px-3.5 py-2 text-[13.5px] font-semibold text-ink2 hover:text-ink">พิมพ์ / บันทึก PDF</button>
          </div>
          <Disclaimer>ใช้แบบประเมินความเสี่ยงเบาหวานของคนไทย (Thai Diabetes Risk Score, Aekplakorn et al., Diabetes Care 2006) เป็นเครื่องมือคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัย การยืนยันต้องตรวจระดับน้ำตาลในเลือดโดยแพทย์</Disclaimer>
        </div>
      )}
    </ToolShell>
  );
}
