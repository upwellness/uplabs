/**
 * Master catalog of lab metrics — extend as new fields come in from real reports.
 * Each metric has a key (immutable id), TH label, EN label, default unit, default reference range.
 * Used for: form select · column headers · status classification.
 */

export interface MetricDef {
  key:      string;
  category: Category;
  th:       string;
  en:       string;
  unit:     string;
  ref_low?:  number;
  ref_high?: number;
  ref_text?: string;     // non-numeric reference (e.g. "Negative")
}

export type Category =
  | "cbc" | "lipid" | "kidney" | "glucose" | "thyroid"
  | "uric" | "hepatitis" | "cancer" | "imaging" | "liver"
  | "cardiac" | "vitamin" | "hormone" | "other";

export const CATEGORY_LABEL: Record<Category, string> = {
  cbc:       "CBC (เม็ดเลือด)",
  lipid:     "ไขมัน (Lipid)",
  kidney:    "ไต (Kidney)",
  glucose:   "น้ำตาล (Glucose)",
  thyroid:   "ไทรอยด์ (Thyroid)",
  uric:      "กรดยูริค",
  hepatitis: "ไวรัสตับ (Hepatitis)",
  cancer:    "บ่งชี้มะเร็ง (Cancer Marker)",
  imaging:   "ภาพถ่ายรังสี (Imaging)",
  liver:     "ตับ (Liver Function)",
  cardiac:   "หัวใจ (Cardiac)",
  vitamin:   "วิตามิน (Vitamins)",
  hormone:   "ฮอร์โมน (Hormones)",
  other:     "อื่นๆ",
};

