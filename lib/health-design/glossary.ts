/**
 * Plain-Thai glossary for the customer portal (SPEC-Mobile-Portal.md §5.1 L2, Q4).
 *
 * One line per metric answering "ค่านี้คืออะไร", plus the cut-points the assessment
 * engine already uses so the detail sheet can draw the range bar with the SAME numbers
 * (never a second set of thresholds). Every entry cites where the cut-points come from.
 *
 * `reviewed: false` on every line until จิ้น (pharmacist) signs it off — the UI shows
 * "รอเภสัชกรตรวจทาน" beneath unreviewed lines, and the spec blocks sending the portal
 * to real customers until the whole set is reviewed. Pure; tested in tests/glossary.test.mts.
 */
import type { Level } from "./assess";

export type LabPanel = "metabolic" | "lipid" | "liver" | "kidney" | "inflammation" | "thyroid" | "blood" | "vitamins" | "other";

export const PANEL_LABEL_TH: Record<LabPanel, string> = {
  metabolic: "น้ำตาล", lipid: "ไขมันในเลือด", liver: "ตับ", kidney: "ไต", inflammation: "การอักเสบ",
  thyroid: "ไทรอยด์", blood: "เม็ดเลือด", vitamins: "วิตามินและแร่ธาตุ", other: "อื่น ๆ",
};

const PANEL: Record<string, LabPanel> = {
  hba1c: "metabolic", fbs: "metabolic", glucose: "metabolic", eag: "metabolic", insulin: "metabolic", homa_ir: "metabolic",
  ldl: "lipid", hdl: "lipid", triglyceride: "lipid", tg: "lipid", cholesterol: "lipid", total_cholesterol: "lipid", non_hdl: "lipid", ldl_hdl_ratio: "lipid", chol_hdl_ratio: "lipid", apob: "lipid", lp_a: "lipid",
  alt_sgpt: "liver", alt: "liver", ast_sgot: "liver", ast: "liver", ggt: "liver", alp: "liver", alkaline_phosphatase: "liver", bilirubin_total: "liver", bilirubin_direct: "liver", albumin: "liver", globulin: "liver", total_protein: "liver",
  creatinine: "kidney", cr: "kidney", egfr: "kidney", bun: "kidney", uric_acid: "kidney", uric: "kidney", sodium: "kidney", potassium: "kidney", chloride: "kidney", tco2: "kidney", bicarbonate: "kidney", anion_gap: "kidney",
  hs_crp: "inflammation", hscrp: "inflammation", crp: "inflammation", esr: "inflammation", homocysteine: "inflammation",
  tsh: "thyroid", free_t3: "thyroid", free_t4: "thyroid", ft3: "thyroid", ft4: "thyroid",
  hemoglobin: "blood", hb: "blood", hematocrit: "blood", hct: "blood", rbc: "blood", wbc: "blood", platelet: "blood", mcv: "blood", mch: "blood", mchc: "blood", rdw: "blood", mpv: "blood",
  neutrophil: "blood", lymphocyte: "blood", monocyte: "blood", eosinophil: "blood", basophil: "blood", ferritin: "blood", iron: "blood",
  vitamin_d: "vitamins", vitamin_b12: "vitamins", folate: "vitamins", magnesium: "vitamins", zinc: "vitamins", calcium: "vitamins",
};
export const panelOf = (metric: string): LabPanel => PANEL[metric] ?? "other";

/** A cut-point on the range bar: values below `to` fall in `band`; the last entry has no `to`. */
export interface Band { to?: number; level: Level; label_th: string }

export interface GlossaryEntry {
  /** ค่านี้คืออะไร — one plain sentence, no verdict */
  what_th: string;
  /** who set the cut-points (shown under the bar) */
  source: string;
  /** shown when the metric has no guideline cut-point (`level: null` in the engine) */
  trend_only?: true;
  reviewed: boolean;
}

