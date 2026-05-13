/**
 * Health Check risk scoring — based on WHO/AHA guideline-style factors.
 * Returns score 0-100 + level + flag list.
 */

export interface HealthAnswers {
  // Demographics
  age?:           number;
  gender?:        "male" | "female";
  height_cm?:     number;
  weight_kg?:     number;
  waist_cm?:      number;

  // Lifestyle
  exercise_freq?: "none" | "1-2_per_week" | "3-4_per_week" | "5+_per_week";
  sleep_hours?:   "lt_5" | "5_6" | "6_7" | "7_8" | "gt_8";
  stress_level?:  "low" | "moderate" | "high" | "very_high";
  smoking?:       "never" | "former" | "current";
  alcohol?:       "none" | "occasional" | "weekly" | "daily";
  diet_quality?:  "poor" | "average" | "good" | "excellent";

  // Symptoms
  symptoms?:      string[];   // e.g. ['fatigue','poor_sleep','weight_gain','joint_pain']

  // Family history
  family_history?: string[];  // ['diabetes','heart_disease','hypertension','cancer']

  // Existing
  conditions?:    string[];   // ['diabetes','hypertension','high_cholesterol','none']
}

export interface ScoreResult {
  bmi:        number | null;
  risk_score: number;          // 0-100
  risk_level: "low" | "moderate" | "high" | "very_high";
  flags:      string[];
}

export function computeBMI(weightKg?: number, heightCm?: number): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return +(weightKg / (m * m)).toFixed(1);
}

export function scoreHealthCheck(a: HealthAnswers): ScoreResult {
  let score = 0;
  const flags: string[] = [];

  // BMI (WHO Asian-Pacific)
  const bmi = computeBMI(a.weight_kg, a.height_cm);
  if (bmi != null) {
    if (bmi >= 30)      { score += 30; flags.push("BMI obese"); }
    else if (bmi >= 25) { score += 20; flags.push("BMI overweight"); }
    else if (bmi >= 23) { score += 10; flags.push("BMI overweight (Asian)"); }
    else if (bmi < 18.5){ score += 10; flags.push("BMI underweight"); }
  }

  // Waist (Asian-Pacific)
  if (a.waist_cm != null) {
    const cutoff = a.gender === "male" ? 90 : 80;
    if (a.waist_cm > cutoff) { score += 10; flags.push("รอบเอวเกินเกณฑ์ Asian-Pacific"); }
  }

  // Age
  if (a.age != null) {
    if (a.age >= 60)      score += 20;
    else if (a.age >= 50) score += 15;
    else if (a.age >= 40) score += 10;
  }

  // Exercise
  switch (a.exercise_freq) {
    case "none":          score += 20; flags.push("ไม่ออกกำลังกาย"); break;
    case "1-2_per_week":  score += 10; break;
    case "3-4_per_week":  score -= 5;  break;
    case "5+_per_week":   score -= 10; break;
  }

  // Sleep
  switch (a.sleep_hours) {
    case "lt_5":  score += 15; flags.push("นอน < 5 ชม."); break;
    case "5_6":   score += 8;  break;
    case "6_7":   score += 0;  break;
    case "7_8":   score -= 5;  break;
    case "gt_8":  score += 5;  break;
  }

  // Stress
  switch (a.stress_level) {
    case "low":        score -= 5;  break;
    case "moderate":   score += 5;  break;
    case "high":       score += 10; flags.push("Stress สูง"); break;
    case "very_high":  score += 15; flags.push("Stress สูงมาก"); break;
  }

  // Smoking
  switch (a.smoking) {
    case "current": score += 25; flags.push("สูบบุหรี่"); break;
    case "former":  score += 5;  break;
  }

  // Alcohol
  if (a.alcohol === "daily") { score += 10; flags.push("ดื่มประจำ"); }
  else if (a.alcohol === "weekly") score += 5;

  // Diet
  switch (a.diet_quality) {
    case "poor":      score += 15; flags.push("คุณภาพอาหารต่ำ"); break;
    case "average":   score += 5;  break;
    case "good":      score -= 3;  break;
    case "excellent": score -= 8;  break;
  }

  // Family history
  const fh = a.family_history ?? [];
  if (fh.includes("diabetes"))      { score += 12; flags.push("ครอบครัวเป็นเบาหวาน"); }
  if (fh.includes("heart_disease")) { score += 12; flags.push("ครอบครัวมีโรคหัวใจ"); }
  if (fh.includes("hypertension"))  { score += 8;  flags.push("ครอบครัวความดันสูง"); }
  if (fh.includes("cancer"))        { score += 5;  flags.push("ครอบครัวเคยมะเร็ง"); }

  // Existing conditions
  const conds = a.conditions ?? [];
  if (conds.includes("diabetes"))         { score += 25; flags.push("เป็นเบาหวาน"); }
  if (conds.includes("hypertension"))     { score += 20; flags.push("ความดันสูง"); }
  if (conds.includes("high_cholesterol")) { score += 15; flags.push("ไขมันในเลือดสูง"); }

  // Symptoms
  const syms = a.symptoms ?? [];
  if (syms.length >= 4) { score += 10; flags.push(`มีอาการ ${syms.length} อย่าง`); }
  else if (syms.length >= 2) score += 5;

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score));

  let risk_level: ScoreResult["risk_level"];
  if (score <= 25)      risk_level = "low";
  else if (score <= 50) risk_level = "moderate";
  else if (score <= 75) risk_level = "high";
  else                  risk_level = "very_high";

  return { bmi, risk_score: score, risk_level, flags };
}

export const RISK_LABEL: Record<ScoreResult["risk_level"], { th: string; color: string; bg: string; advice: string }> = {
  low:        { th: "ความเสี่ยงต่ำ",        color: "#16A34A", bg: "#DCFCE7", advice: "สุขภาพอยู่ในเกณฑ์ดี · รักษา lifestyle ไว้ + ตรวจประจำปี" },
  moderate:   { th: "ความเสี่ยงปานกลาง",   color: "#EAB308", bg: "#FEF9C3", advice: "มีปัจจัยที่ควรปรับ · ปรึกษา wellness coach เพื่อวางแผน" },
  high:       { th: "ความเสี่ยงสูง",       color: "#F97316", bg: "#FED7AA", advice: "ควรเริ่มปรับ lifestyle จริงจัง + ติดต่อ coach ทันที" },
  very_high:  { th: "ความเสี่ยงสูงมาก",    color: "#DC2626", bg: "#FEE2E2", advice: "ขอแนะนำให้พบแพทย์ตรวจร่างกาย + เริ่มโปรแกรมกับ coach ของเรา" },
};
