/**
 * Profile field options for the structured Check FORM v2.
 * All labels in Thai · keys in English for stable DB storage.
 */

export interface Option<V extends string = string> {
  value: V;
  label: string;
  hint?: string;
}

/* ── Demographics ─────────────────────────────────── */

export const AGE_RANGES: Option[] = [
  { value: "lt25",    label: "ต่ำกว่า 25",  hint: "Gen Z / นักศึกษา / first job" },
  { value: "25-35",   label: "25 – 35",     hint: "career builder · มีพลัง" },
  { value: "35-45",   label: "35 – 45",     hint: "พีคหน้าที่การงาน · เริ่มดูแลสุขภาพ" },
  { value: "45-55",   label: "45 – 55",     hint: "ดูแลพ่อแม่ · ลูกโต · มีกำลังจ่าย" },
  { value: "55plus",  label: "55+",          hint: "เกษียณ · longevity-focus" },
];

export const GENDERS: Option[] = [
  { value: "female", label: "หญิง" },
  { value: "male",   label: "ชาย" },
  { value: "other",  label: "อื่น/ไม่ระบุ" },
];

export const EDUCATIONS: Option[] = [
  { value: "highschool",  label: "ม.ปลาย"        },
  { value: "vocational",  label: "ปวช./ปวส."     },
  { value: "bachelor",    label: "ปริญญาตรี"     },
  { value: "master_plus", label: "โท / เอก"      },
  { value: "other",       label: "อื่น/ไม่ระบุ"   },
];

export const MARITAL: Option[] = [
  { value: "single",            label: "โสด" },
  { value: "married_no_kids",   label: "แต่งงาน · ไม่มีลูก" },
  { value: "married_with_kids", label: "แต่งงาน · มีลูก" },
  { value: "divorced_widow",    label: "หย่า / หม้าย" },
];

/* ── Career ──────────────────────────────────────── */

export const OCCUPATIONS: Option[] = [
  { value: "employee",       label: "พนักงานบริษัท",   hint: "เงินเดือนประจำ" },
  { value: "government",     label: "ราชการ/รัฐวิสาหกิจ" },
  { value: "business_owner", label: "ธุรกิจส่วนตัว",   hint: "เจ้าของกิจการ" },
  { value: "freelance",      label: "freelance · รับงานเอง" },
  { value: "professional",   label: "วิชาชีพ",         hint: "หมอ · ทนาย · เภสัช · วิศวกร" },
  { value: "sales_service",  label: "ขายของ · บริการ", hint: "หน้าร้าน · MLM · service" },
  { value: "homemaker",      label: "แม่บ้าน",         hint: "ดูแลครอบครัวเต็มเวลา" },
  { value: "student",        label: "นักเรียน/นักศึกษา" },
  { value: "retired",        label: "เกษียณ" },
  { value: "other",          label: "อื่น" },
];

export const INCOME_RANGES: Option[] = [
  { value: "lt15k",     label: "< 15,000 บ/เดือน",    hint: "นักศึกษา / part-time" },
  { value: "15-30k",    label: "15k – 30k",            hint: "first jobber · พนักงาน entry" },
  { value: "30-50k",    label: "30k – 50k",            hint: "middle-class · มี cashflow" },
  { value: "50-100k",   label: "50k – 100k",           hint: "manager · skilled" },
  { value: "100-200k",  label: "100k – 200k",          hint: "senior · เจ้าของธุรกิจระดับ" },
  { value: "200kplus",  label: "200k+",                hint: "high earner · investor" },
  { value: "unknown",   label: "ไม่ทราบ · ไม่ระบุ" },
];

export const JOB_SATISFACTION: Option[] = [
  { value: "hate",      label: "ไม่ชอบเลย",    hint: "อยากเปลี่ยน" },
  { value: "neutral",   label: "เฉยๆ",         hint: "ทำเพราะต้องทำ" },
  { value: "like",      label: "ค่อนข้างชอบ"   },
  { value: "love",      label: "รักงาน",        hint: "ภูมิใจ · ไม่อยากเปลี่ยน" },
];

/* ── Lifestyle ──────────────────────────────────── */

export const HEALTH_AWARENESS: Option[] = [
  { value: "low",    label: "ต่ำ",    hint: "ไม่ค่อยใส่ใจ" },
  { value: "medium", label: "กลาง",   hint: "บางเรื่อง · ไม่ลึก" },
  { value: "high",   label: "สูง",    hint: "ใส่ใจ · เคยลองดูแล" },
];

export const EXERCISE_FREQ: Option[] = [
  { value: "none",    label: "ไม่ออก",          hint: "0 ครั้ง/wk" },
  { value: "1-2wk",   label: "1-2 ครั้ง/wk",   hint: "บางวัน" },
  { value: "3-4wk",   label: "3-4 ครั้ง/wk",   hint: "สม่ำเสมอ" },
  { value: "daily",   label: "เกือบทุกวัน",     hint: "active lifestyle" },
];

export const DIET_STYLE: Option[] = [
  { value: "regular",      label: "ปกติ" },
  { value: "lowcarb",      label: "Low carb / Keto" },
  { value: "intermittent", label: "IF / TRE" },
  { value: "vegetarian",   label: "ทานเจ / มังสวิรัติ" },
  { value: "mixed",        label: "ปรับ ๆ ตามช่วง" },
];

