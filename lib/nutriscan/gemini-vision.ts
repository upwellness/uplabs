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

"components" = แยกแต่ละองค์ประกอบของจานนี้พร้อมสัดส่วน:
- name = ชื่อองค์ประกอบ (เช่น ข้าวสวย · หมูสับผัด · ไข่ดาว · ผัก)
- pct  = สัดส่วนโดยประมาณของทั้งจาน (% โดยน้ำหนัก/ปริมาณ) · รวมทุก component ควรใกล้ 100
- carb_g / protein_g / fat_g = macros โดยประมาณของ component นั้น (ถ้าประเมินได้ · ไม่บังคับ)
ผลรวม carb_g/protein_g/fat_g ของทุก component ควรสอดคล้องกับ macros รวมด้านล่าง

OUTPUT: JSON เท่านั้น
{
  "food_identified":   "ชื่ออาหารหลัก",
  "food_components":   ["อาหารส่วนประกอบที่เห็น 1", "..."],
  "components": [
    { "name": "ข้าวสวย",     "pct": 45, "carb_g": 55, "protein_g": 4,  "fat_g": 1 },
    { "name": "หมูสับผัด",   "pct": 35, "carb_g": 3,  "protein_g": 20, "fat_g": 18 },
    { "name": "ไข่ดาว",      "pct": 20, "carb_g": 1,  "protein_g": 7,  "fat_g": 9 }
  ],
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

/** One food component of the dish with its estimated share (% of the dish). */
export interface NutriScanComponent {
  name:       string;
  pct:        number;       // % of the dish (by weight/volume)
  carb_g?:    number;
  protein_g?: number;
  fat_g?:     number;
}

export interface NutriScanResult {
  food_identified:   string;
  food_components?:  string[];          // legacy: flat list of components (kept for backward-compat)
  components?:       NutriScanComponent[]; // per-ingredient breakdown with % share
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
  imageBase64?: string;   // base64 without data URL prefix · OR
  mimeType?:    string;   // image mime · paired with imageBase64
  textDescription?: string;  // text description instead of image
  context?: {
    meal_time?:    string;
    customer_note?: string;
  };
}

export async function analyzeFood(input: NutriScanInput, apiKey: string): Promise<NutriScanResult> {
  if (!apiKey) throw new Error("กรุณาใส่ API Key");

  if (!input.imageBase64 && !input.textDescription) {
    throw new Error("ต้องมี imageBase64 หรือ textDescription อย่างน้อย 1 อย่าง");
  }

  const note = input.context?.customer_note?.trim();
  const noteLine = note
    ? `\n- ข้อมูลเพิ่มเติมจากผู้ใช้ (ใช้ช่วยประเมินเมื่อรูปกะสัดส่วนไม่เป๊ะ): ${note}`
    : "";
  const contextNote = input.context
    ? `\n\nบริบทเพิ่มเติม:\n- เวลามื้อ: ${input.context.meal_time ?? "ไม่ระบุ"}${noteLine}`
    : "";

  const inputDescriber = input.imageBase64
    ? "ภาพอาหารนี้"
    : `อาหารที่อธิบายไว้ว่า: "${input.textDescription}"`;

  const userText = `วิเคราะห์${inputDescriber}และ output JSON ตาม schema ใน system prompt
- ระบุอาหาร · ประมาณ portion · macros · calorie
- ให้ glucose_impact score 1-10 + อธิบาย
- ให้ health_score 1-10 + pros/cons
- แนะนำ modifications + Nutrilite SKU ที่เกี่ยวข้อง${contextNote}`;

  const parts: any[] = [{ text: userText }];
  if (input.imageBase64 && input.mimeType) {
    parts.push({ inline_data: { mime_type: input.mimeType, data: input.imageBase64 } });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
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