/** Cut-points as the engine applies them. Sex-split metrics take a gender. */
export function bandsFor(metric: string, gender: "male" | "female" | null): Band[] | null {
  const g = gender ?? "female";
  switch (metric) {
    case "hba1c": return [{ to: 5.7, level: "good", label_th: "ดี" }, { to: 6.5, level: "watch", label_th: "ควรติดตาม" }, { level: "attention", label_th: "ควรปรึกษาแพทย์" }];
    case "fbs": case "glucose": return [{ to: 100, level: "good", label_th: "ดี" }, { to: 126, level: "watch", label_th: "ควรติดตาม" }, { level: "attention", label_th: "ควรปรึกษาแพทย์" }];
    case "ldl": return [{ to: 130, level: "good", label_th: "ดี" }, { to: 160, level: "watch", label_th: "ควรติดตาม" }, { level: "attention", label_th: "ควรปรึกษาแพทย์" }];
    case "hdl": return [{ to: 40, level: "watch", label_th: "ต่ำ" }, { level: "good", label_th: "ดี" }];
    case "triglyceride": case "tg": return [{ to: 150, level: "good", label_th: "ดี" }, { to: 200, level: "watch", label_th: "ควรติดตาม" }, { level: "attention", label_th: "ควรปรึกษาแพทย์" }];
    case "cholesterol": case "total_cholesterol": return [{ to: 200, level: "good", label_th: "ดี" }, { to: 240, level: "watch", label_th: "ควรติดตาม" }, { level: "attention", label_th: "ควรปรึกษาแพทย์" }];
    case "hs_crp": case "hscrp": case "crp": return [{ to: 1, level: "good", label_th: "ต่ำ" }, { to: 3, level: "watch", label_th: "ปานกลาง" }, { level: "attention", label_th: "สูง" }];
    case "alt_sgpt": case "alt": case "ast_sgot": case "ast": return [{ to: 41, level: "good", label_th: "ดี" }, { to: 81, level: "watch", label_th: "ควรติดตาม" }, { level: "attention", label_th: "ควรปรึกษาแพทย์" }];
    case "egfr": return [{ to: 60, level: "attention", label_th: "ควรปรึกษาแพทย์" }, { to: 90, level: "watch", label_th: "ควรติดตาม" }, { level: "good", label_th: "ดี" }];
    case "uric_acid": case "uric": return [{ to: g === "female" ? 6 : 7, level: "good", label_th: "ดี" }, { level: "watch", label_th: "สูง" }];
    case "fat_pct": return g === "male"
      ? [{ to: 10, level: "watch", label_th: "ต่ำ" }, { to: 20, level: "good", label_th: "ปกติ" }, { to: 25, level: "attention", label_th: "เริ่มอ้วน" }, { level: "attention", label_th: "อ้วน" }]
      : [{ to: 20, level: "watch", label_th: "ต่ำ" }, { to: 30, level: "good", label_th: "ปกติ" }, { to: 35, level: "attention", label_th: "เริ่มอ้วน" }, { level: "attention", label_th: "อ้วน" }];
    case "muscle_pct": return g === "male"
      ? [{ to: 32.9, level: "attention", label_th: "ต่ำ" }, { to: 35.8, level: "good", label_th: "ปกติ" }, { level: "good", label_th: "สูง" }]
      : [{ to: 25.9, level: "attention", label_th: "ต่ำ" }, { to: 28, level: "good", label_th: "ปกติ" }, { level: "good", label_th: "สูง" }];
    case "visceral": return [{ to: 5.5, level: "good", label_th: "ปกติ" }, { to: 10.5, level: "watch", label_th: "เริ่มเสี่ยง" }, { level: "attention", label_th: "เสี่ยงสูง" }];
    case "bmi": return [{ to: 18.5, level: "watch", label_th: "ผอม" }, { to: 23, level: "good", label_th: "ปกติ" }, { to: 25, level: "watch", label_th: "ท้วม" }, { level: "attention", label_th: "อ้วน" }];
    case "sleep": return [{ to: 6, level: "attention", label_th: "น้อย" }, { to: 7, level: "watch", label_th: "ยังไม่พอ" }, { level: "good", label_th: "พอ" }];
    case "steps": return [{ to: 5000, level: "attention", label_th: "นั่งเยอะ" }, { to: 7500, level: "watch", label_th: "พอใช้" }, { level: "good", label_th: "active" }];
    case "recovery": return [{ to: 34, level: "attention", label_th: "แดง" }, { to: 67, level: "watch", label_th: "เหลือง" }, { level: "good", label_th: "เขียว" }];
    case "cgm_tir": return [{ to: 70, level: "watch", label_th: "ต่ำกว่าเป้า" }, { level: "good", label_th: "ถึงเป้า" }];
    case "cgm_tbr": return [{ to: 4, level: "good", label_th: "ดี" }, { level: "watch", label_th: "ต่ำบ่อย" }];
    case "cgm_cv": return [{ to: 36, level: "good", label_th: "นิ่ง" }, { level: "watch", label_th: "แกว่ง" }];
    case "protein_per_kg": return [{ to: 0.8, level: "attention", label_th: "น้อย" }, { to: 1.2, level: "watch", label_th: "ยังไม่ถึง" }, { level: "good", label_th: "พอ" }];
    default: return null;
  }
}

