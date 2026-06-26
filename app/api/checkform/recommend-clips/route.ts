import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { recommendClipsWithGemini } from "@/lib/checkform/clip-matcher";
import type { CheckformProfile, AIAnalysis } from "@/lib/checkform/ai-analyze";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * STP Clip recommendation API.
 *
 * Body: { profile, analysis?, recordId?, force? }
 * - profile: required · CheckForm profile
 * - analysis: optional · prior AI analysis result (improves reasoning)
 * - recordId: optional · enables cache check + persist
 * - force: optional · ignore cache and re-call Gemini
 *
 * Caching mirrors /api/checkform/analyze:
 * - If recordId given + record has clip_recommendations + !force → return cached
 * - Else → call Gemini, save to record if recordId given
 *
 * Returns: { recommendations, cached, generated_at }
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const profile: CheckformProfile | undefined = body.profile;
    const analysis: AIAnalysis | undefined = body.analysis;
    const recordId: string | undefined = body.recordId;
    const force: boolean = body.force === true;

    if (!profile || typeof profile !== "object") {
      return NextResponse.json({ error: "profile required" }, { status: 400 });
    }

    // BYO key เท่านั้น — ไม่มี fallback คีย์ระบบ
    const userKey: string = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!userKey) {
      return NextResponse.json({ error: "กรุณาใส่ API Key ก่อน" }, { status: 400 });
    }

    const supa = createClient();

    // Cache check
    if (recordId && !force) {
      const { data: existing } = await supa
        .from("checkform_records")
        .select("clip_recommendations, clip_generated_at")
        .eq("id", recordId)
        .maybeSingle();
      if (existing?.clip_recommendations) {
        return NextResponse.json({
          recommendations: existing.clip_recommendations,
          cached: true,
          generated_at: existing.clip_generated_at,
        });
      }
    }

    // Run Gemini
    let recommendations;
    try {
      recommendations = await recommendClipsWithGemini({ profile, analysis: analysis ?? null }, userKey);
    } catch (e: any) {
      const msg = e?.message ?? "recommend-clips failed";
      const status = msg === "กรุณาใส่ API Key" ? 400 : 500;
      return NextResponse.json({ error: msg }, { status });
    }
    const generatedAt = new Date().toISOString();

    // Persist if recordId
    if (recordId) {
      const { error } = await supa
        .from("checkform_records")
        .update({ clip_recommendations: recommendations, clip_generated_at: generatedAt })
        .eq("id", recordId);
      if (error) {
        // Return recommendations anyway · just log the save error
        return NextResponse.json({
          recommendations, cached: false, generated_at: generatedAt,
          save_error: error.message,
        });
      }
    }

    return NextResponse.json({ recommendations, cached: false, generated_at: generatedAt });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
