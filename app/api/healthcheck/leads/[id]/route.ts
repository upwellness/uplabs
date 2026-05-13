import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

/** Coach update lead status/notes · admin sees all */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json();
    const update: Record<string, unknown> = {};
    if (body.status !== undefined) {
      update.status = body.status;
      if (body.status === "contacted") update.contacted_at = new Date().toISOString();
    }
    if (body.notes !== undefined) update.notes = body.notes;
    if (body.customer_id !== undefined) update.customer_id = body.customer_id;

    const supa = createClient();
    const { data, error } = await supa
      .from("healthcheck_leads").update(update).eq("id", params.id).select().single();
    if (error) throw error;
    return NextResponse.json({ lead: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

/** Convert lead → customers row */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const { data: lead, error: lErr } = await supa
      .from("healthcheck_leads").select("*").eq("id", params.id).single();
    if (lErr || !lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

    if (lead.customer_id) {
      return NextResponse.json({ error: "already converted" }, { status: 409 });
    }

    const birth_year = lead.age ? new Date().getFullYear() - lead.age : null;
    const { data: customer, error: cErr } = await supa
      .from("customers")
      .insert({
        name:       lead.name,
        gender:     lead.gender ?? "female",
        birth_year,
        height:     lead.height_cm ?? null,
        coach_id:   lead.coach_id ?? session.user.id,
      })
      .select()
      .single();
    if (cErr) throw cErr;

    await supa.from("healthcheck_leads")
      .update({ customer_id: customer.id, status: "converted" })
      .eq("id", params.id);

    return NextResponse.json({ customer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
