import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { analyzeProspectWithGemini, type CheckformProfile } from "@/lib/checkform/ai-analyze";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * AI analyze + optional persist of the result on a checkform_record.
 *
 * Body: { profile: CheckformProfile, recordId?: string, force?: boolean }
 * - If recordId provided + record already has ai_analysis + !force → return cached
 * - Otherwise → call Gemini, save to record if recordId given
 */

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const profile: CheckformProfile | undefined = body.profile;
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
        .select("ai_analysis, ai_analyzed_at")
        .eq("id", recordId)
        .maybeSingle();
      if (existing?.ai_analysis) {
        return NextResponse.json({
          analysis: existing.ai_analysis,
          cached: true,
          analyzed_at: existing.ai_analyzed_at,
        });
      }
    }

    // Run Gemini
    let analysis;
    try {
      analysis = await analyzeProspectWithGemini(profile, userKey);
    } catch (e: any) {
      const msg = e?.message ?? "analyze failed";
      const status = msg === "กรุณาใส่ API Key" ? 400 : 500;
      return NextResponse.json({ error: msg }, { status });
    }
    const analyzedAt = new Date().toISOString();

    // Persist if recordId
    if (recordId) {
      const { error } = await supa
        .from("checkform_records")
        .update({ ai_analysis: analysis, ai_analyzed_at: analyzedAt })
        .eq("id", recordId);
      if (error) {
        // Return analysis anyway · just log the save error
        return NextResponse.json({
          analysis, cached: false, analyzed_at: analyzedAt,
          save_error: error.message,
        });
      }
    }

    return NextResponse.json({ analysis, cached: false, analyzed_at: analyzedAt });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
