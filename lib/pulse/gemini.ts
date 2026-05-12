/**
 * Gemini 1.5 Flash wrapper — free tier API.
 * Get key at: https://aistudio.google.com/app/apikey → env var GEMINI_API_KEY
 *
 * Used as RE-PHRASER ONLY — turns rule engine output into coach-tone Thai.
 * Strict prompt: no new claims, no new SKUs, just rephrase.
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const SYSTEM_PROMPT = `คุณคือ rephrasing layer สำหรับ UP Wellness wellness coach
หน้าที่: เปลี่ยน rule engine output เป็นภาษาไทยโทน coach ที่อบอุ่น น่าเชื่อถือ ตรงประเด็น
กฎเหล็ก:
- ห้ามแนะนำ nutrient หรือ SKU ที่ไม่อยู่ใน input
- ห้ามวินิจฉัยโรค ("คุณเป็น...") ใช้คำว่า "ข้อมูล associated with..." / "อาจ support..."
- ห้ามใช้คำว่า "รักษา" "ป้องกัน" "miracle" "100%"
- ใช้คำว่า "อาจช่วย" "associated" "support" "พบในการศึกษา"
- ภาษาไทยใช้สรรพนาม "เรา/คุณ" — เป็นกันเอง แต่มีน้ำหนัก
- โครงสร้าง: 1) สังเกตจากข้อมูล 2) แปลผล 3) แนะนำ SKU + dose + เหตุผล
- ห้ามมีบรรทัด ที่ใช้ markdown heading ใหญ่ — ใช้ bullet หรือบรรทัดสั้นๆ

OUTPUT: JSON เท่านั้น ตาม schema:
{
  "summary":      "ภาพรวม 2-3 ประโยค ของสิ่งที่เห็นจากข้อมูล",
  "observations": ["จุดที่ 1...", "จุดที่ 2..."],
  "recommendations": [
    {
      "category":  "ชื่อหมวด nutrient",
      "why":       "เหตุผลทางวิทยาศาสตร์ (รวม citation จาก input)",
      "evidence_grade": "A | B | C",
      "skus": [{ "sku": "ชื่อ SKU", "dose": "วิธีกิน", "timing": "เวลา (optional)" }]
    }
  ],
  "next_step": "ข้อแนะนำขั้นต่อไปสำหรับลูกค้า 1-2 ประโยค"
}`;

export interface GeminiRephraseInput {
  customer_name: string;
  age?:          number;
  gender?:       string;
  biomarkers:    Record<string, any>;
  matched_rules: Array<{
    name: string;
    nutrient_category: string;
    why_th: string;
    evidence_grade: string;
    citation: string;
    skus: Array<{ sku: string; dose: string; timing?: string }>;
  }>;
  intake: {
    goal:        string | null;
    budget:      string | null;
    medications: string[];
    conditions:  string[];
  };
}

export interface GeminiOutput {
  summary:      string;
  observations: string[];
  recommendations: Array<{
    category:        string;
    why:             string;
    evidence_grade:  string;
    skus:            Array<{ sku: string; dose: string; timing?: string }>;
  }>;
  next_step:    string;
}

export async function rephraseWithGemini(input: GeminiRephraseInput): Promise<GeminiOutput> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const userPrompt = `ลูกค้า: ${input.customer_name}${input.age ? ` (อายุ ${input.age} ปี)` : ""}${input.gender ? ` · ${input.gender === "male" ? "ชาย" : "หญิง"}` : ""}

ข้อมูลจาก wearable (7 วัน):
${JSON.stringify(input.biomarkers, null, 2)}

ข้อมูลจาก intake:
- เป้าหมาย: ${input.intake.goal ?? "—"}
- งบประมาณ: ${input.intake.budget ?? "—"}
- ยาประจำ: ${input.intake.medications.join(", ") || "ไม่มี"}
- โรคประจำตัว: ${input.intake.conditions.join(", ") || "ไม่มี"}

Rules ที่ match (rephrase สิ่งเหล่านี้เป็นภาษาไทยที่ลูกค้าอ่านเข้าใจ):
${JSON.stringify(input.matched_rules, null, 2)}

แปลและจัดเรียงเป็น output JSON ตาม schema`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature:     0.4,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          // Disable thinking for Gemini 2.5 — we only need rephrasing, no deep reasoning
          // Saves token budget so response doesn't get truncated
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini fetch failed: ${res.status} ${t}`);
  }
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const finishReason = json.candidates?.[0]?.finishReason;

  let parsed: GeminiOutput;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Try to repair truncated JSON: trim to last complete brace/bracket
    const trimmed = text.replace(/,\s*$/, "").replace(/[,\s]*$/, "") + "}}}}]}";
    try { parsed = JSON.parse(trimmed); }
    catch {
      const reason = finishReason ? ` (finishReason=${finishReason})` : "";
      throw new Error(`Gemini invalid JSON${reason}: ${text.slice(0, 300)}`);
    }
  }

  // Validate: every SKU in output must exist in input
  const allowedSkus = new Set(input.matched_rules.flatMap((r) => r.skus.map((s) => s.sku)));
  for (const rec of parsed.recommendations ?? []) {
    rec.skus = (rec.skus ?? []).filter((s) => allowedSkus.has(s.sku));
  }

  return parsed;
}
