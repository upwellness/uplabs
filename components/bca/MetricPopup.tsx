"use client";

/**
 * Visual-interpretation popup for one BCA metric — opened from the body scan's tappable
 * zones/chips (ต้น, 14 ก.ย.: "จิ้มที่หน้าเดียวได้เลย ไม่ต้องเลื่อน"). Same drawings the customer
 * sees at /r/bca/<token>; verdicts from lib/medical-status.ts only.
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { bandBodyFat, bandMusclePct, bandVisceralFat, bandBMI, classifyBodyAge, statusHex, STATUS_LABEL_TH, type Gender, type StatusLevel } from "@/lib/medical-status";
import { statusTextHex } from "@/lib/v2/status";
import { deriveBMI } from "@/lib/bca-derive";
import { FatLayerArt, MuscleArt, VisceralArt, BmiArt, BmrArt, BodyAgeArt } from "./BcaArt";

export type PopupKey = "bodyFat" | "muscle" | "visceral" | "bodyAge" | "bmi" | "bmr";
export const POPUP_KEYS: PopupKey[] = ["bodyFat", "muscle", "visceral", "bodyAge", "bmi", "bmr"];

export interface PopupSubject {
  sex: Gender; sexAssumed?: boolean; age: number | null; heightCm: number | null;
  m: { weight: number | null; bodyFat: number | null; visceral: number | null; muscle: number | null; bodyAge: number | null; bmr: number | null };
}

const TITLE: Record<PopupKey, string> = { bodyFat: "% ไขมัน", muscle: "% กล้ามเนื้อ", visceral: "ไขมันช่องท้อง", bodyAge: "อายุร่างกาย", bmi: "BMI", bmr: "พลังงานพื้นฐาน (BMR)" };
const WHY: Record<PopupKey, string> = {
  bodyFat: "สัดส่วนไขมันต่อน้ำหนักตัว — คนน้ำหนักเท่ากันอาจมีไขมันต่างกันมาก ดูค่านี้แทนตาชั่ง",
  muscle: "กล้ามเนื้อคือส่วนที่เผาผลาญและพยุงร่างกายตอนอายุมาก การลดน้ำหนักที่ดีต้องไม่เสียส่วนนี้",
  visceral: "ไขมันที่พันรอบอวัยวะภายใน เกี่ยวกับน้ำตาล ไขมันในเลือด และการอักเสบมากที่สุด — และลดได้เร็วที่สุดเมื่อปรับการกินและการเดิน",
  bodyAge: "เครื่องประเมินจากองค์ประกอบร่างกาย — อายุร่างกายต่ำกว่าอายุจริงคือทิศทางที่ต้องการ",
  bmi: "น้ำหนักเทียบส่วนสูง (เกณฑ์เอเชีย) — ใช้คู่กับ % ไขมัน เพราะ BMI แยกกล้ามเนื้อกับไขมันไม่ได้",
  bmr: "พลังงานที่ร่างกายใช้ตอนพักทั้งวัน — ฐานของการคิดว่าควรกินเท่าไร",
};

export function MetricPopup({ metric, subject, onClose }: { metric: PopupKey; subject: PopupSubject; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined") return null;

  const { sex, m } = subject;
  const bmi = deriveBMI(m.weight, subject.heightCm);
  let value: string | null = null, band: { level: StatusLevel; label: string } | null = null, art: React.ReactNode = null;
  switch (metric) {
    case "bodyFat": value = m.bodyFat != null ? `${m.bodyFat}%` : null; band = m.bodyFat != null ? bandBodyFat(m.bodyFat, sex) : null; art = <FatLayerArt fatPct={m.bodyFat} gender={sex} level={band?.level ?? null} />; break;
    case "muscle": value = m.muscle != null ? `${m.muscle}%` : null; band = m.muscle != null ? bandMusclePct(m.muscle, sex) : null; art = <MuscleArt musclePct={m.muscle} gender={sex} />; break;
    case "visceral": value = m.visceral != null ? `คะแนน ${m.visceral}` : null; band = m.visceral != null ? bandVisceralFat(m.visceral) : null; art = <VisceralArt level={band?.level ?? null} value={m.visceral} />; break;
    case "bodyAge": {
      value = m.bodyAge != null ? `${m.bodyAge} ปี` : null;
      if (m.bodyAge != null && subject.age != null) { const lv = classifyBodyAge(m.bodyAge, subject.age); band = { level: lv, label: `${STATUS_LABEL_TH[lv]} · ${m.bodyAge - subject.age > 0 ? `แก่กว่าอายุจริง ${m.bodyAge - subject.age} ปี` : m.bodyAge === subject.age ? "เท่าอายุจริง" : `อ่อนกว่าอายุจริง ${subject.age - m.bodyAge} ปี`}` }; }
      art = m.bodyAge != null && subject.age != null ? <BodyAgeArt bodyAge={m.bodyAge} age={subject.age} /> : <p className="font-thai text-[13px] text-ink-60">ต้องมีวันเกิดในระบบถึงเทียบกับอายุจริงได้</p>;
      break;
    }
    case "bmi": value = bmi != null ? `${bmi} kg/m²` : null; band = bmi != null ? bandBMI(bmi) : null; art = <BmiArt bmi={bmi} />; break;
    case "bmr": value = m.bmr != null ? `${Math.round(m.bmr).toLocaleString()} kcal` : null; art = <BmrArt bmr={m.bmr} total={null} />; break;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/60 p-3 backdrop-blur-sm sm:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label={`แปลผล ${TITLE[metric]}`}>
      <div className="w-full max-w-[520px] rounded-[24px] bg-[#FBF8F3] p-4 shadow-2xl sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-head text-[11px] font-bold uppercase tracking-[0.12em] text-wellness">แปลผลด้วยภาพ</div>
            <div className="mt-0.5 font-thai text-[17px] font-semibold text-ink">{TITLE[metric]}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/5 text-ink hover:bg-ink/10"><X size={18} strokeWidth={2.25} aria-hidden /></button>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-head text-[26px] font-extrabold tabular-nums text-ink">{value ?? "—"}</span>
          {band && <span className="rounded-full px-2.5 py-0.5 font-head text-[12px] font-bold" style={{ background: `${statusHex[band.level]}22`, color: statusTextHex[band.level] }}>{band.label}</span>}
          {(metric === "bodyFat" || metric === "muscle") && <span className="font-thai text-[11.5px] text-ink-60">เกณฑ์{sex === "male" ? "ชาย" : "หญิง"}{subject.sexAssumed ? " (ยังไม่ระบุเพศ)" : ""}</span>}
        </div>
        <div className="mt-3 max-h-[60vh] overflow-y-auto rounded-2xl bg-white/70 p-3">{art}</div>
        <p className="mt-3 font-thai text-[13px] leading-relaxed text-ink-60">{WHY[metric]}</p>
      </div>
    </div>,
    document.body,
  );
}
