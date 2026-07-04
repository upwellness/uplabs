import React, { useMemo, useRef, useState } from "react";
import { heartAge, SBP_BANDS, fmt } from "../logic.js";
import {
  ToolShell, Card, ProfileFields, bmiOf, OptionCards, Toggle, Tile, BigValue,
  CountUp, StatusPill, PrimaryButton, Disclaimer, reduceMotion,
} from "../ui.jsx";

/* the hero: two hearts, real age vs heart age, gap called out */
function HeartAgeHero({ realAge, hAge, gap, status }) {
  const older = gap > 0, same = gap === 0;
  const tone = same ? "var(--good)" : older ? "var(--risk)" : "var(--good)";
  return (
    <div className="rounded-card p-5 text-center" style={{ background: "var(--surface)" }}>
      <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-mut">อายุหัวใจของคุณ</p>
      <div className="mt-2 flex items-center justify-center gap-1">
        <span className="font-display text-[64px] font-bold leading-none" style={{ color: tone }}><CountUp value={hAge} /></span>
        <span className="mb-2 self-end text-lg font-semibold text-ink2">ปี</span>
      </div>
      <p className="mt-1 text-[15px] text-ink2">
        {same ? "เท่ากับอายุจริงของคุณพอดี 🎉" : older
          ? <>หัวใจคุณ “แก่กว่า” อายุจริง <b style={{ color: tone }}>{gap} ปี</b></>
          : <>หัวใจคุณ “เด็กกว่า” อายุจริง <b style={{ color: tone }}>{Math.abs(gap)} ปี</b> 🎉</>}
      </p>
      <div className="mx-auto mt-4 flex max-w-[280px] items-center justify-between text-[13px]">
        <div className="text-center"><div className="font-display text-2xl font-bold text-ink tabular-nums">{realAge}</div><div className="text-mut">อายุจริง</div></div>
        <svg width="40" height="20" viewBox="0 0 40 20" aria-hidden="true"><path d="M2 10h30M28 5l6 5-6 5" fill="none" stroke="var(--mut)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <div className="text-center"><div className="font-display text-2xl font-bold tabular-nums" style={{ color: tone }}>{hAge}</div><div className="text-mut">อายุหัวใจ</div></div>
      </div>
    </div>
  );
}

