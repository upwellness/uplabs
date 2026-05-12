import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { runAssessment } from "@/lib/pulse/assess";

/** Coach triggers AI assessment — pulls ALL data sources */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const { data: customer } = await supa
      .from("customers").select("id, name, gender, birth_year, height, coach_id, cgm_profile_names")
      .eq("id", params.id).single();
    if (!customer) return NextResponse.json({ error: "customer not found" }, { status: 404 });

    const isAdmin = session.profile.role === "admin";
    if (!isAdmin && customer.coach_id !== session.user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();

    // Latest submitted intake
    const { data: intake } = await admin
      .from("pulse_intakes")
      .select("*")
      .eq("customer_id", params.id)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(1).maybeSingle();
    if (!intake) {
      return NextResponse.json({ error: "no submitted intake — ส่ง intake link ให้ลูกค้าก่อน" }, { status: 400 });
    }

    // ── Multi-source data fetch (parallel) ──
    // No staleness limits — use whatever data exists
    const cgmProfiles: string[] = (customer.cgm_profile_names as string[] | null) ?? [];

    const [
      { data: bcaHistory },
      { data: cgmReadings },
      { data: pulseReadings },
    ] = await Promise.all([
      admin.from("measurements")
        .select("recorded_at, weight, fat_pct, visceral, muscle_pct, body_age, bmr")
        .eq("customer_id", params.id)
        .order("recorded_at", { ascending: false }).limit(50),
      cgmProfiles.length > 0
        ? admin.from("cgm_readings")
            .select("reading_timestamp, glucose")
            .in("profile_name", cgmProfiles)
            .order("reading_timestamp", { ascending: false }).limit(10000)
        : Promise.resolve({ data: [] as any[], error: null }),
      admin.from("pulse_readings")
        .select("metric_type, value, recorded_at")
        .eq("customer_id", params.id)
        .order("recorded_at", { ascending: false }).limit(2000),
    ]);

    // Run pipeline
    const result = await runAssessment({
      customer: {
        name:       customer.name,
        gender:     customer.gender,
        birth_year: customer.birth_year,
        height:     customer.height,
      },
      bca_history:    (bcaHistory ?? []) as any,
      cgm_readings:   (cgmReadings ?? []).map((r) => ({ ...r, reading_timestamp: Number(r.reading_timestamp) })),
      pulse_readings: (pulseReadings ?? []).map((r) => ({ ...r, value: Number(r.value) })),
      pulse_intake: {
        submitted_at:  intake.submitted_at,
        medications:   intake.medications ?? [],
        conditions:    intake.conditions  ?? [],
        pregnant:      !!intake.pregnant,
        breastfeeding: !!intake.breastfeeding,
        goal:          intake.goal,
        budget_range:  intake.budget_range,
      },
      intake_for_exclusion: {
        medications:    intake.medications ?? [],
        conditions:     intake.conditions  ?? [],
        pregnant:       !!intake.pregnant,
        breastfeeding:  !!intake.breastfeeding,
      },
    });

    const share_token = randomBytes(20).toString("base64url");

    const { data: saved, error: insErr } = await admin
      .from("pulse_assessments")
      .insert({
        customer_id:   params.id,
        intake_id:     intake.id,
        coach_id:      session.user.id,
        status:        result.blocked ? "blocked" : "ready",
        blocked:       result.blocked,
        block_reasons: result.block_reasons,
        raw_input:     {
          intake_id: intake.id,
          counts: {
            bca: (bcaHistory ?? []).length,
            cgm: (cgmReadings ?? []).length,
            pulse: (pulseReadings ?? []).length,
          },
          master: result.master,
        },
        rule_output:   { matched: result.matched_rules ?? [] },
        ai_output:     result.ai_output ?? null,
        share_token,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    return NextResponse.json({ assessment: saved });
  } catch (err: any) {
    console.error("[pulse assess]", err);
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
