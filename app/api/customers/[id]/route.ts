import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { canManageCustomer } from "@/lib/customers/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateProfileEdit } from "@/lib/v2/identity";

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

    // Identity fields go through the shared validator. A พ.ศ. year saved here would
    // silently skew age, every reference range, and PhenoAge — with nothing on screen
    // looking wrong. The browser already checks; this is the check that counts.
    const touchesIdentity =
      body.name !== undefined || body.gender !== undefined ||
      body.birth_date !== undefined || body.height !== undefined;

    if (touchesIdentity) {
      const { data: current } = await createAdminClient()
        .from("customers").select("name, gender, birth_date, height").eq("id", params.id).maybeSingle();
      if (!current) return NextResponse.json({ error: "ไม่พบลูกค้ารายนี้" }, { status: 404 });

      // merge over the stored row so a partial update is validated as a whole profile
      const merged = {
        name:       body.name       !== undefined ? body.name       : (current as any).name,
        gender:     body.gender     !== undefined ? body.gender     : (current as any).gender,
        birth_date: body.birth_date !== undefined ? body.birth_date : (current as any).birth_date,
        height:     body.height     !== undefined ? body.height     : (current as any).height,
      };
      const check = validateProfileEdit(merged);
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

      if (body.name       !== undefined) update.name = check.value!.name;
      if (body.gender     !== undefined) update.gender = check.value!.gender;
      if (body.birth_date !== undefined) update.birth_date = check.value!.birth_date;
      if (body.height     !== undefined) update.height = check.value!.height;
    }
    if (body.birth_year !== undefined) update.birth_year = body.birth_year ? +body.birth_year : null;

    // Retiring a profile hides it from every list, so it needs the same permission
    // check as any other write — not RLS alone, which would silently no-op instead of
    // telling the caller they are not allowed.
    if (body.disabled !== undefined) {
      const admin = createAdminClient();
      const { data: owner } = await admin
        .from("customers").select("coach_id").eq("id", params.id).maybeSingle();
      if (!owner) return NextResponse.json({ error: "ไม่พบลูกค้ารายนี้" }, { status: 404 });

      const isAdmin = session.profile.role === "admin";
      const uid = session.user.id;
      if (!isAdmin && (owner as any).coach_id !== uid && !(await canManageCustomer(uid, params.id))) {
        return NextResponse.json(
          { error: "ลูกค้ารายนี้ไม่ได้อยู่ในความดูแลของคุณ จึงปิด/เปิดโปรไฟล์ไม่ได้" }, { status: 403 });
      }

      if (body.disabled) {
        update.disabled_at = new Date().toISOString();
        update.disabled_by = uid;
        update.disabled_reason = typeof body.disabled_reason === "string"
          ? body.disabled_reason.trim().slice(0, 200) || null : null;
      } else {
        // re-enabling clears the whole set, so a later disable does not inherit a
        // stale reason from months ago
        update.disabled_at = null;
        update.disabled_by = null;
        update.disabled_reason = null;
      }
    }

    const supa = createClient();
    const { data, error } = await supa.from("customers").update(update).eq("id", params.id).select().single();
    if (error) throw error;
    revalidateTag("dashboard");   // the customer list is cached 60s — without this the change looks lost
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