export const METRICS: MetricDef[] = [
  // CBC
  { key: "wbc",         category: "cbc", th: "จำนวนเม็ดเลือดขาว",          en: "WBC",                unit: "10^3 cells/L", ref_low: 4,    ref_high: 10 },
  { key: "rbc",         category: "cbc", th: "จำนวนเม็ดเลือดแดง",          en: "RBC",                unit: "10^6 cells/uL", ref_low: 4,    ref_high: 5.2 },
  { key: "hb",          category: "cbc", th: "ฮีโมโกลบิน",                en: "Hb",                 unit: "g/dL",          ref_low: 12,   ref_high: 16 },
  { key: "hct",         category: "cbc", th: "ความเข้มข้นของเลือด",        en: "Hct",                unit: "%",             ref_low: 36,   ref_high: 48 },
  { key: "mcv",         category: "cbc", th: "ปริมาตรเฉลี่ยเม็ดเลือดแดง", en: "MCV",                unit: "fL",            ref_low: 80,   ref_high: 100 },
  { key: "mch",         category: "cbc", th: "Hb เฉลี่ยต่อเม็ด",          en: "MCH",                unit: "pg",            ref_low: 26,   ref_high: 34 },
  { key: "mchc",        category: "cbc", th: "Hb เฉลี่ย/dL",              en: "MCHC",               unit: "g/dL",          ref_low: 31,   ref_high: 37 },
  { key: "rdw",         category: "cbc", th: "การกระจายขนาด RBC",         en: "RDW",                unit: "%",             ref_low: 9,    ref_high: 15 },
  { key: "platelet",    category: "cbc", th: "เกล็ดเลือด",                en: "Platelet",           unit: "10^3/mm3",      ref_low: 150,  ref_high: 450 },
  { key: "neutrophils", category: "cbc", th: "นิวโทรฟิล",                 en: "Neutrophils",        unit: "%",             ref_low: 46.5, ref_high: 75 },
  { key: "lymphocytes", category: "cbc", th: "ลิมโฟไซต์",                 en: "Lymphocytes",        unit: "%",             ref_low: 12,   ref_high: 44 },
  { key: "monocytes",   category: "cbc", th: "โมโนไซต์",                  en: "Monocytes",          unit: "%",             ref_low: 0,    ref_high: 11.2 },
  { key: "eosinophils", category: "cbc", th: "อีโอซิโนฟิล",               en: "Eosinophils",        unit: "%",             ref_low: 0,    ref_high: 9.5 },
  { key: "basophils",   category: "cbc", th: "เบโซฟิล",                   en: "Basophils",          unit: "%",             ref_low: 0,    ref_high: 2.5 },
  { key: "rbc_morphology", category: "cbc", th: "รูปร่างเม็ดเลือดแดง",    en: "RBC Morphology",     unit: "",              ref_text: "Normal" },

  // Lipid
  { key: "cholesterol", category: "lipid", th: "คอเลสเตอรอลรวม", en: "Total Cholesterol", unit: "mg/dL", ref_high: 200 },
  { key: "triglyceride",category: "lipid", th: "ไตรกลีเซอไรด์",  en: "Triglyceride",      unit: "mg/dL", ref_high: 150 },
  { key: "hdl",         category: "lipid", th: "ไขมันดี HDL",    en: "HDL",               unit: "mg/dL", ref_low: 50 },
  { key: "ldl",         category: "lipid", th: "ไขมันเลว LDL",   en: "LDL",               unit: "mg/dL", ref_high: 130 },

  // Kidney
  { key: "bun",  category: "kidney", th: "BUN", en: "BUN",  unit: "mg/dL", ref_low: 9.8,  ref_high: 20.1 },
  { key: "cr",   category: "kidney", th: "Creatinine", en: "Cr", unit: "mg/dL", ref_low: 0.55, ref_high: 1.02 },
  { key: "egfr", category: "kidney", th: "อัตรากรองของไต (eGFR)", en: "eGFR", unit: "mL/min/1.73m2", ref_low: 90, ref_high: 200 },

  // Glucose
  { key: "fbs",   category: "glucose", th: "น้ำตาลในเลือด (FBS)", en: "FBS",   unit: "mg/dL", ref_low: 70,   ref_high: 99 },
  { key: "hba1c", category: "glucose", th: "น้ำตาลสะสม (HbA1c)",  en: "HbA1c", unit: "%",                    ref_high: 5.7 },

  // Thyroid
  { key: "tsh", category: "thyroid", th: "TSH", en: "TSH", unit: "mU/L",  ref_low: 0.35, ref_high: 4.94 },
  { key: "ft3", category: "thyroid", th: "Free T3", en: "FT3", unit: "pg/mL", ref_low: 1.58, ref_high: 3.91 },
  { key: "ft4", category: "thyroid", th: "Free T4", en: "FT4", unit: "ng/dL", ref_low: 0.7,  ref_high: 1.48 },

  // Uric
  { key: "uric_acid", category: "uric", th: "กรดยูริค", en: "Uric Acid", unit: "mg/dL", ref_low: 2.6, ref_high: 6 },

  // Hepatitis B
  { key: "hbs_ag", category: "hepatitis", th: "HBs-Ag (การติดเชื้อไวรัสตับ B)", en: "HBs-Ag", unit: "", ref_text: "Negative" },
  { key: "hbs_ab", category: "hepatitis", th: "HBs-Ab (ภูมิคุ้มกัน)",          en: "HBs-Ab", unit: "mIU/mL", ref_low: 10 },

  // Cancer
  { key: "ca125",   category: "cancer", th: "CA-125 (มะเร็งรังไข่)", en: "CA-125",   unit: "U/mL", ref_high: 35 },
  { key: "cea",     category: "cancer", th: "CEA",                    en: "CEA",      unit: "ng/mL", ref_high: 5 },
  { key: "afp",     category: "cancer", th: "AFP (ตับ)",             en: "AFP",      unit: "ng/mL", ref_high: 9 },
  { key: "psa",     category: "cancer", th: "PSA (ต่อมลูกหมาก)",       en: "PSA",      unit: "ng/mL", ref_high: 4 },

  // Imaging (text-based)
  { key: "chest_xray",        category: "imaging", th: "เอกซเรย์ทรวงอก",          en: "Chest X-ray",              unit: "" },
  { key: "carotid_duplex",    category: "imaging", th: "Carotid Duplex Ultrasound", en: "Carotid Duplex",        unit: "" },
  { key: "upper_abdomen_us",  category: "imaging", th: "อัลตราซาวด์ช่องท้องส่วนบน", en: "Upper Abdomen US",      unit: "" },
  { key: "mammogram",         category: "imaging", th: "Mammogram + US Breasts", en: "Mammogram",               unit: "" },
  { key: "ekg",               category: "imaging", th: "คลื่นไฟฟ้าหัวใจ",          en: "EKG",                     unit: "" },
  { key: "fibroscan_cap",     category: "imaging", th: "FibroScan CAP (ไขมันตับ)", en: "FibroScan CAP",         unit: "dB/m" },
  { key: "fibroscan_e",       category: "imaging", th: "FibroScan E (พังผืดตับ)",  en: "FibroScan E",            unit: "kPa" },

  // Liver enzymes
  { key: "alt",       category: "liver", th: "ALT (SGPT)", en: "ALT", unit: "U/L", ref_high: 40 },
  { key: "ast",       category: "liver", th: "AST (SGOT)", en: "AST", unit: "U/L", ref_high: 40 },
  { key: "alp",       category: "liver", th: "ALP",        en: "ALP", unit: "U/L", ref_low: 44, ref_high: 147 },
  { key: "bilirubin_total", category: "liver", th: "Bilirubin total", en: "Bilirubin", unit: "mg/dL", ref_high: 1.2 },
];

export function findMetric(key: string): MetricDef | undefined {
  return METRICS.find((m) => m.key === key);
}

export function metricsByCategory(category: Category) {
  return METRICS.filter((m) => m.category === category);
}

export function classify(value: number | null, m: { ref_low?: number; ref_high?: number }): "normal" | "low" | "high" | "unknown" {
  if (value == null) return "unknown";
  if (m.ref_low != null && value < m.ref_low) return "low";
  if (m.ref_high != null && value > m.ref_high) return "high";
  return "normal";
}
