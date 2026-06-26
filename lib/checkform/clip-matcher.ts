/**
 * STP Clip Matcher · Gemini reasoning-based recommender
 *
 * Reads lead profile (CheckformProfile) + optional AI analysis + active STP clips
 * → asks Gemini to reason and return 1-3 best-matched clips with rationale.
 *
 * Philosophy: NO formula · NO hardcoded targeting · AI reasons fresh each call.
 * Source spec: /STP/MATCHING.md (v2.0 production prompt)
 */

import type { CheckformProfile, AIAnalysis } from "./ai-analyze";
import { getActiveClipsForMatcher, type StpClip } from "@/app/checkform/_data/stp-clips";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const SYSTEM_PROMPT = `คุณคือ STP Matcher Agent ของ UP Wellness — ทำหน้าที่แนะนำ "คลิปคนสำเร็จ" ให้ ABO ส่งให้ prospect ฟัง

INPUT:
1. Lead profile (จาก CheckForm) — demographics · career · lifestyle · family · DISC · FORM scores
2. (Optional) AI analysis ของ lead (approach ratio · first move · red flags)
3. List of available clips จาก STP database (status=active เท่านั้น · มี facts ครบ)

JOB:
- อ่าน profile + AI analysis (ถ้ามี) ของ lead — รู้จัก context · pain · stage จริงๆ
- อ่าน facts ของแต่ละคลิป (speaker · content.pain_addressed · signals · trust_score)
- REASON dynamic ว่าคลิปไหน 1-3 ตัว resonate กับ lead มากที่สุด (ไม่ใช้ formula)
- ถ้าไม่มีคลิปไหน match แรงๆ → แนะนำน้อยกว่า 3 ก็ได้ · ห้ามแต่ง

PRINCIPLES:
- Reason จาก clip CONTENT + lead CONTEXT ใหม่ทุกครั้ง · ห้ามใช้ pre-mapped rules
- ดู signals.mood_tone กับ lead's DISC ตรงกันไหม:
  * D-personality → ชอบ direct · framework_driven · achievement-oriented
  * I-personality → ชอบ energetic · story_driven · inspirational
  * S-personality → ชอบ calm · warm · family-focused
  * C-personality → ชอบ structured · evidence-based · skeptic-friendly
- ดู content.pain_addressed กับ profile.career.jobSatisfaction · family.finance · lifestyle ตรงไหม
- ดู speaker_meta.previous_career กับ profile.career.occupation overlap ไหม (relate effect)
- ดู complexity_level vs lead's readiness (cold lead → beginner; decided → intermediate ok)
- trust_score เป็น soft preference (5=signature flagship · 4=strong)
- ห้ามแนะนำคลิปที่ confidence ต่ำกว่า 0.5

TONE OF share_message_th:
- เลียนแบบเสียง Jin หรือ Toni (UP Wellness)
- ไม่ pitch · ไม่ขาย · ชวนดูแบบ "พี่ลองดูคลิปนี้ก่อนนะคะ ตรงกับเรื่องที่คุยกันเลย..."
- 2-4 บรรทัด · personal · เชื่อมจุด pain ของ lead กับ content ในคลิป

TONE OF follow_up_question_th:
- คำถามเปิด หลัง lead ดูจบ
- ชวนสะท้อน ไม่ใช่ทดสอบ
- เช่น "ดูแล้วรู้สึกยังไงคะ?" / "ตรงไหนที่สะกิดใจสุด?"

OUTPUT: JSON strict format เท่านั้น:
{
  "matches": [
    {
      "clip_id": "PeeKui-Right-Tool",
      "confidence": 0.85,
      "why_this_clip": "เหตุผลเชิงเหตุผล 2-3 ประโยค · อ้าง specific facts จาก clip + specific context จาก lead",
      "key_signals_aligned": ["lead pain X ↔ clip pain_addressed Y", "lead DISC=C ↔ clip mood structured"],
      "potential_concerns": [],
      "share_message_th": "พี่ลองดูคลิปนี้ก่อนค่ะ ...",
      "follow_up_question_th": "ดูแล้วรู้สึกยังไงคะ?"
    }
  ],
  "reasoning_summary": "สรุป 1-2 ประโยค · ทำไมเลือก set นี้",
  "skipped_low_resonance_count": 0,
  "total_clips_evaluated": 5
}`;

