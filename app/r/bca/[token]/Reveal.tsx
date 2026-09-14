"use client";

/**
 * /r/bca/<token> — a customer's own body-composition result, phone-sized and friendly:
 * body figure with tappable zones → per-metric cards that expand with a drawing and a
 * plain explanation → numbers to play with → a 5-question self-check → guidance ranked
 * for this person (L1 lifestyle · L2 foundation nutrients · L3 what to measure) → the
 * invitation to continue with a coach. All verdicts come from the engine; nothing here
 * grades anything itself.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, MessageCircle, Sparkles } from "lucide-react";
import type { RevealScan } from "@/lib/bca-reveal/store";
import { assessScan, guidance, fatScenario, estimateBmr, tdee, proteinRange, walkingKcal, ACTIVITY, QUIZ_EMPTY, type ActivityKey, type MetricKey, type Quiz } from "@/lib/bca-reveal/engine";
import { statusHex, type StatusLevel } from "@/lib/medical-status";
import { statusTextHex } from "@/lib/v2/status";
import { BodyFigure, FatLayerArt, VisceralArt, MuscleArt, BmiArt, BmrArt, BodyAgeArt } from "./_art";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const fmtDate = (iso: string) => { const d = new Date(new Date(iso).getTime() + 7 * 3_600_000); return `${d.getUTCDate()} ${TH_MONTH[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`; };
const n1 = (v: number | null | undefined, d = 1) => (v == null ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: d }));

const META: Record<MetricKey, { title: string; what: string; why: string }> = {
  fat_pct: { title: "% ไขมัน", what: "สัดส่วนไขมันต่อน้ำหนักตัวทั้งหมด วัดจากความต้านทานไฟฟ้าของเครื่อง BCA", why: "ตัวเลขนี้บอกมากกว่าน้ำหนัก — คนน้ำหนักเท่ากันอาจมีไขมันต่างกันมาก ดูแนวโน้มทุก 4 สัปดาห์สำคัญกว่าค่าครั้งเดียว" },
  muscle_pct: { title: "% กล้ามเนื้อ", what: "สัดส่วนกล้ามเนื้อต่อน้ำหนักตัว", why: "กล้ามเนื้อคือส่วนที่เผาผลาญพลังงานและพยุงร่างกายตอนอายุมาก การลดน้ำหนักที่ดีต้องไม่เสียส่วนนี้" },
  visceral: { title: "ไขมันช่องท้อง", what: "ไขมันที่พันรอบอวัยวะภายใน ไม่ใช่ไขมันที่จับได้ที่หน้าท้อง — เครื่องรายงานเป็นคะแนน 1–30 ไม่ใช่เปอร์เซ็นต์", why: "เป็นไขมันชนิดที่เกี่ยวกับน้ำตาล ไขมันในเลือด และการอักเสบมากที่สุด — และเป็นชนิดที่ลดได้เร็วที่สุดเมื่อปรับการกินและการเดิน" },
  bmi: { title: "BMI", what: "น้ำหนักเทียบกับส่วนสูง (เกณฑ์เอเชีย-แปซิฟิก)", why: "ใช้คัดกรองคร่าว ๆ เท่านั้น ไม่แยกไขมันกับกล้ามเนื้อ — คนกล้ามเนื้อเยอะอาจ BMI สูงโดยไม่มีไขมันเกิน" },
  body_age: { title: "อายุร่างกาย", what: "อายุที่เครื่องประมาณจากองค์ประกอบร่างกาย เทียบกับอายุจริง", why: "เป็นสูตรของเครื่อง ไม่ใช่การวินิจฉัย — แต่ทิศทางที่มันขยับตามไขมันและกล้ามเนื้อของคุณเชื่อถือได้" },
  bmr: { title: "พลังงานพื้นฐาน (BMR)", what: "พลังงานที่ร่างกายใช้ต่อวันแม้นอนเฉย ๆ", why: "ยิ่งกล้ามเนื้อมาก BMR ยิ่งสูง — นี่คือเหตุผลที่การอดอาหารแล้วเสียกล้ามเนื้อทำให้กลับมาอ้วนง่าย" },
};

const chip = (l: StatusLevel | null) => ({ background: l ? `${statusHex[l]}22` : "#EEF0EE", color: l ? statusTextHex[l] : "#5F6B66" });

export function Reveal({ scan }: { scan: RevealScan }) {
  const a = useMemo(() => assessScan(scan.input), [scan]);
  const [open, setOpen] = useState<MetricKey | null>(null);
  const [target, setTarget] = useState<number>(() => Math.min(scan.input.fat_pct ?? 25, a.healthy_fat_target_pct ?? 25));
  const [activity, setActivity] = useState<ActivityKey>("light");
  const [walk, setWalk] = useState(30);
  const [quiz, setQuiz] = useState<Quiz>(QUIZ_EMPTY);
  const [quizDone, setQuizDone] = useState(false);
  const g = useMemo(() => guidance(scan.input, a, quiz), [scan, a, quiz]);
  const m = (k: MetricKey) => a.metrics.find((x) => x.key === k)!;
  const bmr = estimateBmr(scan.input);
  const total = bmr != null ? tdee(bmr, activity) : null;
  const sc = fatScenario(scan.input, target);
  const prot = proteinRange(scan.input.weight);
  const answered = Object.values(quiz).filter((v) => v != null).length;
  const hero = a.overall ? statusHex[a.overall] : "#396755";
  const pick = (k: MetricKey) => { setOpen(k); document.getElementById(`m-${k}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); };
  const lineHref = scan.customer.line_id ? `https://line.me/R/ti/p/${encodeURIComponent(scan.customer.line_id)}` : null;

  return (
    <div className="relative min-h-[100dvh] pb-10">
      <div className="aurora-bg" aria-hidden="true"><div className="aurora-orb-3" /></div>
      <main className="mx-auto w-full max-w-[430px] px-3.5 pt-4">
        {/* hero */}
        <div className="px-1">
          <div className="font-head text-[11px] font-bold uppercase tracking-[0.14em] text-wellness">UP Wellness · ผลตรวจองค์ประกอบร่างกาย</div>
          <h1 className="mt-1 font-head text-[24px] font-extrabold leading-tight tracking-tight text-ink">ร่างกายของคุณ {scan.customer.name}</h1>
          <div className="mt-0.5 font-thai text-[13px] text-ink-60">ชั่งเมื่อ {fmtDate(scan.recorded_at)}{a.gender_assumed ? " · ยังไม่ระบุเพศ ใช้เกณฑ์หญิงไปก่อน" : ""}</div>
        </div>

        <section className="liquid mt-3 rounded-[24px] p-4">
          <BodyFigure fat={m("fat_pct")} visceral={m("visceral")} muscle={m("muscle_pct")} weight={{ value: scan.input.weight }} onPick={pick} />
          <p className="mt-2 border-t border-ink-10 pt-3 font-thai text-[15px] leading-relaxed text-ink"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: hero }} />{a.headline}</p>
          <div className="mt-1 font-thai text-[12px] text-ink-60">แตะที่จุดบนตัวเพื่อดูแต่ละค่า</div>
        </section>

        {/* metric cards */}
        <h2 className="mt-5 px-1 font-head text-[17px] font-extrabold text-ink">ค่าแต่ละตัว หมายถึงอะไร</h2>
        <div className="mt-2 flex flex-col gap-2">
          {(["fat_pct", "muscle_pct", "visceral", "bmi", "body_age", "bmr"] as MetricKey[]).map((k) => {
            const v = m(k); const on = open === k;
            return (
              <div key={k} id={`m-${k}`} className={`liquid rounded-[22px] transition ${on ? "ring-1 ring-wellness/30" : ""}`}>
                <button type="button" onClick={() => setOpen(on ? null : k)} className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3 text-left">
                  <span className="font-thai text-[15px] font-semibold text-ink">{META[k].title}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-head text-[18px] font-extrabold tabular-nums text-ink">{v.value != null ? n1(v.value, k === "bmi" ? 1 : 1) : "—"}<small className="ml-0.5 text-[11px] font-semibold text-ink-60">{v.value != null ? v.unit : ""}</small></span>
                    <span className="rounded-full px-2.5 py-0.5 font-head text-[11.5px] font-bold" style={chip(v.level)}>{v.label}</span>
                    {on ? <ChevronDown className="h-4 w-4 text-wellness" /> : <ChevronRight className="h-4 w-4 text-ink-40" />}
                  </span>
                </button>
                {on && (
                  <div className="px-4 pb-4">
                    <div className="rounded-2xl bg-white/60 p-3">
                      {k === "fat_pct" && <FatLayerArt fatPct={v.value} gender={a.gender_used} level={v.level} />}
                      {k === "visceral" && <VisceralArt level={v.level} value={v.value} />}
                      {k === "muscle_pct" && <MuscleArt musclePct={v.value} gender={a.gender_used} />}
                      {k === "bmi" && <BmiArt bmi={v.value} />}
                      {k === "bmr" && <BmrArt bmr={bmr} total={total} />}
                      {k === "body_age" && (v.value != null && scan.input.age != null ? <BodyAgeArt bodyAge={v.value} age={scan.input.age} /> : <p className="font-thai text-[13px] text-ink-60">ต้องมีวันเกิดในระบบถึงเทียบกับอายุจริงได้</p>)}
                    </div>
                    <div className="mt-3 font-head text-[12px] font-bold text-wellness">คืออะไร</div>
                    <p className="font-thai text-[14.5px] leading-relaxed text-ink">{META[k].what}</p>
                    <div className="mt-2 font-head text-[12px] font-bold text-wellness">ของคุณ</div>
                    <p className="font-thai text-[14.5px] leading-relaxed text-ink">
                      {v.value == null ? "ยังไม่มีค่านี้ — ชั่งครั้งถัดไปให้ครบ" : k === "fat_pct" && a.fat_mass_kg != null ? `ไขมัน ${v.value}% ของน้ำหนัก ${n1(scan.input.weight)} kg = ไขมันประมาณ ${n1(a.fat_mass_kg)} kg และส่วนที่ไม่ใช่ไขมัน (กล้ามเนื้อ กระดูก น้ำ) ${n1(a.lean_mass_kg)} kg · เกณฑ์${a.gender_used === "male" ? "ชาย" : "หญิง"}: ${v.label}` : k === "visceral" ? `คะแนน ${v.value} (ไม่ใช่ %) = ${v.label}` : k === "body_age" && v.note ? `${v.value} ปี เทียบ${v.note} = ${v.label}` : `${v.value} ${v.unit} = ${v.label}`}
                    </p>
                    <div className="mt-2 font-head text-[12px] font-bold text-wellness">ทำไมสำคัญ</div>
                    <p className="font-thai text-[14.5px] leading-relaxed text-ink">{META[k].why}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* play */}
        <h2 className="mt-6 px-1 font-head text-[17px] font-extrabold text-ink">ลองเล่นดู — ถ้าเปลี่ยนตัวเลข จะเป็นยังไง</h2>
        <div className="mt-2 flex flex-col gap-2">
          {sc && scan.input.fat_pct != null && (
            <section className="liquid rounded-[22px] p-4">
              <div className="flex items-baseline justify-between"><span className="font-thai text-[14px] font-semibold text-ink">ถ้าไขมันลงไปที่</span><span className="font-head text-[22px] font-extrabold tabular-nums text-wellness">{target}%</span></div>
              <input type="range" min={Math.max(8, Math.floor((a.healthy_fat_target_pct ?? 25) - 8))} max={Math.ceil(scan.input.fat_pct)} step={0.5} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="mt-2 w-full accent-[#396755]" aria-label="เป้าไขมัน" />
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-white/60 p-2"><div className="font-head text-[18px] font-extrabold tabular-nums text-ink">{n1(sc.fat_to_lose_kg)}</div><div className="font-thai text-[11.5px] text-ink-60">kg ไขมันที่ต้องลด</div></div>
                <div className="rounded-2xl bg-white/60 p-2"><div className="font-head text-[18px] font-extrabold tabular-nums text-ink">{n1(sc.weight_then_kg)}</div><div className="font-thai text-[11.5px] text-ink-60">kg น้ำหนักตอนนั้น</div></div>
                <div className="rounded-2xl bg-white/60 p-2"><div className="font-head text-[18px] font-extrabold tabular-nums text-ink">{sc.weeks_at_half_kg}</div><div className="font-thai text-[11.5px] text-ink-60">สัปดาห์ (ลด 0.5 kg/สัปดาห์)</div></div>
              </div>
              <p className="mt-2 font-thai text-[12px] leading-relaxed text-ink-60">คิดแบบ "กล้ามเนื้อเท่าเดิม ลดแต่ไขมัน" — นี่คือเหตุผลที่เป้าไม่ใช่ตัวเลขบนตาชั่ง แต่คือ % ไขมัน · ช่วงที่ปลอดภัยคือ 0.25–0.5 kg/สัปดาห์</p>
            </section>
          )}
          {bmr != null && (
            <section className="liquid rounded-[22px] p-4">
              <div className="font-thai text-[14px] font-semibold text-ink">วันหนึ่งคุณใช้พลังงานประมาณเท่าไร</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{ACTIVITY.map((x) => <button key={x.key} type="button" onClick={() => setActivity(x.key)} className={`rounded-full px-3 py-1.5 font-thai text-[12.5px] ${activity === x.key ? "bg-wellness text-white" : "bg-white/60 text-ink"}`}>{x.label}</button>)}</div>
              <div className="mt-3 flex items-end justify-between"><div><div className="font-thai text-[12px] text-ink-60">ตอนพัก (BMR{scan.input.bmr == null ? " · ประมาณจากสูตร Mifflin-St Jeor" : " จากเครื่อง"})</div><div className="font-head text-[20px] font-extrabold tabular-nums text-ink">{n1(bmr, 0)} <small className="text-[11px] text-ink-60">kcal</small></div></div><div className="text-right"><div className="font-thai text-[12px] text-ink-60">ทั้งวัน</div><div className="font-head text-[26px] font-extrabold tabular-nums text-wellness">{n1(total, 0)} <small className="text-[11px] text-ink-60">kcal</small></div></div></div>
              <p className="mt-2 font-thai text-[12px] leading-relaxed text-ink-60">กินต่ำกว่านี้ราว 300–500 kcal/วันโดยโปรตีนยังพอ = ลดไขมันโดยไม่เสียกล้ามเนื้อ — ตัวเลขจริงให้โค้ชปรับตามการบันทึกอาหาร</p>
            </section>
          )}
          {prot && (
            <section className="liquid rounded-[22px] p-4">
              <div className="flex items-baseline justify-between"><span className="font-thai text-[14px] font-semibold text-ink">โปรตีนที่ควรได้ต่อวัน</span><span className="font-head text-[20px] font-extrabold tabular-nums text-wellness">{prot.low}–{prot.high} <small className="text-[11px] text-ink-60">g</small></span></div>
              <p className="mt-1 font-thai text-[12.5px] leading-relaxed text-ink-60">1.2–1.6 g ต่อน้ำหนักตัว 1 kg (PROT-AGE/ESPEN) · เทียบง่าย ๆ: อกไก่ 100 g ≈ 31 g · ไข่ 1 ฟอง ≈ 6 g · เต้าหู้แข็ง 100 g ≈ 12 g · ปลา 100 g ≈ 20 g — แบ่งให้ได้ทุกมื้อ ประมาณฝ่ามือต่อมื้อ</p>
            </section>
          )}
          {scan.input.weight != null && (
            <section className="liquid rounded-[22px] p-4">
              <div className="flex items-baseline justify-between"><span className="font-thai text-[14px] font-semibold text-ink">เดินเพิ่มวันละ</span><span className="font-head text-[20px] font-extrabold tabular-nums text-wellness">{walk} <small className="text-[11px] text-ink-60">นาที</small></span></div>
              <input type="range" min={10} max={90} step={5} value={walk} onChange={(e) => setWalk(Number(e.target.value))} className="mt-2 w-full accent-[#396755]" aria-label="นาทีเดิน" />
              <p className="mt-1 font-thai text-[13px] text-ink">≈ <b className="font-head tabular-nums">{n1(walkingKcal(scan.input.weight, walk), 0)}</b> kcal/วัน · เดือนละ ≈ <b className="font-head tabular-nums">{n1((walkingKcal(scan.input.weight, walk) ?? 0) * 30 / 7700, 1)}</b> kg ไขมัน ถ้าการกินเท่าเดิม</p>
              <p className="mt-1 font-thai text-[12px] text-ink-60">เดินเร็วปานกลาง ≈ 3.5 MET (ACSM) · ไขมัน 1 kg ≈ 7,700 kcal · เป็นค่าประมาณ ไม่ใช่สัญญา</p>
            </section>
          )}
        </div>

        {/* quiz */}
        <h2 className="mt-6 px-1 font-head text-[17px] font-extrabold text-ink">ตอบ 5 ข้อ ให้คำแนะนำตรงกับคุณขึ้น</h2>
        <section className="liquid mt-2 rounded-[22px] p-4">
          <Q label="คืนหนึ่งนอนกี่ชั่วโมง"><Opts value={quiz.sleep_h} onChange={(v) => setQuiz({ ...quiz, sleep_h: v as number })} opts={[[5, "≤5"], [6, "6"], [7, "7"], [8, "8+"]]} /></Q>
          <Q label="วันธรรมดาเดินประมาณ"><Opts value={quiz.steps} onChange={(v) => setQuiz({ ...quiz, steps: v as Quiz["steps"] })} opts={[["lt5k", "น้อยกว่า 5,000 ก้าว"], ["5to7k", "5,000–7,500"], ["gt7k", "มากกว่า 7,500"]]} /></Q>
          <Q label="มื้อส่วนใหญ่กินผักก่อนแป้งไหม"><Opts value={quiz.veg_first} onChange={(v) => setQuiz({ ...quiz, veg_first: v as boolean })} opts={[[true, "ใช่"], [false, "ไม่ค่อย"]]} /></Q>
          <Q label="เครื่องดื่มหวาน (ชานม กาแฟหวาน น้ำอัดลม)"><Opts value={quiz.sugary_drinks} onChange={(v) => setQuiz({ ...quiz, sugary_drinks: v as Quiz["sugary_drinks"] })} opts={[["none", "แทบไม่ดื่ม"], ["some", "บางวัน"], ["daily", "ทุกวัน"]]} /></Q>
          <Q label="ช่วงนี้เครียดแค่ไหน"><Opts value={quiz.stress} onChange={(v) => setQuiz({ ...quiz, stress: v as Quiz["stress"] })} opts={[["low", "น้อย"], ["mid", "ปานกลาง"], ["high", "มาก"]]} /></Q>
          <button type="button" onClick={() => { setQuizDone(true); document.getElementById("guide")?.scrollIntoView({ behavior: "smooth" }); }} disabled={answered < 3} className="mt-3 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-wellness font-head text-[15px] font-bold text-white disabled:opacity-50"><Sparkles className="h-4 w-4" />{answered < 3 ? `ตอบอีก ${3 - answered} ข้อ` : "ดูคำแนะนำของฉัน"}</button>
          <p className="mt-2 font-thai text-[11.5px] text-ink-60">คำตอบอยู่ในเครื่องคุณ ไม่ถูกส่งไปไหน — ใช้จัดลำดับคำแนะนำด้านล่างเท่านั้น</p>
        </section>

        {/* guidance */}
        <h2 id="guide" className="mt-6 px-1 font-head text-[17px] font-extrabold text-ink">แนวทางสำหรับคุณ {scan.customer.name} {quizDone ? "" : <span className="font-thai text-[12px] font-normal text-ink-60">(ยังไม่ได้ตอบแบบสอบถาม — จัดจากค่าที่วัดได้)</span>}</h2>
        <p className="mt-1 px-1 font-thai text-[13px] leading-relaxed text-ink-60">ตามพีระมิด Longevity ของ UP Wellness: <b>L1</b> ปรับการใช้ชีวิต (0 บาท · ให้ผลราว 95%) → <b>L2</b> วิตามินพื้นฐาน → <b>L3</b> วัดค่าติดตามผล</p>
        <div className="mt-2 flex flex-col gap-2">
          <Level tag="L1" title="ปรับพฤติกรรม — เริ่ม 5 ข้อนี้ก่อน" tone="green" defaultOpen>
            {g.l1.map((t, i) => <div key={t.id} className={`py-2.5 ${i ? "border-t border-ink-10" : ""}`}><div className="flex items-start gap-2"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-wellness font-head text-[11px] font-bold text-white">{i + 1}</span><div><div className="font-thai text-[15px] font-semibold text-ink">{t.title}</div><div className="font-thai text-[13px] leading-relaxed text-ink-60">{t.why}{t.source ? <span className="text-ink-40"> · {t.source}</span> : null}</div></div></div></div>)}
          </Level>
          <Level tag="L2" title="วิตามินพื้นฐาน (core) — Nutrilite ที่ตรงกับค่าของคุณ" tone="gold">
            {g.l2.map((x, i) => <div key={x.nutrient} className={`py-2.5 ${i ? "border-t border-ink-10" : ""}`}><div className="font-thai text-[15px] font-semibold text-ink">{x.nutrient}</div><div className="mt-0.5 inline-block rounded-full bg-[rgba(201,146,43,.16)] px-2.5 py-0.5 font-head text-[12px] font-bold text-[#7A5410]">{x.product}</div><div className="mt-1 font-thai text-[13px] leading-relaxed text-ink-60">{x.why}</div><div className="mt-0.5 font-thai text-[12px] text-[#7A5410]">{x.note}</div></div>)}
            <p className="mt-2 rounded-xl bg-[rgba(201,146,43,.12)] px-3 py-2 font-thai text-[12px] leading-relaxed text-[#7A5410]">ระบุผลิตภัณฑ์ Nutrilite ที่ให้สารอาหารนั้น แต่ตั้งใจไม่ระบุปริมาณ — ขนาดที่เหมาะกับคุณต้องดูผลเลือดและยาที่ใช้อยู่ก่อน ซึ่งเภสัชกรของทีมเป็นคนกำหนด</p>
          </Level>
          <Level tag="L3" title="ค่าที่ควรวัดต่อ เพื่อรู้ว่ามาถูกทาง" tone="rose">
            {g.l3.map((x, i) => <div key={x.what} className={`py-2.5 ${i ? "border-t border-ink-10" : ""}`}><div className="font-thai text-[15px] font-semibold text-ink">{x.what}</div><div className="font-thai text-[13px] leading-relaxed text-ink-60">{x.why}</div></div>)}
          </Level>
        </div>
        <p className="mt-3 px-1 font-thai text-[11.5px] leading-relaxed text-ink-60">{g.disclaimer}</p>

        {/* history */}
        {scan.history.length > 1 && (
          <section className="liquid mt-5 rounded-[22px] p-4">
            <div className="font-head text-[15px] font-bold text-ink">ครั้งก่อน ๆ</div>
            {scan.history.map((h, i) => <div key={h.at} className={`flex justify-between py-2 font-thai text-[13.5px] ${i ? "border-t border-ink-10" : ""}`}><span className="text-ink-60">{fmtDate(h.at)}</span><span className="font-head tabular-nums text-ink">{n1(h.weight)} kg · ไขมัน {n1(h.fat_pct)}% · กล้าม {n1(h.muscle_pct)}% · ช่องท้อง {h.visceral ?? "—"} คะแนน</span></div>)}
          </section>
        )}

        {/* CTA */}
        <section className="mt-5 rounded-[24px] bg-wellness p-5 text-white shadow-[0_10px_30px_rgba(57,103,85,0.3)]">
          <div className="font-head text-[18px] font-extrabold leading-tight">อยากให้ตัวเลขพวกนี้ขยับจริง ใน 90 วัน?</div>
          <p className="mt-1.5 font-thai text-[14px] leading-relaxed text-white/90">คอร์สของเราเริ่มจากผลเลือด + ค่านี้ → แผนอาหารและการใช้ชีวิตเฉพาะคุณ → ชั่งซ้ำทุก 4 สัปดาห์ → เห็นไขมันช่องท้องและกล้ามเนื้อเปลี่ยนเป็นตัวเลข ไม่ต้องเดา</p>
          <ul className="mt-2 space-y-0.5 font-thai text-[13px] text-white/85"><li>· แผน 90 วันจากค่าของคุณ โค้ชยืนยันทุกข้อ</li><li>· วิตามินพื้นฐานที่เภสัชกรคัดให้ตามผลเลือด</li><li>· หน้าติดตามผลบนมือถือ ถ่ายอาหารแล้วรู้ทันที</li></ul>
          <a href={lineHref ?? "#"} onClick={(e) => { if (!lineHref) { e.preventDefault(); alert(`ทัก${scan.customer.coach_name ? `โค้ช${scan.customer.coach_name}` : "โค้ช"}ทาง LINE ที่ส่งลิงก์นี้ให้คุณได้เลย`); } }} className="mt-4 flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-white font-head text-[15px] font-bold text-wellness"><MessageCircle className="h-4 w-4" />คุยกับ{scan.customer.coach_name ? `โค้ช${scan.customer.coach_name}` : "โค้ช"}ทาง LINE</a>
          <p className="mt-2 text-center font-thai text-[11.5px] text-white/70">ไม่มีค่าใช้จ่ายในการคุย · ผลนี้เป็นของคุณ เอาไปใช้ได้เลยแม้ไม่เข้าคอร์ส</p>
        </section>
        <p className="mt-5 text-center font-thai text-[11px] text-ink-40">UP Wellness · ใช้เพื่อการดูแลเชิงป้องกัน ไม่ใช่การวินิจฉัย · ลิงก์นี้เป็นของคุณคนเดียว</p>
      </main>
    </div>
  );
}

function Q({ label, children }: { label: string; children: React.ReactNode }) { return <div className="py-2 first:pt-0"><div className="font-thai text-[14px] font-semibold text-ink">{label}</div><div className="mt-1.5 flex flex-wrap gap-1.5">{children}</div></div>; }
function Opts<T extends string | number | boolean>({ value, onChange, opts }: { value: T | null; onChange: (v: T) => void; opts: [T, string][] }) {
  return <>{opts.map(([v, l]) => <button key={String(v)} type="button" onClick={() => onChange(v)} className={`rounded-full px-3 py-1.5 font-thai text-[12.5px] ${value === v ? "bg-wellness text-white" : "bg-white/60 text-ink"}`}>{l}</button>)}</>;
}
function Level({ tag, title, tone, defaultOpen = false, children }: { tag: string; title: string; tone: "green" | "gold" | "rose"; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const c = tone === "green" ? "bg-wellness text-white" : tone === "gold" ? "bg-[#C9922B] text-white" : "bg-rose text-white";
  return (
    <div className="liquid rounded-[22px]">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 font-head text-[11px] font-extrabold ${c}`}>{tag}</span><span className="font-thai text-[15px] font-semibold text-ink">{title}</span></span>
        {open ? <ChevronDown className="h-4 w-4 text-wellness" /> : <ChevronRight className="h-4 w-4 text-ink-40" />}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}
