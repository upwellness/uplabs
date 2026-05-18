import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    const supa = createClient();
    const { data, error } = await supa.from("customers").select("*").eq("id", params.id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ customer: data });
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
    if (body.name       !== undefined) update.name = body.name?.trim();
    if (body.gender     !== undefined) update.gender = body.gender;
    if (body.birth_year !== undefined) update.birth_year = body.birth_year ? +body.birth_year : null;
    if (body.birth_date !== undefined) update.birth_date = body.birth_date || null;
    if (body.height     !== undefined) update.height = body.height ? +body.height : null;

    const supa = createClient();
    const { data, error } = await supa.from("customers").update(update).eq("id", params.id).select().single();
    if (error) throw error;
    revalidateTag("dashboard");
    return NextResponse.json({ customer: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const isAdmin = session.profile.role === "admin";

    const ownerQuery = supa.from("customers").select("coach_id").eq("id", params.id).single();
    const { data: owner, error: ownerErr } = await ownerQuery;
    if (ownerErr) return NextResponse.json({ error: ownerErr.message }, { status: 404 });
    if (!isAdmin && owner.coach_id !== session.user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { error } = await supa.from("customers").delete().eq("id", params.id);
    if (error) throw error;
    revalidateTag("dashboard");
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
