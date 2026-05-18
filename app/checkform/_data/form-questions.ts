/**
 * FORM Method · dialog content for guided lead qualification.
 * Tone: warm + listening · NOT salesy. "ลองชวนคุย" framing.
 */

export type FormKey = "F" | "O" | "R" | "M";

export interface DialogLine {
  text: string;
  tag?: string;  // "เปิดเรื่อง" / "ตามต่อ" / "ระวัง"
}

export interface ListenSignal {
  emoji: "✅" | "⚠️";
  text: string;
}

export interface FormSectionData {
  key: FormKey;
  label: string;
  fullName: string;
  description: string;
  whyMatters: string;
  /** Conversation starters · เป็นตัวอย่าง · ไม่ใช่ script ที่ต้องท่อง */
  openers: DialogLine[];
  /** Follow-up questions after opener */
  followUps: DialogLine[];
  /** ✅ green signals / ⚠️ red signals */
  signals: ListenSignal[];
  /** Rating descriptions · scale 1-3 */
  ratingScale: Array<{ value: 1 | 2 | 3; label: string; meaning: string }>;
  accent: "rose" | "wellness" | "science" | "amber";
  icon: string;
}

export const FORM_SECTIONS: FormSectionData[] = [
  {
    key: "F",
    label: "Family",
    fullName: "ครอบครัว · คนที่เขาแคร์",
    description: "ฟังว่ามีใครใกล้ตัวที่เขาห่วง · ภาระ · ความสัมพันธ์",
    whyMatters:
      "คนที่มีคนรักให้ดูแล มักเปิดรับสุขภาพ — เพราะอยากอยู่กับคนนั้นนานๆ · เรื่องนี้คือ pain ที่เป็นธรรมชาติที่สุด",
    icon: "👨‍👩‍👧",
    accent: "rose",
    openers: [
      { text: "ช่วงนี้ทางบ้านเป็นยังไงบ้าง?",     tag: "เปิดเรื่อง" },
      { text: "พ่อแม่ยังทำงานอยู่ไหมครับ/คะ?",   tag: "เปิดเรื่อง" },
      { text: "มีน้อง ๆ หรือลูก ๆ ที่ต้องดูแลบ้างไหม?", tag: "เปิดเรื่อง" },
    ],
    followUps: [
      { text: "อยู่ใกล้กับพ่อแม่หรือเปล่า · ได้ดูแลบ่อยไหม?", tag: "ตามต่อ" },
      { text: "พ่อแม่/คนใกล้ตัวมีปัญหาสุขภาพอะไรบ้างไหม?",     tag: "ตามต่อ · sensitive" },
      { text: "ถ้ามีอะไรเกิดขึ้นกับเขา ใครจะดูแล?",            tag: "ตามต่อ · deep" },
    ],
    signals: [
      { emoji: "✅", text: "มีคนใกล้ตัวที่ห่วง · อยากให้สุขภาพดี" },
      { emoji: "✅", text: "พ่อแม่/ปู่ย่า มี NCDs (เบาหวาน · ความดัน)" },
      { emoji: "✅", text: "พูดถึงครอบครัวด้วยน้ำเสียงอบอุ่น" },
      { emoji: "⚠️", text: "ปิดเรื่องครอบครัว · เปลี่ยนหัวข้อทันที" },
    ],
    ratingScale: [
      { value: 1, label: "ปิด",    meaning: "ไม่อยากเล่า · ครอบครัวไม่ใช่ priority" },
      { value: 2, label: "กลาง",   meaning: "เล่าบ้าง · มีคนใกล้ตัวแต่ไม่เด่นชัด" },
      { value: 3, label: "เปิด",   meaning: "เปิดเผย · มีคนที่อยากให้สุขภาพดี" },
    ],
  },

  {
    key: "O",
    label: "Occupation",
    fullName: "งาน · อาชีพ",
    description: "ทำงานอะไร · พอใจไหม · เปิดเรื่อง income เสริมแค่ไหน",
    whyMatters:
      "ถ้าไม่แฮปปี้กับงาน หรืออยากมี income ช่องที่ 2 — นี่คือ door opener ตรงๆ · แต่ถ้าภูมิใจในงานมาก ๆ ก็ไม่ต้องฝืน",
    icon: "💼",
    accent: "science",
    openers: [
      { text: "ทำงานอะไรอยู่หรอครับ/คะ?",                 tag: "เปิดเรื่อง" },
      { text: "ทำมานานแล้วเหรอ?",                          tag: "เปิดเรื่อง" },
      { text: "เป็นยังไงงานช่วงนี้ · เหนื่อยมั้ย?",         tag: "เปิดเรื่อง" },
    ],
    followUps: [
      { text: "ชอบงานที่ทำอยู่ไหม · มีอะไรอยากเปลี่ยนไหม?",   tag: "ตามต่อ" },
      { text: "ถ้ามีโอกาสได้ทำอย่างอื่น · จะทำอะไร?",          tag: "ตามต่อ · open door" },
      { text: "income หลักพอใช้ไหม · มีรายได้เสริมไหม?",      tag: "ตามต่อ · sensitive" },
    ],
    signals: [
      { emoji: "✅", text: "ไม่แฮปปี้กับงาน · อยากมี option" },
      { emoji: "✅", text: "ทำงานหนัก · ไม่มีเวลาดูแลสุขภาพ" },
      { emoji: "✅", text: "เปิดรับ income ช่องที่ 2" },
      { emoji: "⚠️", text: "ภูมิใจในงาน 100% · ปิดเรื่อง side income" },
    ],
    ratingScale: [
      { value: 1, label: "ปิด",    meaning: "พอใจงานปัจจุบัน · ไม่สนใจช่องทางใหม่" },
      { value: 2, label: "กลาง",   meaning: "OK แต่อยากมีเพิ่ม · ฟังได้" },
      { value: 3, label: "เปิด",   meaning: "อยากเปลี่ยน/เสริม · เปิดทันที" },
    ],
  },

  {
    key: "R",
    label: "Recreation",
    fullName: "ไลฟ์สไตล์ · งานอดิเรก",
    description: "ว่างทำอะไร · ใส่ใจสุขภาพแค่ไหน · มีเวลาแค่ไหน",
    whyMatters:
      "คนที่ดูแลตัวเองอยู่แล้วบางส่วน = พร้อม upgrade · คนที่ไม่ใส่ใจเลย = ต้องใช้เวลานานกว่า + เริ่มจาก education",
    icon: "🌿",
    accent: "wellness",
    openers: [
      { text: "วันว่างชอบทำอะไรครับ/คะ?",                    tag: "เปิดเรื่อง" },
      { text: "ออกกำลังบ้างไหม?",                           tag: "เปิดเรื่อง" },
      { text: "ดูแลตัวเรื่องอาหารยังไงบ้าง?",                tag: "เปิดเรื่อง" },
    ],
    followUps: [
      { text: "เคยลองอะไรเพื่อสุขภาพไหม · ติดอะไร?",          tag: "ตามต่อ" },
      { text: "กิน supplement อยู่ไหม · เคยลองไหม?",          tag: "ตามต่อ · qualifier" },
      { text: "ถ้ามีโอกาสได้เปลี่ยนสุขภาพ · จะเริ่มจากอะไร?", tag: "ตามต่อ · open" },
    ],
    signals: [
      { emoji: "✅", text: "ใส่ใจสุขภาพอยู่แล้ว · ออกกำลังสม่ำเสมอ" },
      { emoji: "✅", text: "เคยลอง supplement · พร้อมเรียนรู้" },
      { emoji: "✅", text: "มีเวลาให้ตัวเอง · ไม่ติดงานหนัก" },
      { emoji: "⚠️", text: "ไม่มีเวลา · ไม่ใส่ใจสุขภาพเลย · เริ่มยาก" },
    ],
    ratingScale: [
      { value: 1, label: "ปิด",    meaning: "ไม่ใส่ใจสุขภาพ · ไม่มีเวลา" },
      { value: 2, label: "กลาง",   meaning: "บ้าง · เริ่มสนใจแต่ไม่ทำต่อเนื่อง" },
      { value: 3, label: "เปิด",   meaning: "ใส่ใจอยู่แล้ว · พร้อม upgrade" },
    ],
  },

  {
    key: "M",
    label: "Money",
    fullName: "เงิน · เป้าหมายทางการเงิน",
    description: "ทัศนคติเรื่องเงิน · ยอมจ่ายเพื่อสุขภาพไหม · มีเป้าหมาย?",
    whyMatters:
      "Money เป็นเรื่อง sensitive — เปิดอย่างนุ่ม · ไม่ถามตรง ๆ เรื่องรายได้ · ใช้คำถามเรื่อง 'เป้าหมาย/ความฝัน' แทน",
    icon: "💎",
    accent: "amber",
    openers: [
      { text: "มีอะไรอยากเก็บเงินซื้อในเร็ว ๆ นี้ไหม?",         tag: "เปิดเรื่อง · soft" },
      { text: "ถ้ามี income เสริม · อยากเอาไปทำอะไรเป็นอย่างแรก?", tag: "เปิดเรื่อง · open door" },
      { text: "วางแผนชีวิตอีก 5 ปีไว้ยังไงบ้าง?",               tag: "เปิดเรื่อง · deep" },
    ],
    followUps: [
      { text: "เคยลงทุนกับสุขภาพตัวเองไหม · เช่น fitness · supplement?", tag: "ตามต่อ · qualifier" },
      { text: "ถ้ามีโอกาสทำสุขภาพ + รายได้ไปพร้อมกัน · จะลองดูไหม?",      tag: "ตามต่อ · pivot" },
      { text: "เป้าใหญ่สุดที่อยากให้ครอบครัวมีคืออะไร?",                   tag: "ตามต่อ · heart" },
    ],
    signals: [
      { emoji: "✅", text: "มีเป้าหมาย · มีความฝัน · เปิดรับ income เสริม" },
      { emoji: "✅", text: "ยอมจ่ายเพื่อสุขภาพ · เคยลงทุนกับตัวเอง" },
      { emoji: "✅", text: "มี cashflow stable · ไม่ติด debt หนัก" },
      { emoji: "⚠️", text: "ติดหนี้หนัก · cashflow ติดลบ · ไม่ใช่จังหวะ" },
    ],
    ratingScale: [
      { value: 1, label: "ปิด",    meaning: "ไม่พร้อม · debt หนัก · ไม่มีเป้า" },
      { value: 2, label: "กลาง",   meaning: "มี cashflow · มีเป้าแต่ไม่ชัด" },
      { value: 3, label: "เปิด",   meaning: "มีเป้า · มีกำลังจ่าย · พร้อมลงทุน" },
    ],
  },
];

