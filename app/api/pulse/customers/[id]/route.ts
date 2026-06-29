import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer } from "@/lib/customers/access";

/** Coach view: connection + readings + intakes + assessments for one customer. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const { data: customer, error: cErr } = await supa
      .from("customers").select("id, name, coach_id, gender, birth_year").eq("id", params.id).single();
    if (cErr || !customer) return NextResponse.json({ error: "customer not found" }, { status: 404 });

    const isAdmin = session.profile.role === "admin";
    if (!isAdmin && customer.coach_id !== session.user.id && !(await isAssignedToCustomer(session.user.id, params.id))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const [
      { data: connection },
      { data: readings },
      { data: latestInvite },
      { data: latestIntake },
      { data: assessments },
    ] = await Promise.all([
      supa.from("pulse_connections")
        .select("id, provider, status, connected_at, last_sync_at, expires_at")
        .eq("customer_id", params.id).eq("provider", "google_fit").maybeSingle(),
      supa.from("pulse_readings")
        .select("recorded_at, metric_type, value, unit")
        .eq("customer_id", params.id)
        .order("recorded_at", { ascending: false }).limit(500),
      supa.from("pulse_invites")
        .select("token, expires_at, used_at")
        .eq("customer_id", params.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supa.from("pulse_intakes")
        .select("id, token, submitted_at, expires_at, goal, budget_range")
        .eq("customer_id", params.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supa.from("pulse_assessments")
        .select("id, status, blocked, block_reasons, share_token, sent_at, created_at, ai_output")
        .eq("customer_id", params.id)
        .order("created_at", { ascending: false }).limit(5),
    ]);

    return NextResponse.json({
      customer,
      connection:     connection ?? null,
      readings:       readings ?? [],
      latest_invite:  latestInvite ?? null,
      latest_intake:  latestIntake ?? null,
      assessments:    assessments ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
