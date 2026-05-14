/**
 * Gemini Vision wrapper — food image analysis
 *
 * Input: base64 image + optional context (meal time, customer profile)
 * Output: structured JSON (food, macros, glucose impact, health score, recs)
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const SYSTEM_PROMPT = `คุณคือ AI ของ UP Wellness — food analysis tool
หน้าที่: วิเคราะห์ภาพอาหารและประเมิน nutritional impact + คำแนะนำที่ปฏิบัติได้

หลักการ:
- ภาษาไทย เป็นกันเอง · ใช้ "เรา/คุณ" · ห้ามใช้ "ผู้ป่วย"
- ห้ามคำว่า "รักษา · ป้องกัน · หาย · 100% · miracle"
- ประเมินตามตาเห็น ถ้าไม่ชัด → "ประมาณการ" หรือ range
- Macros เป็น estimate · ไม่ใช่ lab-precise

Glucose impact score (1-10):
- 1-3 = ไม่กระทบ glucose มาก (โปรตีน · ผัก · ไขมันดี)
- 4-6 = ปานกลาง (whole grain · ผลไม้ low GI · อาหารผสม)
- 7-10 = spike แรง (refined carb · น้ำตาล · ข้าวขาวเยอะ · น้ำหวาน)

Health score (1-10):
- 1-3 = ไม่ดี (junk · fried · processed · high sodium)
- 4-6 = พอใช้ (balanced แต่ portion เกิน หรือมีจุดอ่อน)
- 7-10 = ดี (whole food · balanced macro · มี fiber + protein)

Nutrilite SKU แนะนำได้เฉพาะรายการนี้:
- Calow (block แป้ง/น้ำตาล · 2 เม็ดก่อนมื้อ 15-20 นาที)
- Fiber Powder (blunt glucose spike · ก่อน/กับมื้อ)
- Triple Omega (anti-inflammatory · กับมื้อ)
- Bio C (antioxidant · เช้า)
- Vitamin B Plus (B-complex · เช้า)
- All Plant Protein (เสริม protein · กับมื้อหรือเป็นมื้อเอง)
- CoQ10 (mitochondrial · เช้า)
- Probiotic (gut · ตอนท้องว่าง)
- DoubleX (multi-vitamin · กับมื้อ)

OUTPUT: JSON เท่านั้น
{
  "food_identified":   "ชื่ออาหารหลัก",
  "food_components":   ["อาหารส่วนประกอบที่เห็น 1", "..."],
  "estimated_portion": "ขนาดมื้อโดยประมาณ",
  "calories_estimate": 650,
  "macros": {
    "carb_g":    75,
    "protein_g": 28,
    "fat_g":     28,
    "fiber_g":   3
  },
  "glucose_impact": {
    "score":       8,
    "explanation": "เหตุผลสั้นๆ ทำไมได้ score นี้"
  },
  "health_score": {
    "score": 5,
    "pros":  ["จุดดี 1", "..."],
    "cons":  ["จุดอ่อน 1", "..."]
  },
  "recommendations": {
    "modifications":   ["วิธีปรับ portion/ส่วนผสม 1-3 ข้อ"],
    "nutrilite_skus":  [
      { "sku": "Calow", "reason": "ก่อนมื้อนี้ 2 เม็ด 15-20 นาที · block แป้ง 300 kcal" }
    ]
  },
  "alternative_meals": ["ตัวเลือกอาหารทดแทนที่ healthier 1-2 อย่าง"]
}

ถ้าไม่ใช่อาหาร หรือมองไม่ออก → output:
{
  "food_identified": "ไม่สามารถระบุได้",
  "error": "เหตุผล"
}`;

export interface NutriScanResult {
  food_identified:   string;
  food_components?:  string[];
  estimated_portion?: string;
  calories_estimate?: number;
  macros?: {
    carb_g:    number;
    protein_g: number;
    fat_g:     number;
    fiber_g:   number;
  };
  glucose_impact?: {
    score:       number;
    explanation: string;
  };
  health_score?: {
    score: number;
    pros:  string[];
    cons:  string[];
  };
  recommendations?: {
    modifications:  string[];
    nutrilite_skus: Array<{ sku: string; reason: string }>;
  };
  alternative_meals?: string[];
  error?: string;
}

export interface NutriScanInput {
  imageBase64: string;   // base64 without data URL prefix
  mimeType:    string;   // e.g., "image/jpeg"
  context?: {
    meal_time?:    string;   // "breakfast" | "lunch" | "dinner" | "snack"
    customer_note?: string;  // optional context (e.g., "ลูกค้าเป็น pre-diabetes")
  };
}

export async function analyzeFood(input: NutriScanInput): Promise<NutriScanResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const contextNote = input.context
    ? `\n\nบริบทเพิ่มเติม:\n- เวลามื้อ: ${input.context.meal_time ?? "ไม่ระบุ"}\n- บันทึก: ${input.context.customer_note ?? "ไม่มี"}`
    : "";

  const userText = `วิเคราะห์ภาพอาหารนี้และ output JSON ตาม schema ใน system prompt
- ระบุอาหารที่เห็น · ประมาณ portion · macros · calorie
- ให้ glucose_impact score 1-10 + อธิบาย
- ให้ health_score 1-10 + pros/cons
- แนะนำ modifications + Nutrilite SKU ที่เกี่ยวข้อง${contextNote}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: userText },
            { inline_data: { mime_type: input.mimeType, data: input.imageBase64 } },
          ],
        }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature:      0.3,
          maxOutputTokens:  4096,
          responseMimeType: "application/json",
          thinkingConfig:   { thinkingBudget: 0 },
        },
      }),
    },
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini Vision failed: ${res.status} ${t}`);
  }

  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  let parsed: NutriScanResult;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`NutriScan invalid JSON: ${text.slice(0, 300)}`);
  }
  return parsed;
}
