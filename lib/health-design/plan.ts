/**
 * UP Health Design — Design Engine (SPEC-Health-Design.md §3.3)
 *
 * Turns the latest assessment into a DRAFT care plan. The draft is a starting
 * point for the coach, never a message to the customer: nothing here is shown to a
 * customer until a coach confirms it in the app, and the supplement section is
 * whatever the pharmacist scheduled — this engine does not propose supplements.
 *
 * Pure. Numbers come from the assessment's drivers; targets come from the same
 * guidelines the assessment cites (band upper bounds, AASM sleep, Tudor-Locke steps,
 * WHO 2020 resistance training, PROT-AGE protein, DPP 5% weight loss).
 */
import type { HealthAssessment, Driver, DomainKey, Level } from "./assess";
import { DOMAIN_LABEL_TH } from "./assess";
import { calcTargets, buildPlan, type Goal, type DayPlan, type Targets, type PlanConfig } from "@/lib/plate-planner/engine";

export const PLAN_VERSION = "1.0.0";

export interface PlanInput {
  assessment: HealthAssessment;
  assessment_id: string | null;
  customer: { gender: "male" | "female" | null; age: number | null; weight: number | null; height_cm: number | null };
  /** From plate_plan_config when the coach already set one; otherwise derived from the assessment. */
  goal?: Goal | null;
  planConfig?: PlanConfig | null;
  /** The pharmacist's schedule (supplement_schedule rows) — displayed, never generated. */
  supplements: { meal_slot: string; items: string[] }[] | null;
  today: string;
}

export interface Goal90 { domain: DomainKey; target: string; why: string; measure: string; level: Level }
export interface LifestyleItem { area: "sleep" | "steps" | "resistance" | "food_log" | "cgm"; current: string | null; target: string; why: string }
export interface RetestItem { what: string; when_days: number; why: string }
export interface DoctorFlag { domain: DomainKey; metric: string; label_th: string; value: string; message: string }

export interface HealthPlan {
  plan_version: string;
  based_on_assessment_id: string | null;
  generated_at: string;
  goal: Goal;
  goal_reason: string;
  goals_90d: Goal90[];
  nutrition: {
    targets: (Targets & { protein_g_per_kg: number | null }) | null;
    sample_days: DayPlan[];          // 7 days from the Plate Planner engine, empty when weight/height unknown
    notes: string[];
  };
  lifestyle: LifestyleItem[];
  supplements: { source: "pharmacist"; schedule: { meal_slot: string; items: string[] }[] | null; note: string };
  retest: RetestItem[];
  doctor_flags: DoctorFlag[];
  caveats: string[];
  disclaimer: string;
}

export const PLAN_DISCLAIMER =
  "แผนนี้เป็นร่างเพื่อการดูแลเชิงป้องกัน ไม่ใช่การรักษา · โค้ชต้องตรวจและยืนยันก่อนส่งถึงลูกค้า · อาหารเสริมเป็นไปตามที่เภสัชกรจัดเท่านั้น · ค่าที่ติดธง 'ควรปรึกษาแพทย์' ให้แพทย์เป็นผู้ตรวจเพิ่ม";

const CLINICAL = ["metabolic", "cardio_lipid", "liver_kidney"] as const;
const fmt = (d: Driver) => `${d.label_th} ${d.value}${d.unit ? ` ${d.unit}` : ""}`;
const find = (a: HealthAssessment, domain: Exclude<DomainKey, "health_age">, metric: string) => a.domains[domain].drivers.find((d) => d.metric === metric) ?? null;

/** Which Plate Planner goal fits: weight/fat first, then muscle, else longevity. */
export function deriveGoal(a: HealthAssessment, gender: "male" | "female" | null): { goal: Goal; reason: string } {
  const fat = find(a, "body_comp", "fat_pct"), bmi = find(a, "body_comp", "bmi"), visc = find(a, "body_comp", "visceral"), muscle = find(a, "body_comp", "muscle_pct");
  if ((fat && fat.level === "attention") || (bmi && bmi.level === "attention") || (visc && visc.level === "attention")) {
    return { goal: "loss", reason: `ไขมัน/BMI/ไขมันช่องท้องอยู่ในช่วงต้องดูแล (${[fat, bmi, visc].filter((d): d is Driver => !!d && d.level === "attention").map(fmt).join(" · ")})` };
  }
  if (muscle && muscle.level === "attention") return { goal: "muscle", reason: `กล้ามเนื้อต่ำ (${fmt(muscle)}) — สร้างกล้ามเนื้อก่อน` };
  return { goal: "longevity", reason: "องค์ประกอบร่างกายอยู่ในเกณฑ์ — เน้นชะลอวัยและรักษามวลกล้ามเนื้อ" };
}

