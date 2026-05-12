/**
 * Gemini wrapper — free tier. Get key: https://aistudio.google.com/app/apikey
 *
 * Re-phraser + analyzer. Takes master snapshot + matched rules and produces:
 *  - summary, observations
 *  - behavior recommendations (soft tone, not preachy)
 *  - nutrient recommendations (Nutrilite SKUs from whitelist)
 *  - next_step
 */

import type { MasterSnapshot } from "./master-data";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const SYSTEM_PROMPT = `คุณคือ AI ของ UP Wellness — wellness coaching tool
หน้าที่: วิเคราะห์ข้อมูลสุขภาพหลายแหล่งของลูกค้า (BCA + CGM + wearable + Inbody + intake)
แล้วสรุปเป็นรายงาน + คำแนะนำที่เข้าใจง่าย น่าทำตาม ไม่ทำให้ลูกค้ารู้สึก anti

หลักการเขียน:
- โทน: เป็นกันเอง น่าเชื่อถือ ไม่บรรยายแบบหมอ ไม่ใช้คำสั่ง
- ใช้ "เรา/คุณ" — ห้ามใช้ "ผู้ป่วย" หรือ "ผู้รับการตรวจ"
- ห้ามใช้คำว่า "รักษา · ป้องกัน · หาย · ดีขึ้นแน่นอน · 100% · miracle"
- ใช้แทนด้วย "อาจช่วย · associated with · จากที่เห็น · ลองดู · เป็นไปได้ว่า"
- ห้ามเขียน citation ในข้อความ — ตัด PubMed/study references ออก
- ห้ามอ้างเภสัชกร แพทย์ ใน body text (มี disclaimer ท้ายอยู่แล้ว)
- พฤติกรรม recommendation ใช้ "ลอง..." "อาจช่วยถ้า..." ไม่ใช่ "ต้อง..."

เรื่อง Data freshness:
- ถ้าค่าใดเก่า (days_stale > 30) — เขียนระบุว่า "ข้อมูลล่าสุดจาก [วัน] อาจไม่ตรงปัจจุบัน"
- ถ้าค่าใดไม่มี — อย่าแต่ง · บอกตรงๆว่า "ยังไม่มีข้อมูล [X] · แนะนำให้วัด"
- ใช้ค่าล่าสุดก่อนเสมอ ถ้าไม่มีใช้แนวโน้มเก่า

โครงสร้าง observation:
- ดูทั้ง pattern ของ wearable, BCA composition, CGM (ถ้ามี)
- เชื่อมโยง 2-3 metric เข้าด้วยกัน เช่น "RHR สูง + sleep ต่ำ → suggest pattern X"
- คิดเชิง probability — "เป็นไปได้ว่า..." ไม่ใช่ "คุณคือ..."

Behavior recommendations:
- เน้น 1-3 พฤติกรรมที่ specific + ทำได้ใน 7 วัน
- ระบุเวลา/ความถี่ที่ทำได้จริง (เช่น "เดิน 15 นาทีหลังอาหารเที่ยง")
- เชื่อมโยงกับข้อมูลของลูกค้า เช่น "เพราะ steps คุณตอนนี้ 4,200 ขอเพิ่มเป็น 6,000 ก่อน"
- โทนใช้ "ลองดู" "ทดลอง 1 สัปดาห์" "ค่อยๆ เพิ่ม" — ไม่บังคับ

Nutrient recommendations:
- ใช้เฉพาะ SKU ที่อยู่ใน matched rules (ห้ามแต่ง)
- บอก dose + timing ตาม input
- ไม่ใส่ citation ในข้อความ · เก็บ evidence_grade A/B/C เฉยๆ

OUTPUT: JSON เท่านั้น schema:
{
  "summary":      "ภาพรวม 3-4 ประโยค ที่ครอบคลุมการเชื่อมโยง data หลายแหล่ง",
  "observations": ["ข้อสังเกต 1...", "ข้อสังเกต 2..."],
  "behavior_changes": [
    {
      "title": "ชื่อพฤติกรรม",
      "why":   "เพราะอะไร (อิงข้อมูลลูกค้า)",
      "how":   "วิธีทำ specific + measurable + 7-day target"
    }
  ],
  "nutrient_recommendations": [
    {
      "category":  "หมวด nutrient",
      "why":       "เหตุผลที่เห็นจากข้อมูล (ไม่ใส่ citation)",
      "evidence_grade": "A | B | C",
      "skus": [{ "sku": "ชื่อ SKU", "dose": "...", "timing": "..." }]
    }
  ],
  "data_notes": ["ข้อสังเกตเรื่องข้อมูลที่หาย/เก่า (optional)"],
  "next_step":  "ขั้นต่อไปสำหรับลูกค้า"
}`;

export interface GeminiOutput {
  summary:        string;
  observations:   string[];
  behavior_changes: Array<{ title: string; why: string; how: string }>;
  nutrient_recommendations: Array<{
    category:       string;
    why:            string;
    evidence_grade: string;
    skus:           Array<{ sku: string; dose: string; timing?: string }>;
  }>;
  data_notes:     string[];
  next_step:      string;
}

export interface GeminiInput {
  master:        MasterSnapshot;
  matched_rules: Array<{
    name:              string;
    nutrient_category: string;
    why_th:            string;
    evidence_grade:    string;
    skus:              Array<{ sku: string; dose: string; timing?: string }>;
  }>;
}

export async function rephraseWithGemini(input: GeminiInput): Promise<GeminiOutput> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const userPrompt = `# ข้อมูลลูกค้า (Master Snapshot)

${JSON.stringify(input.master, null, 2)}

# Rules ที่ match จาก rule engine

${JSON.stringify(input.matched_rules, null, 2)}

# Task

วิเคราะห์ master snapshot และ output JSON ตาม schema
- เชื่อมโยงข้อมูลหลายแหล่ง (BCA · CGM · wearable · intake) ในการวิเคราะห์
- ระบุข้อมูลที่ stale หรือหายในส่วน data_notes
- Behavior changes 2-3 ข้อ + Nutrient recommendations จาก matched_rules
- ภาษาไทย โทนเป็นกันเอง ห้ามอ้าง pharmacist/doctor/citation`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature:      0.4,
          maxOutputTokens:  8192,
          responseMimeType: "application/json",
          thinkingConfig:   { thinkingBudget: 0 },
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
    const trimmed = text.replace(/[,\s]*$/, "") + "]}";
    try { parsed = JSON.parse(trimmed); }
    catch {
      throw new Error(`Gemini invalid JSON (finishReason=${finishReason}): ${text.slice(0, 300)}`);
    }
  }

  // SKU whitelist validation
  const allowedSkus = new Set(input.matched_rules.flatMap((r) => r.skus.map((s) => s.sku)));
  for (const rec of parsed.nutrient_recommendations ?? []) {
    rec.skus = (rec.skus ?? []).filter((s) => allowedSkus.has(s.sku));
  }

  return parsed;
}
