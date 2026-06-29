import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer } from "@/lib/customers/access";

/** Coach view single assessment (with edit) */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const { data, error } = await supa
      .from("pulse_assessments")
      .select("*, customers!inner(id, name, gender, birth_year, coach_id)")
      .eq("id", params.id).single();
    if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });

    const isAdmin = session.profile.role === "admin";
    if (!isAdmin && (data.customers as any).coach_id !== session.user.id && !(await isAssignedToCustomer(session.user.id, (data.customers as any).id))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ assessment: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

/** Coach: update status (mark sent), edit ai_output */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json();
    const supa = createClient();

    const update: Record<string, unknown> = {};
    if (body.ai_output) update.ai_output = body.ai_output;
    if (body.status)    update.status    = body.status;
    if (body.status === "sent") update.sent_at = new Date().toISOString();
    update.reviewed_by = session.user.id;
    update.reviewed_at = new Date().toISOString();

    const { data, error } = await supa
      .from("pulse_assessments").update(update).eq("id", params.id).select().single();
    if (error) throw error;
    return NextResponse.json({ assessment: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