function goals90(a: HealthAssessment, gender: "male" | "female" | null): Goal90[] {
  const out: Goal90[] = [];
  for (const p of a.priorities) {
    if (p.domain === "health_age") continue;
    const d = a.domains[p.domain];
    const flagged = d.drivers.filter((x) => x.level === p.level);
    switch (p.domain) {
      case "body_comp": {
        const fat = find(a, "body_comp", "fat_pct"); const visc = find(a, "body_comp", "visceral"); const bmi = find(a, "body_comp", "bmi");
        const parts: string[] = [];
        if (fat && fat.level !== "good") parts.push(`ไขมัน → ต่ำกว่า ${gender === "male" ? 20 : 30}%`);
        if (visc && visc.level !== "good") parts.push("ไขมันช่องท้อง → ≤ 9");
        if (bmi && bmi.level !== "good") parts.push("น้ำหนักลง 3–5% ใน 90 วัน");
        out.push({ domain: p.domain, level: p.level, target: parts.join(" · ") || "รักษาองค์ประกอบร่างกาย", why: p.why,
          measure: "ชั่ง BCA ทุก 2–4 สัปดาห์ · ลด 3–5% ภายใน 90 วันคือระดับที่งานวิจัย DPP พบว่ามีผลต่อสุขภาพเมตาบอลิก" });
        break;
      }
      case "metabolic": {
        const a1c = find(a, "metabolic", "hba1c"); const fbs = find(a, "metabolic", "fbs"); const tir = find(a, "metabolic", "cgm_tir");
        const parts: string[] = [];
        if (a1c && a1c.level !== "good") parts.push("HbA1c → ต่ำกว่า 5.7%");
        if (fbs && fbs.level !== "good") parts.push("น้ำตาลอดอาหาร → ต่ำกว่า 100 mg/dL");
        if (tir && tir.level === "watch") parts.push("เวลาในเป้า (TIR) → ≥ 70%");
        out.push({ domain: p.domain, level: p.level, target: parts.join(" · ") || "รักษาระดับน้ำตาลให้อยู่ในเป้า", why: p.why,
          measure: "HbA1c ตรวจซ้ำที่ 90 วัน · CGM 14 วันเทียบ TIR/CV ก่อน-หลัง" });
        break;
      }
      case "cardio_lipid": {
        const parts: string[] = [];
        for (const x of flagged) {
          if (x.metric === "ldl") parts.push("LDL → ต่ำกว่า 130 mg/dL");
          if (x.metric === "triglyceride") parts.push("ไตรกลีเซอไรด์ → ต่ำกว่า 150 mg/dL");
          if (x.metric === "hdl") parts.push("HDL → 40 mg/dL ขึ้นไป");
          if (x.metric === "cholesterol") parts.push("คอเลสเตอรอลรวม → ต่ำกว่า 200 mg/dL");
          if (x.metric.includes("crp")) parts.push("hs-CRP → ต่ำกว่า 1 mg/L");
        }
        out.push({ domain: p.domain, level: p.level, target: parts.join(" · ") || "รักษาระดับไขมันในเลือด", why: p.why, measure: "ตรวจไขมันซ้ำที่ 90 วัน" });
        break;
      }
      case "liver_kidney":
        out.push({ domain: p.domain, level: p.level, target: flagged.map((x) => `${x.label_th} กลับเข้าช่วงปกติ`).join(" · "), why: p.why, measure: "ตรวจตับ/ไตซ้ำที่ 90 วัน (หรือเร็วกว่าตามที่แพทย์กำหนด)" });
        break;
      case "recovery":
        out.push({ domain: p.domain, level: p.level, target: "นอน ≥ 7 ชม./คืน · เดิน ≥ 7,500 ก้าว/วัน", why: p.why, measure: "ค่าเฉลี่ยจากนาฬิกา 14 วัน" });
        break;
      case "nutrition":
        out.push({ domain: p.domain, level: p.level, target: "บันทึกอาหาร ≥ 4 วัน/สัปดาห์ · โปรตีน ≥ 1.2 g/kg/วัน", why: p.why, measure: "coverage และโปรตีนเฉลี่ยจากบันทึกอาหาร" });
        break;
    }
  }
  return out.slice(0, 3);
}