const E = (what_th: string, source: string, trend_only?: true): GlossaryEntry => ({ what_th, source, ...(trend_only ? { trend_only } : {}), reviewed: false });

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ── น้ำตาล / เมตาบอลิก
  hba1c: E("น้ำตาลที่เกาะเม็ดเลือดแดง สะท้อนน้ำตาลเฉลี่ยช่วง 2–3 เดือน ไม่ขึ้นลงตามมื้อล่าสุด", "ADA Standards of Care"),
  fbs: E("น้ำตาลในเลือดหลังอดอาหาร 8 ชั่วโมง บอกว่าร่างกายคุมน้ำตาลตอนไม่ได้กินดีแค่ไหน", "ADA Standards of Care"),
  glucose: E("น้ำตาลในเลือด ณ เวลาที่เจาะ", "ADA Standards of Care"),
  eag: E("น้ำตาลเฉลี่ยที่แปลงมาจาก HbA1c ให้อ่านเป็นหน่วยเดียวกับเครื่องเจาะปลายนิ้ว", "ADAG study (Nathan 2008)", true),
  cgm_tir: E("สัดส่วนเวลาที่น้ำตาลจากเซ็นเซอร์อยู่ในช่วง 70–180 mg/dL ตลอด 14 วัน", "International Consensus on TIR (Battelino 2019)"),
  cgm_tbr: E("สัดส่วนเวลาที่น้ำตาลต่ำกว่า 70 mg/dL — ต่ำบ่อยคือสิ่งที่ต้องระวังกว่าสูง", "International Consensus on TIR (Battelino 2019)"),
  cgm_cv: E("ความแกว่งของน้ำตาล — ยิ่งต่ำยิ่งนิ่ง ค่านี้ไม่ได้บอกว่าสูงหรือต่ำ", "International Consensus on TIR (Battelino 2019)"),
  cgm_gmi: E("HbA1c โดยประมาณที่คำนวณจากน้ำตาลเฉลี่ยของเซ็นเซอร์ ไม่ใช่ค่าจากการเจาะเลือด", "Bergenstal 2018 (GMI)", true),
  food_glucose_impact: E("คะแนน 0–10 ที่ AI ประเมินว่ามื้อที่บันทึกน่าจะดันน้ำตาลขึ้นมากแค่ไหน — เป็นการประมาณจากรูป ไม่ใช่ค่าที่วัด", "UP Labs NutriScan (ประมาณโดย AI)", true),
  // ── ไขมันในเลือด / หัวใจ
  ldl: E("ไขมันชนิดที่สะสมในผนังหลอดเลือดได้ ค่ายิ่งต่ำยิ่งดีสำหรับหัวใจ", "NCEP ATP III / ESC"),
  hdl: E("ไขมันชนิดที่ช่วยเก็บไขมันส่วนเกินออกจากหลอดเลือด ค่าสูงกว่าดีกว่า", "NCEP ATP III"),
  triglyceride: E("ไขมันในเลือดที่ขึ้นตามน้ำตาล แป้ง และแอลกอฮอล์ที่กินเข้าไป", "NCEP ATP III"),
  cholesterol: E("ไขมันในเลือดรวมทุกชนิด ต้องดูคู่กับ LDL และ HDL ถึงจะบอกอะไรได้", "NCEP ATP III"),
  total_cholesterol: E("ไขมันในเลือดรวมทุกชนิด ต้องดูคู่กับ LDL และ HDL ถึงจะบอกอะไรได้", "NCEP ATP III"),
  non_hdl: E("ไขมันรวมหักส่วนที่ดี (HDL) ออก — เหลือส่วนที่เกี่ยวกับความเสี่ยงหลอดเลือด", "NCEP ATP III", true),
  hs_crp: E("โปรตีนที่ตับสร้างเมื่อร่างกายมีการอักเสบ ค่าต่ำ ๆ แบบเรื้อรังสัมพันธ์กับความเสี่ยงหัวใจ", "AHA/CDC 2003"),
  rhr: E("ชีพจรตอนพักที่นาฬิกาคำนวณให้ ค่าเฉพาะบุคคล ดูว่าเปลี่ยนจากปกติของตัวเองไหม", "ไม่มีเกณฑ์กลาง — ใช้ดูแนวโน้ม", true),
  hr_bpm: E("ชีพจรเฉลี่ยทั้งวันจากนาฬิกา", "ไม่มีเกณฑ์กลาง — ใช้ดูแนวโน้ม", true),
  // ── ตับ / ไต
  alt_sgpt: E("เอนไซม์จากเซลล์ตับ สูงขึ้นเมื่อตับถูกรบกวน เช่น ไขมันพอกตับ ยา หรือแอลกอฮอล์", "เกณฑ์ห้องแล็บ (ULN 40 U/L)"),
  alt: E("เอนไซม์จากเซลล์ตับ สูงขึ้นเมื่อตับถูกรบกวน เช่น ไขมันพอกตับ ยา หรือแอลกอฮอล์", "เกณฑ์ห้องแล็บ (ULN 40 U/L)"),
  ast_sgot: E("เอนไซม์ที่พบทั้งในตับและกล้ามเนื้อ ต้องอ่านคู่กับ ALT", "เกณฑ์ห้องแล็บ (ULN 40 U/L)"),
  ggt: E("เอนไซม์ตับที่ไวต่อแอลกอฮอล์และท่อน้ำดี", "เกณฑ์ห้องแล็บ", true),
  alp: E("เอนไซม์จากตับ ท่อน้ำดี และกระดูก", "เกณฑ์ห้องแล็บ", true),
  egfr: E("อัตราการกรองของไตที่ประมาณจากครีอะตินิน อายุ และเพศ — ตัวเลขหลักที่บอกการทำงานของไต", "KDIGO 2012"),
  creatinine: E("ของเสียจากกล้ามเนื้อที่ไตต้องกรองทิ้ง ขึ้นกับมวลกล้ามเนื้อ จึงต้องดู eGFR ควบ", "KDIGO 2012", true),
  bun: E("ของเสียจากโปรตีนที่ไตกรองทิ้ง ขึ้นลงตามปริมาณโปรตีนที่กินและน้ำในร่างกาย", "เกณฑ์ห้องแล็บ", true),
  uric_acid: E("ของเสียจากการย่อยพิวรีน สูงเรื้อรังสัมพันธ์กับเกาต์และไต", "เกณฑ์ทั่วไป (>7 ชาย · >6 หญิง mg/dL)"),
  // ── ร่างกาย (BCA)
  fat_pct: E("สัดส่วนไขมันต่อน้ำหนักตัว วัดด้วยเครื่อง BCA — ดูแนวโน้มสำคัญกว่าค่าครั้งเดียว", "เกณฑ์เครื่อง BCA แยกเพศ (house)"),
  muscle_pct: E("สัดส่วนกล้ามเนื้อต่อน้ำหนักตัว ยิ่งคงไว้ได้มากยิ่งดีเมื่ออายุมากขึ้น", "เกณฑ์เครื่อง BCA แยกเพศ (house)"),
  visceral: E("ระดับไขมันรอบอวัยวะในช่องท้อง — เป็นไขมันชนิดที่เกี่ยวกับความเสี่ยงเมตาบอลิกมากที่สุด", "ระดับจากเครื่อง BCA (1–30)"),
  bmi: E("น้ำหนักเทียบส่วนสูง ใช้คัดกรองคร่าว ๆ ไม่แยกไขมันกับกล้ามเนื้อ", "WHO เกณฑ์เอเชีย-แปซิฟิก"),
  weight: E("น้ำหนักตัวจากเครื่อง BCA", "—", true),
  body_age: E("อายุที่เครื่อง BCA ประมาณจากองค์ประกอบร่างกาย เทียบกับอายุจริง", "สูตรของเครื่อง BCA", true),
  // ── การนอน / ฟื้นตัว
  sleep: E("ชั่วโมงที่หลับจริงเฉลี่ยต่อคืนจากนาฬิกา", "AASM แนะนำ ≥7 ชม."),
  steps: E("จำนวนก้าวเฉลี่ยต่อวันจากนาฬิกาหรือมือถือ", "Tudor-Locke 2011"),
  hrv: E("ความแปรปรวนของจังหวะหัวใจ — ค่าเฉพาะบุคคลที่สะท้อนการฟื้นตัว เทียบกับตัวเองย้อนหลังเท่านั้น", "ไม่มีเกณฑ์กลาง — ใช้ดูแนวโน้ม", true),
  recovery: E("คะแนนฟื้นตัวที่ Whoop คำนวณจาก HRV ชีพจรพัก และการนอน", "แถบสีของ Whoop"),
  // ── โภชนาการ
  food_coverage: E("จำนวนวันที่บันทึกอาหารในช่วง 14 วัน — ยิ่งบันทึกครบ ภาพการกินยิ่งชัด", "UP Labs: ≥4 วัน/สัปดาห์"),
  protein_per_kg: E("โปรตีนที่กินเฉลี่ยต่อน้ำหนักตัว 1 กก. นับเฉพาะวันที่บันทึก", "PROT-AGE / ESPEN"),
  protein_g: E("โปรตีนเฉลี่ยต่อวันจากมื้อที่บันทึก", "—", true),
  calories: E("พลังงานเฉลี่ยต่อวันจากมื้อที่บันทึก เป็นค่าประมาณของ AI", "ประมาณโดย AI", true),
  food_health_score: E("คะแนน 0–10 ที่ AI ให้คุณภาพมื้อจากรูปหรือข้อความ", "ประมาณโดย AI", true),
  // ── อายุสุขภาพ
  phenoage: E("อายุทางชีวภาพที่คำนวณจากผลเลือด 9 ตัว เทียบกับอายุจริง", "Levine 2018 (PhenoAge)"),
  // ── เม็ดเลือด / ไทรอยด์ / วิตามิน (แสดงในหน้าแหล่งข้อมูล)
  hemoglobin: E("ปริมาณโปรตีนที่พาออกซิเจนในเม็ดเลือดแดง ต่ำ = ซีด", "เกณฑ์ห้องแล็บ", true),
  hematocrit: E("สัดส่วนเม็ดเลือดแดงในเลือดทั้งหมด", "เกณฑ์ห้องแล็บ", true),
  wbc: E("จำนวนเม็ดเลือดขาว สูงเมื่อมีการติดเชื้อหรืออักเสบ", "เกณฑ์ห้องแล็บ", true),
  platelet: E("เกล็ดเลือดที่ช่วยห้ามเลือด", "เกณฑ์ห้องแล็บ", true),
  tsh: E("ฮอร์โมนจากสมองที่สั่งไทรอยด์ทำงาน สูง = ไทรอยด์ทำงานน้อย", "เกณฑ์ห้องแล็บ", true),
  free_t4: E("ฮอร์โมนไทรอยด์ตัวหลักที่ลอยอิสระในเลือด", "เกณฑ์ห้องแล็บ", true),
  free_t3: E("ฮอร์โมนไทรอยด์รูปที่ออกฤทธิ์", "เกณฑ์ห้องแล็บ", true),
  vitamin_d: E("วิตามินดีในเลือด เกี่ยวกับกระดูก กล้ามเนื้อ และภูมิคุ้มกัน", "Endocrine Society", true),
};

