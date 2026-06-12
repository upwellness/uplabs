import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Convert a prospect_list row → checkform_records row.
 * Returns the new record_id · caller redirects to /checkform?load=<id>
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();

    // Fetch prospect (RLS enforces coach ownership)
    const { data: prospect, error: pErr } = await supa
      .from("prospect_list")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!prospect) return NextResponse.json({ error: "prospect not found" }, { status: 404 });

    // If already converted, return existing record id
    if (prospect.converted_record_id) {
      return NextResponse.json({ record_id: prospect.converted_record_id, reused: true });
    }

    // Create a checkform_records row with prefilled name + context
    const { data: record, error: rErr } = await supa
      .from("checkform_records")
      .insert({
        coach_id: session.user.id,
        prospect_name: prospect.name,
        meeting_context: prospect.context ?? null,
        scores: {},
        notes: {},
        profile: {},
        total_score: 0,
      })
      .select()
      .single();
    if (rErr) throw rErr;

    // Link back + mark prospect status as analyzed
    const { error: uErr } = await supa
      .from("prospect_list")
      .update({
        converted_record_id: record.id,
        status: "analyzed",
      })
      .eq("id", params.id);
    if (uErr) {
      // Non-fatal — record was created
      return NextResponse.json({
        record_id: record.id,
        link_error: uErr.message,
      });
    }

    return NextResponse.json({ record_id: record.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