function lifestyle(a: HealthAssessment): LifestyleItem[] {
  const out: LifestyleItem[] = [];
  const sleep = find(a, "recovery", "sleep"), steps = find(a, "recovery", "steps");
  out.push({ area: "sleep", current: sleep ? `${sleep.value} ชม./คืน` : null, target: "7–9 ชม./คืน เวลานอน-ตื่นคงที่", why: "AASM: ผู้ใหญ่ต้องการ ≥7 ชม. · การนอนสั้นสัมพันธ์กับน้ำตาลและความอยากอาหารที่แย่ลง" });
  out.push({ area: "steps", current: steps ? `${steps.value} ก้าว/วัน` : null, target: "≥ 7,500 ก้าว/วัน (เริ่มจาก +1,000 จากปัจจุบัน)", why: "Tudor-Locke 2011: <5,000 = นั่งเยอะ · 7,500+ = active" });
  out.push({ area: "resistance", current: null, target: "ฝึกแรงต้าน 2 ครั้ง/สัปดาห์ กล้ามเนื้อมัดใหญ่", why: "WHO 2020: ≥2 วัน/สัปดาห์ · รักษามวลกล้ามเนื้อ = แกนของ Muscle-Centric" });
  const cov = find(a, "nutrition", "food_coverage");
  if (!cov || cov.level !== "good") out.push({ area: "food_log", current: cov ? `${cov.value} วัน` : "ยังไม่บันทึก", target: "บันทึกอาหาร ≥ 4 วัน/สัปดาห์ (ถ่ายรูปหรือพิมพ์)", why: "ต่ำกว่านี้ระบบสรุปนิสัยการกินไม่ได้" });
  const gap = a.data_gaps.find((g) => g.source === "cgm");
  if (gap) out.push({ area: "cgm", current: null, target: "ติด CGM ต่อเนื่อง 14 วัน", why: gap.reason });
  return out;
}

function retest(a: HealthAssessment, today: string): RetestItem[] {
  const out: RetestItem[] = [];
  const panelGap = a.data_gaps.find((g) => g.source === "labs_panel");
  if (panelGap) out.push({ what: panelGap.reason.replace("ยังไม่เคยตรวจ: ", "ตรวจเพิ่ม: "), when_days: 30, why: "ค่าที่ขาดทำให้ประเมินบางด้านไม่ได้ (รวมอายุสุขภาพ)" });
  if (!a.sources_used.includes("labs")) out.push({ what: "ตรวจแล็บชุดพื้นฐาน (น้ำตาล ไขมัน ตับ ไต CBC hs-CRP)", when_days: 30, why: "ยังไม่มีผลแล็บในระบบ" });
  const stale = a.caveats.find((c) => /ผลแล็บล่าสุดอายุ (\d+) วัน/.test(c));
  if (stale) out.push({ what: "ตรวจแล็บซ้ำทั้งชุด", when_days: 30, why: stale });
  for (const dk of CLINICAL) { const d = a.domains[dk]; if (d.level && d.level !== "good") out.push({ what: `ตรวจซ้ำ: ${d.drivers.filter((x) => x.level && x.level !== "good").map((x) => x.label_th).join(", ")}`, when_days: 90, why: `${DOMAIN_LABEL_TH[dk]} อยู่ในช่วง ${d.level === "attention" ? "ควรปรึกษาแพทย์" : "ควรติดตาม"}` }); }
  if (!a.sources_used.includes("bca")) out.push({ what: "ชั่ง BCA", when_days: 14, why: "ยังไม่มีค่าองค์ประกอบร่างกาย" });
  else out.push({ what: "ชั่ง BCA", when_days: 30, why: "ติดตามไขมัน/กล้ามเนื้อรายเดือน" });
  return out;
}