// ────────────────────────────────────────────────────────────

export interface ClipMatch {
  clip_id: string;
  confidence: number;
  why_this_clip: string;
  key_signals_aligned: string[];
  potential_concerns: string[];
  share_message_th: string;
  follow_up_question_th: string;
}

export interface ClipRecommendations {
  matches: ClipMatch[];
  reasoning_summary: string;
  skipped_low_resonance_count: number;
  total_clips_evaluated: number;
}

/**
 * Build a slim clip list for the prompt (drop fields the model doesn't need).
 * Aggressively trimmed to keep prompt small + reduce Gemini latency
 * (avoids Vercel function timeout on Hobby tier).
 */
function trimClipsForPrompt(clips: StpClip[]) {
  return clips.map((c) => ({
    id: c.id,
    speaker: `${c.speaker.nickname || c.speaker.name} (${c.speaker.achievement_level})`,
    age_range: c.speaker.age_range,
    previous_career: c.speaker.previous_career,
    summary: c.content.summary.slice(0, 250),
    pain_addressed: c.content.pain_addressed,
    objections_addressed: c.content.objections_addressed,
    mood_tone: c.signals.mood_tone,
    appeal_style: c.signals.appeal_style,
    demographic_signals: c.signals.demographic_signals,
    trust_score: c.trust_score,
  }));
}

export async function recommendClipsWithGemini(input: {
  profile: CheckformProfile;
  analysis?: AIAnalysis | null;
}, apiKey: string): Promise<ClipRecommendations> {
  if (!apiKey) throw new Error("กรุณาใส่ API Key");

  const clips = getActiveClipsForMatcher();
  if (clips.length === 0) {
    return {
      matches: [],
      reasoning_summary: "ยังไม่มีคลิป active ใน STP database",
      skipped_low_resonance_count: 0,
      total_clips_evaluated: 0,
    };
  }

  const trimmedClips = trimClipsForPrompt(clips);

  const userPrompt = `# LEAD PROFILE (CheckForm)

${JSON.stringify(input.profile, null, 2)}

${
  input.analysis
    ? `# AI ANALYSIS ของ lead (already done)\n\n${JSON.stringify(
        {
          summary: input.analysis.summary,
          approach: input.analysis.approach,
          discNotes: input.analysis.discNotes,
          redFlags: input.analysis.redFlags,
        },
        null,
        2,
      )}\n\n`
    : ""
}# AVAILABLE STP CLIPS (active only)

${JSON.stringify(trimmedClips, null, 2)}

# TASK
- เลือก top 1-3 คลิป (อาจน้อยกว่าถ้าไม่ resonate)
- ทุก match ต้องมี why_this_clip ที่อ้าง specific facts (ไม่ใช่ "ดี" "ตรง" generic)
- share_message_th + follow_up_question_th ต้องสด · ไม่ template
- Output JSON strict ตาม schema`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1800, // 1-3 matches · ~200-300 tokens each + reasoning
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

  let parsed: ClipRecommendations;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Gemini invalid JSON (finishReason=${finishReason}): ${text.slice(0, 300)}`);
  }

  // Defensive defaults
  parsed.matches = (parsed.matches ?? []).filter((m) => {
    // Filter out hallucinated clip_ids (must exist in active list) + low confidence
    return clips.some((c) => c.id === m.clip_id) && (m.confidence ?? 0) >= 0.4;
  });
  parsed.reasoning_summary = parsed.reasoning_summary ?? "";
  parsed.skipped_low_resonance_count = parsed.skipped_low_resonance_count ?? 0;
  parsed.total_clips_evaluated = parsed.total_clips_evaluated ?? clips.length;

  return parsed;
}