export interface AnalysisVerdict {
  level: "strong" | "borderline" | "warm" | "not_ready";
  emoji: string;
  label: string;
  color: "wellness" | "amber" | "rose" | "ink";
  message: string;
  nextActions: string[];
}

export function analyzeForm(scores: Partial<Record<FormKey, 1 | 2 | 3>>): AnalysisVerdict {
  const values: number[] = (["F", "O", "R", "M"] as FormKey[]).map((k) => scores[k] ?? 0);
  const total = values.reduce((s, v) => s + v, 0);
  const allFilled = values.every((v) => v > 0);

  if (!allFilled) {
    return {
      level: "not_ready",
      emoji: "✏️",
      label: "ยังกรอกไม่ครบ",
      color: "ink",
      message: "กรอกครบทั้ง 4 ด้านก่อนนะ · ค่อยมาดูคำแนะนำ",
      nextActions: [],
    };
  }

  if (total >= 10) {
    return {
      level: "strong",
      emoji: "🟢",
      label: "Strong fit · พร้อมเปิด",
      color: "wellness",
      message: "Prospect คนนี้พร้อม · เปิดได้ตรง · มี pain + กำลังจ่าย + เปิดใจ · ใช้โอกาสนี้ให้คุ้ม",
      nextActions: [
        "💚 นัดเจอ 1-on-1 · เสนอ BCA หรือ Health Check รอบหน้า",
        "💚 เล่าเคสสำเร็จที่ profile คล้ายๆ กัน",
        "💚 อย่ารีบขาย · build trust ก่อน 2-3 ครั้ง",
        "💚 ส่ง content ที่ตรงกับ pain ที่ได้ฟังมา",
      ],
    };
  }

  if (total >= 7) {
    return {
      level: "borderline",
      emoji: "🟡",
      label: "Borderline · ใช้ tool ทดสอบความสนใจ",
      color: "amber",
      message: "มีสัญญาณบวกบางอย่าง · ยังต้องการ proof + เวลา · ใช้ tool soft ๆ ก่อน hard pitch",
      nextActions: [
        "💛 ส่ง Health Check quiz · ดูว่ายอมทำไหม",
        "💛 ส่ง content ทุก 1-2 สัปดาห์ · อย่ารบกวน",
        "💛 ชวนไป event/talk แทนการนัดส่วนตัว",
        "💛 รอ trigger event (สุขภาพแย่ลง · มีเงินก้อน · เปลี่ยนงาน)",
      ],
    };
  }

  if (total >= 5) {
    return {
      level: "warm",
      emoji: "🟠",
      label: "Warm list · keep relationship",
      color: "amber",
      message: "ยังไม่ใช่จังหวะ · แต่อย่าเลิกคุย · keep ความสัมพันธ์ไว้ · life ของเขาอาจเปลี่ยน",
      nextActions: [
        "🧡 contact ทุกๆ 1-2 เดือน · ทักทายธรรมดา",
        "🧡 ส่ง content ที่ relate กับ pain ที่ฟังมา",
        "🧡 ฟังต่อ · รอสัญญาณว่าพร้อมขึ้น",
        "🧡 อย่ากด · ความสัมพันธ์สำคัญกว่ายอด",
      ],
    };
  }

  return {
    level: "not_ready",
    emoji: "🔴",
    label: "Not ready · ปล่อยไปก่อน",
    color: "rose",
    message: "Profile ไม่ตรงกับโอกาสตอนนี้ · ไม่ต้อง force · เลือกใช้พลังงานกับคนที่ใช่กว่า",
    nextActions: [
      "❤️ ไม่ต้องตามต่อ · อย่าเสียพลังงาน",
      "❤️ keep ความสัมพันธ์ปกติ · ไม่ pitch · ไม่ rebottle",
      "❤️ ถ้าวันหนึ่งเขามาหา = เขาพร้อม · ค่อยช่วย",
    ],
  };
}