export default function Heart({ profile, set, onBack }) {
  const [sbpBand, setSbpBand] = useState("normal");
  const [treated, setTreated] = useState(false);
  const [smoke, setSmoke] = useState(false);
  const [dm, setDm] = useState(false);
  const [shown, setShown] = useState(false);
  const [runId, setRunId] = useState(0);
  const resultRef = useRef(null);

  const bmi = bmiOf(profile);
  const res = useMemo(() => heartAge({ sex: profile.sex, age: profile.age, bmi, sbpBand, treated, smoke, dm }), [profile.sex, profile.age, bmi, sbpBand, treated, smoke, dm]);
  const tooYoung = profile.age < 30;

  const show = () => {
    setShown(true); setRunId((n) => n + 1);
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" }));
  };

  return (
    <ToolShell onBack={onBack} kicker="เครื่องมือ 4" title="อายุหัวใจ & ความเสี่ยงโรคหัวใจ"
      accentIcon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.5-1.6 3-3.5 3-5.5A3.5 3.5 0 0 0 12 6 3.5 3.5 0 0 0 2 8.5c0 2 1.5 3.9 3 5.5l7 7z" /></svg>}>
      <Card className="no-print">
        <h3 className="mb-5 font-display text-lg font-semibold text-ink">ข้อมูลของคุณ</h3>
        <div className="grid gap-5">
          <ProfileFields profile={profile} set={set} />
          <OptionCards label="ความดันโลหิต (ตัวบน)" options={SBP_BANDS} value={sbpBand} onChange={setSbpBand} />
          <div className="grid gap-2">
            {sbpBand === "high1" || sbpBand === "high2" ? (
              <Toggle checked={treated} onChange={setTreated} label="กำลังกินยาลดความดันอยู่" desc="มีผลต่อการคำนวณความเสี่ยง" />
            ) : null}
            <Toggle checked={smoke} onChange={setSmoke} label="สูบบุหรี่" desc="รวมบุหรี่ไฟฟ้า หรือเพิ่งเลิกไม่ถึง 1 ปี" />
            <Toggle checked={dm} onChange={setDm} label="เป็นเบาหวาน" desc="หมอเคยวินิจฉัยว่าเป็นเบาหวาน" />
          </div>
          <PrimaryButton onClick={show} className="mt-1">{shown ? "คำนวณใหม่" : "คำนวณอายุหัวใจ"}</PrimaryButton>
        </div>
      </Card>

      {shown && (
        <div ref={resultRef} key={runId} className="mt-8 scroll-mt-4">
          {tooYoung && (
            <div className="reveal mb-3 rounded-xl px-4 py-3 text-[13.5px]" style={{ background: "var(--warn-bg)", color: "var(--warn)", "--d": "0ms" }}>
              โมเดล Framingham ออกแบบสำหรับอายุ 30–74 ปี ผลของอายุต่ำกว่านี้เป็นเพียงการประมาณคร่าว ๆ
            </div>
          )}
          <div className="reveal grid gap-3 sm:grid-cols-2" style={{ "--d": "40ms" }}>
            <div className="sm:col-span-2"><HeartAgeHero realAge={res.realAge} hAge={res.heartAge} gap={res.gap} status={res.status} /></div>
            <Tile eyebrow="ความเสี่ยงโรคหัวใจ & หลอดเลือด ใน 10 ปี" status={res.status} statusText={res.cat} delay={70} wide
              note="ประเมินโอกาสเกิดโรคหัวใจหรือหลอดเลือดสมองใน 10 ปีข้างหน้า จากโมเดล Framingham (แบบไม่ต้องเจาะเลือด ใช้ BMI)">
              <BigValue unit="%" sub={`ที่ความดันตัวบน ~${res.sbp} · BMI ${fmt(bmi, 1)}`}><CountUp value={res.risk} digits={1} /></BigValue>
              <RiskBar pct={res.risk} />
            </Tile>
            <Tile eyebrow="ลดอายุหัวใจได้อย่างไร" delay={140} wide>
              <ul className="grid gap-2 sm:grid-cols-2">
                {[
                  ["เลิกบุหรี่", "ลดความเสี่ยงหัวใจลงเร็วที่สุด เห็นผลใน 1 ปี"],
                  ["คุมความดัน < 130/80", "ลดของเค็ม ออกกำลัง ลดน้ำหนัก"],
                  ["ลดพุง / ลด BMI", "ทุก 1 หน่วย BMI ที่ลด ช่วยหัวใจ"],
                  ["ขยับ 150 นาที/สัปดาห์", "เดินเร็ว วิ่งเบา ปั่นจักรยาน"],
                ].map(([t, d]) => (
                  <li key={t} className="rounded-xl bg-surface2 px-4 py-3">
                    <div className="text-[14.5px] font-semibold text-ink">{t}</div>
                    <div className="text-[13px] text-ink2">{d}</div>
                  </li>
                ))}
              </ul>
            </Tile>
          </div>
          <div className="no-print mt-3">
            <button type="button" onClick={() => window.print()} className="rounded-lg border border-line bg-surface px-3.5 py-2 text-[13.5px] font-semibold text-ink2 hover:text-ink">พิมพ์ / บันทึก PDF</button>
          </div>
          <Disclaimer>คำนวณด้วยโมเดล Framingham General CVD Risk (D'Agostino, 2008) แบบไม่ใช้ผลเลือด — พัฒนาจากประชากรสหรัฐฯ จึงเป็นการประมาณเพื่อการศึกษา ไม่ใช่การวินิจฉัย ค่าจริงควรใช้ Thai CV Risk Score ร่วมกับผลตรวจเลือดและการวัดความดันโดยบุคลากรทางการแพทย์</Disclaimer>
        </div>
      )}
    </ToolShell>
  );
}

function RiskBar({ pct }) {
  const bands = [[0, 10, "var(--good-bg)"], [10, 20, "var(--warn-bg)"], [20, 30, "var(--risk-bg)"], [30, 40, "var(--risk-bg)"]];
  const pos = Math.min(40, Math.max(0, pct)) / 40 * 100;
  return (
    <div className="mt-3">
      <div className="relative h-3 w-full overflow-hidden rounded-full">
        {bands.map((b, i) => <div key={i} className="absolute inset-y-0" style={{ left: `${(b[0] / 40) * 100}%`, width: `${((b[1] - b[0]) / 40) * 100}%`, background: b[2], opacity: i === 3 ? 0.75 : 1 }} />)}
        <div className="absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full" style={{ left: `calc(${pos}% - 1.5px)`, background: "var(--ink)" }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-mut tabular-nums"><span>ต่ำ</span><span>10%</span><span>20%</span><span>30%+</span></div>
    </div>
  );
}