export const HOBBIES: Option[] = [
  { value: "fitness",     label: "ออกกำลัง · ฟิตเนส" },
  { value: "running",     label: "วิ่ง · marathon" },
  { value: "yoga",        label: "โยคะ · pilates" },
  { value: "cooking",     label: "ทำอาหาร" },
  { value: "travel",      label: "ท่องเที่ยว" },
  { value: "reading",     label: "อ่านหนังสือ · podcast" },
  { value: "social",      label: "สังคม · ปาร์ตี้" },
  { value: "gaming",      label: "เกม · technology" },
  { value: "music",       label: "ดนตรี · ศิลปะ" },
  { value: "gardening",   label: "ปลูกต้นไม้ · ทำสวน" },
  { value: "pets",        label: "เลี้ยงสัตว์" },
  { value: "investing",   label: "ลงทุน · finance" },
];

export const TIME_AVAILABLE: Option[] = [
  { value: "low",    label: "น้อยมาก",       hint: "งานยุ่ง · ไม่มีเวลา" },
  { value: "medium", label: "พอประมาณ",      hint: "มีเวลาบ้าง วันหยุด" },
  { value: "high",   label: "เยอะ",          hint: "เกษียณ · WFH · มีเวลา" },
];

/* ── Family ─────────────────────────────────────── */

export const FAMILY_DEPS: Option[] = [
  { value: "none",      label: "ไม่มีคนต้องดูแล" },
  { value: "1-2",       label: "1-2 คน",           hint: "พ่อแม่ / ลูก 1 คน" },
  { value: "3plus",     label: "3+ คน",            hint: "ภาระเยอะ · ครอบครัวใหญ่" },
];

export const FAMILY_HEALTH: Option[] = [
  { value: "good",         label: "ปกติ",                hint: "ไม่มีปัญหาเด่นชัด" },
  { value: "ncds",         label: "มี NCDs",             hint: "เบาหวาน · ความดัน · ไขมัน" },
  { value: "elderly_care", label: "ดูแลผู้สูงอายุ" },
  { value: "mixed",        label: "หลายเรื่องผสมกัน" },
];

export const FAMILY_FINANCE: Option[] = [
  { value: "none",   label: "ไม่กดดัน" },
  { value: "medium", label: "กดดันบ้าง"  },
  { value: "high",   label: "กดดันมาก",  hint: "หนี้ · ค่าใช้จ่ายเยอะ" },
];

/* ── DISC ───────────────────────────────────────── */

export interface DiscStyle {
  key: "D" | "I" | "S" | "C";
  label: string;
  full: string;
  description: string;
  cues: string[];
  approach: string;
  color: "rose" | "amber" | "wellness" | "science";
}

export const DISC_STYLES: DiscStyle[] = [
  {
    key: "D",
    label: "Dominance",
    full: "ผู้นำ · กล้าตัดสินใจ",
    description: "เน้นผลลัพธ์ · ตรงไปตรงมา · ชอบ challenge · ไม่ชอบเสียเวลา",
    cues: ["พูดเสียงดัง · พูดตรง", "สนใจตัวเลข · ROI", "ใจร้อน · ตัดสินใจเร็ว", "ชอบเป็น 'คนแรก'"],
    approach: "ตรงประเด็น · เน้น ผลลัพธ์/รายได้ · เคารพเวลา · ให้ตัวเลข",
    color: "rose",
  },
  {
    key: "I",
    label: "Influence",
    full: "ชอบสังคม · พูดเก่ง",
    description: "เน้นความสัมพันธ์ · ชอบ recognition · ตื่นเต้นง่าย · ชอบเล่าเรื่อง",
    cues: ["พูดเยอะ · ใช้คำเล่นสนุก", "อ่อนไหวกับคำชม", "ชอบกลุ่ม · ปาร์ตี้", "ตัดสินใจตามความรู้สึก"],
    approach: "ฟัง story · ให้ recognition · เน้นความสนุก · เชื่อมไป community · ภาพสำเร็จ",
    color: "amber",
  },
  {
    key: "S",
    label: "Steadiness",
    full: "ใจเย็น · ปรับตัว",
    description: "เน้นความมั่นคง · ฟังก่อนพูด · หลีกเลี่ยง confrontation · loyal",
    cues: ["พูดช้า · สุภาพ", "ถามรายละเอียดเยอะ", "ไม่ชอบตัดสินใจเร็ว", "ใส่ใจครอบครัว"],
    approach: "ไม่กด · ให้เวลา · ค่อยๆ build trust · เน้นความปลอดภัย/ครอบครัว · ใช้ proof",
    color: "wellness",
  },
  {
    key: "C",
    label: "Conscientiousness",
    full: "ละเอียด · มีหลักการ",
    description: "เน้นข้อมูล · accuracy · ถามมาก · ต้องการ proof · skeptical",
    cues: ["ถาม 'มีงานวิจัยมั้ย'", "ต้องการตัวเลข · spec", "ระวัง · ไม่ค่อย commit", "อ่านเงื่อนไขละเอียด"],
    approach: "เตรียมข้อมูล · ตัวเลข · evidence · ให้เวลาตัดสินใจ · ไม่ใช้ emotional",
    color: "science",
  },
];

export const DISC_CONFIDENCE: Option[] = [
  { value: "guessing", label: "เดา · ไม่ค่อยมั่นใจ" },
  { value: "maybe",    label: "พอเดาได้"          },
  { value: "certain",  label: "มั่นใจมาก"          },
];
