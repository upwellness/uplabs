import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreHealthCheck, type HealthAnswers } from "@/lib/healthcheck/score";

/** PUBLIC — Health Check submission */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      coach_id, name, phone, email, line_id, consent_followup, answers,
      quiz_type,                  // 'healthcheck' | 'metaflex'
      pre_score, pre_level, pre_flags, // for metaflex which scores itself
    } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    if (!answers || typeof answers !== "object") {
      return NextResponse.json({ error: "answers required" }, { status: 400 });
    }

    const a = answers as HealthAnswers;
    let bmi: number | null = null;
    let risk_score = pre_score ?? 0;
    let risk_level: string = pre_level ?? "low";
    let flags: string[] = pre_flags ?? [];

    if (quiz_type === "healthcheck" || !quiz_type) {
      const computed = scoreHealthCheck(a);
      bmi        = computed.bmi;
      risk_score = computed.risk_score;
      risk_level = computed.risk_level;
      flags      = computed.flags;
    }

    const admin = createAdminClient();

    // Validate coach_id exists (if provided)
    let validCoachId: string | null = null;
    if (coach_id) {
      const { data: coach } = await admin
        .from("profiles").select("id").eq("id", coach_id).maybeSingle();
      validCoachId = coach?.id ?? null;
    }

    const { data: lead, error } = await admin
      .from("healthcheck_leads")
      .insert({
        coach_id:         validCoachId,
        quiz_type:        quiz_type ?? "healthcheck",
        name:             name.trim(),
        phone:            phone?.trim() || null,
        email:            email?.trim() || null,
        line_id:          line_id?.trim() || null,
        consent_followup: consent_followup !== false,
        age:              a.age ?? null,
        gender:           a.gender ?? null,
        height_cm:        a.height_cm ?? null,
        weight_kg:        a.weight_kg ?? null,
        waist_cm:         a.waist_cm ?? null,
        bmi,
        risk_score,
        risk_level,
        flags,
        answers,
      })
      .select("id, risk_score, risk_level, bmi, flags")
      .single();
    if (error) throw error;

    revalidateTag("dashboard");
    return NextResponse.json({ ok: true, lead });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
