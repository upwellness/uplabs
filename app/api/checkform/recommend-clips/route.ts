import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { recommendClipsWithGemini } from "@/lib/checkform/clip-matcher";
import type { CheckformProfile, AIAnalysis } from "@/lib/checkform/ai-analyze";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * STP Clip recommendation API.
 *
 * Body: { profile: CheckformProfile, analysis?: AIAnalysis }
 * - profile: required · the lead's CheckForm profile
 * - analysis: optional · prior AI analysis result (improves reasoning)
 *
 * Returns: { recommendations, generated_at }
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const profile: CheckformProfile | undefined = body.profile;
    const analysis: AIAnalysis | undefined = body.analysis;

    if (!profile || typeof profile !== "object") {
      return NextResponse.json({ error: "profile required" }, { status: 400 });
    }

    const recommendations = await recommendClipsWithGemini({ profile, analysis: analysis ?? null });
    const generatedAt = new Date().toISOString();

    return NextResponse.json({ recommendations, generated_at: generatedAt });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