function doctorFlags(a: HealthAssessment): DoctorFlag[] {
  const out: DoctorFlag[] = [];
  for (const dk of CLINICAL) for (const d of a.domains[dk].drivers) if (d.level === "attention") {
    out.push({ domain: dk, metric: d.metric, label_th: d.label_th, value: `${d.value}${d.unit ? ` ${d.unit}` : ""}`, message: `${d.label_th} อยู่ในช่วงที่ควรปรึกษาแพทย์ — แผนนี้ไม่ทดแทนการตรวจโดยแพทย์` });
  }
  return out;
}

export function draftPlan(input: PlanInput): HealthPlan {
  const a = input.assessment;
  const derived = deriveGoal(a, input.customer.gender);
  const goal: Goal = input.goal ?? derived.goal;
  const goal_reason = input.goal ? `ตามเป้าที่โค้ชตั้งไว้ใน Plate Planner (${input.goal})` : derived.reason;
  const caveats: string[] = [];

  let targets: HealthPlan["nutrition"]["targets"] = null; let sample_days: DayPlan[] = []; const notes: string[] = [];
  if (input.customer.weight && input.customer.height_cm) {
    const t = calcTargets(input.customer.weight, input.customer.height_cm, goal, input.planConfig?.lockW) as Targets;
    targets = { ...t, protein_g_per_kg: Math.round((t.p / input.customer.weight) * 100) / 100 };
    sample_days = buildPlan(t, goal, true, 7, 1, input.planConfig ?? {}) as DayPlan[];
    notes.push(`เป้าโปรตีน ${t.p} g/วัน (${targets.protein_g_per_kg} g/kg) · พลังงาน ${t.kcal} kcal · สูตร Muscle-Centric ตามเป้า "${goal}"`);
    if (t.note) notes.push(t.note);
    const prot = find(a, "nutrition", "protein_per_kg");
    if (prot && prot.level && prot.level !== "good") notes.push(`จากบันทึกอาหาร ตอนนี้ได้โปรตีน ${prot.value} g/kg — เป้า ≥ 1.2 (PROT-AGE/ESPEN)`);
  } else {
    caveats.push("ไม่มีน้ำหนักหรือส่วนสูง จึงคำนวณเป้าพลังงาน/โปรตีนและเมนูตัวอย่างไม่ได้ — ชั่ง BCA และใส่ส่วนสูงก่อน");
  }
  if (a.confidence === "low") caveats.push(`ผลประเมินมีความเชื่อมั่นต่ำ (${a.confidence_reason}) — แผนนี้เป็นจุดเริ่ม ควรเก็บข้อมูลเพิ่มก่อนตั้งเป้าละเอียด`);
  if (a.priorities.length === 0) caveats.push("ไม่มีด้านที่ต้องดูแลเป็นพิเศษจากข้อมูลที่มี — เป้า 90 วันเป็นการรักษาระดับ");
  caveats.push("ร่างจากข้อมูล ณ วันที่ประเมิน · โค้ชต้องตรวจทุกข้อและปรับตามบริบทจริงของลูกค้าก่อนยืนยัน");

  return {
    plan_version: PLAN_VERSION, based_on_assessment_id: input.assessment_id, generated_at: input.today, goal, goal_reason,
    goals_90d: goals90(a, input.customer.gender).length ? goals90(a, input.customer.gender) : [{ domain: "body_comp", level: "good", target: "รักษาองค์ประกอบร่างกายและค่าเลือดให้อยู่ในเกณฑ์", why: "ไม่มีด้านที่ติดธง", measure: "BCA รายเดือน · แล็บที่ 90 วัน" }],
    nutrition: { targets, sample_days, notes },
    lifestyle: lifestyle(a),
    supplements: { source: "pharmacist", schedule: input.supplements, note: input.supplements?.length ? "ตามตารางที่เภสัชกรจัด — ระบบไม่เสนอเพิ่มหรือปรับเอง" : "ยังไม่มีตารางจากเภสัชกร — ถ้าต้องการอาหารเสริม ให้เภสัชกรและแพทย์ประเมินก่อน ระบบไม่เสนอเอง" },
    retest: retest(a, input.today),
    doctor_flags: doctorFlags(a),
    caveats, disclaimer: PLAN_DISCLAIMER,
  };
}
