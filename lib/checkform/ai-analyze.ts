/**
 * Gemini analyzer for Check FORM lead qualification.
 * Takes structured profile + DISC + optional FORM scores
 * Returns: approach · dialog samples · product/business ratio · roleplay
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const SYSTEM_PROMPT = `คุณคือ AI ของ UP Wellness Ops — เครื่องมือช่วย ABO (Amway business owner) วิเคราะห์ prospect ก่อนเปิดบทสนทนา

หน้าที่: รับข้อมูล profile + DISC + (optional FORM scores) → วิเคราะห์ว่าควรเข้าหาคนนี้ยังไง

หลักการ:
- โทน: ใช้แนวที่ปรึกษา · ไม่ใช่ sales script · เคารพ prospect · "ฟังก่อน · ขายทีหลัง"
- ห้ามใช้คำว่า "ปิดดีล · ปั่น · กด · push · pressure"
- ใช้คำว่า "ชวนคุย · ถาม · แชร์ · เชื่อมความสนใจ"
- อ้างอิง DISC สำหรับการเลือก tone · pace · proof-style
- อ้างอิง income range + lifestyle สำหรับ product entry point
- อ้างอิง family situation + job satisfaction สำหรับ business opportunity entry
- ห้ามใช้คำว่า "รักษา · ป้องกัน · 100% · miracle" (Amway compliance)
- ห้ามอ้างชื่อสินค้า Nutrilite ที่ไม่อยู่ใน catalog (Triple Omega · CoQ10 · Vitamin B Plus · Bio C · Calow · Double X · All Plant Protein)
- ทุกอย่างเป็นภาษาไทย (English term เฉพาะคำเทคนิค)

DISC reference:
- D (Dominance) — ตรงประเด็น · ตัวเลข ROI · เคารพเวลา · ไม่อ้อม
- I (Influence) — story-telling · recognition · ภาพ success · community
- S (Steadiness) — ไม่กด · build trust · proof · ครอบครัว · safety
- C (Conscientiousness) — ตัวเลข · evidence · ให้เวลา · skeptical-friendly

Product vs Business angle:
- Product = เน้นสุขภาพ · เสนอ Health Check · BCA · Nutrilite stack
- Business = เน้นโอกาส · เสนอ Amway compensation · case study · plan
- ใช้ ratio (0-100 รวม 100) ตาม:
  * job satisfaction ต่ำ + income < ที่ต้องการ → business angle สูง
  * income mid-high + health awareness สูง → product angle สูง
  * family with NCDs → product angle สูง
  * pure aspirational + free time → business angle สูง
  * mix gives mixed approach

Roleplay:
- จำลองบทสนทนาจริง 6-10 turn · สลับ ABO กับ prospect
- แสดงให้เห็นว่า approach แนะนำ ทำงานยังไงในสถานการณ์จริง
- prospect ตอบโต้บ้าง · ABO ปรับ tone · มี curve อย่างน้อย 1
- จบด้วยขั้น next step (นัด · ส่ง content · ค้นหาเพิ่ม)

OUTPUT: JSON เท่านั้น ตาม schema:
{
  "summary":     "ภาพรวม 2-3 ประโยค · profile นี้คือคนแบบไหน · จุดเด่นที่ต้องใช้",
  "approach": {
    "type":        "product | business | mixed",
    "productRatio":   0-100,
    "businessRatio":  0-100,
    "reasoning":   "เหตุผล 2-3 ประโยค ว่าทำไม ratio นี้"
  },
  "firstMove": {
    "when":  "เมื่อไหร่/จังหวะไหนเข้าได้ดี",
    "where": "ที่ไหน · setting แบบไหนเหมาะ",
    "how":   "เริ่มยังไง 1-2 ประโยค"
  },
  "discNotes":   "ข้อสังเกตเรื่อง DISC ของ prospect · ปรับ tone ยังไง (ถ้ามี DISC ระบุ)",
  "dialogSamples": [
    {
      "context": "เรื่องไหน · ช่วงไหนของบทสนทนา",
      "line":    "ประโยคที่ใช้พูดจริง · ภาษาธรรมชาติ",
      "why":     "ทำไมประโยคนี้ work กับ profile นี้"
    }
  ],
  "redFlags": ["สิ่งที่ต้องหลีกเลี่ยง · 2-3 ข้อ"],
  "roleplay": [
    { "speaker": "abo",      "text": "...", "note": "optional teaching note" },
    { "speaker": "prospect", "text": "..." }
  ],
  "nextSteps": ["ขั้นถัดไปแบบ specific · 3-4 ข้อ"]
}`;

export interface CheckformProfile {
  prospectName?: string;
  meetingContext?: string;
  demographics: {
    ageRange?: string;
    gender?: string;
    education?: string;
    marital?: string;
  };
  career: {
    occupation?: string;
    occupationDetail?: string;
    incomeRange?: string;
    jobSatisfaction?: string;
  };
  lifestyle: {
    healthAwareness?: string;
    exerciseFreq?: string;
    dietStyle?: string;
    hobbies?: string[];
    timeAvailable?: string;
  };
  family: {
    deps?: string;
    health?: string;
    finance?: string;
  };
  disc?: {
    primary?: "D" | "I" | "S" | "C";
    secondary?: "D" | "I" | "S" | "C";
    confidence?: "guessing" | "maybe" | "certain";
  };
  formScores?: { F?: number; O?: number; R?: number; M?: number };
  formNotes?: { F?: string; O?: string; R?: string; M?: string };
}

export interface AIAnalysis {
  summary: string;
  approach: {
    type: "product" | "business" | "mixed";
    productRatio: number;
    businessRatio: number;
    reasoning: string;
  };
  firstMove: {
    when: string;
    where: string;
    how: string;
  };
  discNotes?: string;
  dialogSamples: Array<{ context: string; line: string; why: string }>;
  redFlags: string[];
  roleplay: Array<{ speaker: "abo" | "prospect"; text: string; note?: string }>;
  nextSteps: string[];
}

export async function analyzeProspectWithGemini(profile: CheckformProfile): Promise<AIAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const userPrompt = `# Prospect Profile

${JSON.stringify(profile, null, 2)}

# Task
- วิเคราะห์ profile · output JSON ตาม schema
- productRatio + businessRatio รวมต้อง = 100
- dialogSamples: 3-5 ประโยค · ทุกประโยค personalized ตาม profile
- roleplay: 6-10 turn · สลับ abo/prospect · มี curve · จบ next step
- ภาษาไทยล้วน · โทนเป็นกันเอง · ไม่ใช่ sales pressure`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini fetch failed: ${res.status} ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const finishReason = json.candidates?.[0]?.finishReason;

  let parsed: AIAnalysis;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Gemini invalid JSON (finishReason=${finishReason}): ${text.slice(0, 300)}`);
  }

  // Defensive defaults
  parsed.approach = parsed.approach ?? { type: "mixed", productRatio: 50, businessRatio: 50, reasoning: "" };
  parsed.firstMove = parsed.firstMove ?? { when: "", where: "", how: "" };
  parsed.dialogSamples = parsed.dialogSamples ?? [];
  parsed.redFlags = parsed.redFlags ?? [];
  parsed.roleplay = parsed.roleplay ?? [];
  parsed.nextSteps = parsed.nextSteps ?? [];

  // Normalize ratio to sum to 100
  const sum = parsed.approach.productRatio + parsed.approach.businessRatio;
  if (sum !== 100 && sum > 0) {
    const factor = 100 / sum;
    parsed.approach.productRatio = Math.round(parsed.approach.productRatio * factor);
    parsed.approach.businessRatio = 100 - parsed.approach.productRatio;
  }

  return parsed;
}
