import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Public — submit intake from customer */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const admin = createAdminClient();
    const { data: intake, error } = await admin
      .from("pulse_intakes").select("*").eq("token", params.token).single();
    if (error || !intake) return NextResponse.json({ error: "invalid token" }, { status: 404 });
    if (intake.submitted_at) return NextResponse.json({ error: "already submitted" }, { status: 410 });
    if (new Date(intake.expires_at).getTime() < Date.now())
      return NextResponse.json({ error: "expired" }, { status: 410 });

    const body = await req.json();
    const { medications, conditions, pregnant, breastfeeding, goal, budget_range, notes } = body;

    const { error: uErr } = await admin
      .from("pulse_intakes")
      .update({
        medications:  Array.isArray(medications) ? medications : [],
        conditions:   Array.isArray(conditions)  ? conditions  : [],
        pregnant:     !!pregnant,
        breastfeeding:!!breastfeeding,
        goal:         goal ?? null,
        budget_range: budget_range ?? null,
        notes:        notes ?? null,
        submitted_at: new Date().toISOString(),
      })
      .eq("token", params.token);
    if (uErr) throw uErr;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

/** Public — fetch intake (form prefill check) */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const admin = createAdminClient();
    const { data: intake } = await admin
      .from("pulse_intakes")
      .select("token, submitted_at, expires_at, customer_id, customers!inner(name, gender)")
      .eq("token", params.token).maybeSingle();
    if (!intake) return NextResponse.json({ error: "invalid" }, { status: 404 });
    return NextResponse.json({
      token: intake.token,
      submitted: !!intake.submitted_at,
      expires_at: intake.expires_at,
      customer_name: (intake.customers as any)?.name ?? "คุณ",
      customer_gender: (intake.customers as any)?.gender ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
