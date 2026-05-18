import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const { data, error } = await supa
      .from("checkform_records")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ record: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json();
    const update: Record<string, unknown> = {};
    if (body.prospect_name   !== undefined) update.prospect_name = String(body.prospect_name).trim();
    if (body.meeting_context !== undefined) update.meeting_context = body.meeting_context ?? null;
    if (body.scores          !== undefined) update.scores = body.scores;
    if (body.notes           !== undefined) update.notes = body.notes;
    if (body.verdict_level   !== undefined) update.verdict_level = body.verdict_level;
    if (body.verdict_label   !== undefined) update.verdict_label = body.verdict_label;
    if (body.total_score     !== undefined) update.total_score = body.total_score;

    const supa = createClient();
    const { data, error } = await supa
      .from("checkform_records")
      .update(update)
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ record: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const { error } = await supa.from("checkform_records").delete().eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
