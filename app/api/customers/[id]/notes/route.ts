import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";

async function verifyAccess(customerId: string, session: any, admin: any) {
  const { data: customer } = await admin
    .from("customers").select("id, coach_id").eq("id", customerId).maybeSingle();
  if (!customer) return { ok: false, status: 404, error: "customer not found" };
  const isAdmin = session.profile.role === "admin";
  if (!isAdmin && customer.coach_id !== session.user.id) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    const admin = createAdminClient();
    const check = await verifyAccess(params.id, session, admin);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const { data, error } = await admin
      .from("coach_notes")
      .select("id, body, pinned, created_at, updated_at")
      .eq("customer_id", params.id)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ notes: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    const admin = createAdminClient();
    const check = await verifyAccess(params.id, session, admin);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const body = await req.json();
    if (!body.body || typeof body.body !== "string" || !body.body.trim()) {
      return NextResponse.json({ error: "body required" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("coach_notes")
      .insert({
        customer_id: params.id,
        body:        body.body.trim(),
        pinned:      Boolean(body.pinned),
        created_by:  session.user.id,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ note: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    const admin = createAdminClient();
    const check = await verifyAccess(params.id, session, admin);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

    const url = new URL(req.url);
    const noteId = url.searchParams.get("noteId");
    if (!noteId) return NextResponse.json({ error: "noteId required" }, { status: 400 });

    const { error } = await admin
      .from("coach_notes").delete()
      .eq("id", noteId).eq("customer_id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
