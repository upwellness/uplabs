import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { runAssessment } from "@/lib/pulse/assess";

/** Coach triggers AI assessment — pulls latest intake + readings → runs pipeline → saves assessment */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const { data: customer } = await supa
      .from("customers").select("id, name, gender, birth_year, coach_id")
      .eq("id", params.id).single();
    if (!customer) return NextResponse.json({ error: "customer not found" }, { status: 404 });

    const isAdmin = session.profile.role === "admin";
    if (!isAdmin && customer.coach_id !== session.user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();

    // Get latest submitted intake
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

    // Get readings (last 7 days)
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: readings } = await admin
      .from("pulse_readings")
      .select("metric_type, value, recorded_at")
      .eq("customer_id", params.id)
      .gte("recorded_at", cutoff)
      .order("recorded_at", { ascending: true });

    if (!readings || readings.length === 0) {
      return NextResponse.json({ error: "ยังไม่มี biomarker — Sync Google Fit ก่อน" }, { status: 400 });
    }

    // Run pipeline
    const result = await runAssessment({
      customer: {
        name:       customer.name,
        gender:     customer.gender,
        birth_year: customer.birth_year,
      },
      intake: {
        medications:    intake.medications ?? [],
        conditions:     intake.conditions ?? [],
        pregnant:       !!intake.pregnant,
        breastfeeding:  !!intake.breastfeeding,
        goal:           intake.goal,
        budget_range:   intake.budget_range,
      },
      readings: readings.map((r) => ({ ...r, value: Number(r.value) })),
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
        raw_input:     { intake: intake.id, readings_count: readings.length, aggs: result.aggregates },
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