export const explain = (metric: string): GlossaryEntry | null => GLOSSARY[metric] ?? null;

/** Position 0–1 of `value` on the bar built from `bands`, using the outer cut-points ±25% as the visible span. */
export function barPosition(value: number, bands: Band[]): number {
  const cuts = bands.map((b) => b.to).filter((x): x is number => x != null);
  if (!cuts.length) return 0.5;
  const lo = cuts[0], hi = cuts[cuts.length - 1];
  const span = Math.max(hi - lo, Math.abs(hi) * 0.2 || 1);
  const min = lo - span * 0.5, max = hi + span * 0.5;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Segment widths (0–1) for drawing the bar, same span rule as barPosition. */
export function barSegments(bands: Band[]): { level: Level; label_th: string; from: number; to: number }[] {
  const cuts = bands.map((b) => b.to).filter((x): x is number => x != null);
  if (!cuts.length) return [];
  const lo = cuts[0], hi = cuts[cuts.length - 1];
  const span = Math.max(hi - lo, Math.abs(hi) * 0.2 || 1);
  const min = lo - span * 0.5, max = hi + span * 0.5;
  const pos = (v: number) => (v - min) / (max - min);
  let from = 0;
  return bands.map((b) => { const to = b.to == null ? 1 : pos(b.to); const seg = { level: b.level, label_th: b.label_th, from, to }; from = to; return seg; });
}

/** Every metric the assessment engine can emit as a driver — the test checks each has a glossary line. */
export const ENGINE_DRIVER_METRICS = [
  "hba1c", "fbs", "cgm_tir", "cgm_tbr", "cgm_cv", "cgm_gmi", "food_glucose_impact",
  "fat_pct", "muscle_pct", "visceral", "bmi", "weight", "body_age",
  "ldl", "hdl", "triglyceride", "cholesterol", "hs_crp", "rhr",
  "alt_sgpt", "ast_sgot", "egfr", "creatinine", "uric_acid",
  "sleep", "recovery", "hrv", "steps",
  "food_coverage", "protein_per_kg", "protein_g", "calories", "food_health_score",
] as const;
