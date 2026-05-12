/**
 * Red-flag exclusions — block assessment when customer is in risk group.
 * Returns array of human-readable reasons. Empty = clear.
 */

export interface IntakeData {
  medications:    string[];
  conditions:     string[];
  pregnant:       boolean;
  breastfeeding:  boolean;
  age?:           number | null;
}

const HARD_BLOCK_CONDITIONS = ["ckd", "kidney", "ไต"];
const BLOCK_MEDS = {
  warfarin:        "ผู้ใช้ Warfarin ต้องระวัง Vitamin K · Omega-3 · CoQ10 — ปรึกษาแพทย์",
  chemo:           "Chemotherapy / immunosuppressant ต้องปรึกษาแพทย์เฉพาะทาง",
  immunosuppressant: "Immunosuppressant ต้องปรึกษาแพทย์เฉพาะทาง",
};

export function checkExclusions(intake: IntakeData): string[] {
  const reasons: string[] = [];

  if (intake.pregnant)
    reasons.push("ผู้ตั้งครรภ์ — ต้องปรึกษาแพทย์ก่อนเริ่ม supplement ใดๆ");
  if (intake.breastfeeding)
    reasons.push("ผู้ให้นมบุตร — ต้องปรึกษาแพทย์ก่อนเริ่ม supplement ใดๆ");
  if (intake.age != null && intake.age < 18)
    reasons.push("อายุต่ำกว่า 18 ปี — supplement adult ไม่เหมาะสม");

  const conds = (intake.conditions ?? []).map((c) => c.toLowerCase());
  for (const block of HARD_BLOCK_CONDITIONS) {
    if (conds.some((c) => c.includes(block)))
      reasons.push(`พบ condition: ${block} → ต้องปรึกษาแพทย์เฉพาะทาง`);
  }

  const meds = (intake.medications ?? []).join(" ").toLowerCase();
  for (const [kw, msg] of Object.entries(BLOCK_MEDS)) {
    if (meds.includes(kw)) reasons.push(msg);
  }

  return reasons;
}
