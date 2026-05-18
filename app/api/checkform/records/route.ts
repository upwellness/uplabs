import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Check FORM records — RLS handles per-coach filtering automatically.
 * Admin sees all (via my_role() in RLS policy).
 */

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const { data, error } = await supa
      .from("checkform_records")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ records: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json();
    const {
      prospect_name,
      meeting_context,
      scores,
      notes,
      verdict_level,
      verdict_label,
      total_score,
      profile,
      disc_primary,
      disc_secondary,
    } = body ?? {};

    if (!prospect_name || typeof prospect_name !== "string") {
      return NextResponse.json({ error: "prospect_name required" }, { status: 400 });
    }

    const supa = createClient();
    const { data, error } = await supa
      .from("checkform_records")
      .insert({
        coach_id: session.user.id,
        prospect_name: prospect_name.trim(),
        meeting_context: meeting_context ?? null,
        scores: scores ?? {},
        notes: notes ?? {},
        verdict_level: verdict_level ?? null,
        verdict_label: verdict_label ?? null,
        total_score: typeof total_score === "number" ? total_score : 0,
        profile: profile ?? {},
        disc_primary: disc_primary ?? null,
        disc_secondary: disc_secondary ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
