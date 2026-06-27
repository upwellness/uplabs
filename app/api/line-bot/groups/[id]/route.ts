import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";

/**
 * น้องจาน · update / delete a single LINE bot group mapping.
 *   PATCH  → push settings + program day + (optional) re-map customer.
 *   DELETE → unmap the group.
 *
 * Authorization (mirrors coach_notes / allergies pattern): the coach may only
 * touch a group whose CURRENT customer they own; if re-mapping, the NEW customer
 * must also be theirs. Admin: any.
 */

/** Load the group + the coach_id of its current customer. */
async function loadGroupOwner(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data: group } = await admin
    .from("line_bot_groups")
    .select("id, customer_id")
    .eq("id", id)
    .maybeSingle();
  if (!group) return { group: null, ownerCoachId: null as string | null };
  let ownerCoachId: string | null = null;
  if (group.customer_id) {
    const { data: cust } = await admin
      .from("customers")
      .select("coach_id")
      .eq("id", group.customer_id)
      .maybeSingle();
    ownerCoachId = cust?.coach_id ?? null;
  }
  return { group, ownerCoachId };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const admin = createAdminClient();
    const isAdmin = session.profile.role === "admin";

    const { group, ownerCoachId } = await loadGroupOwner(admin, params.id);
    if (!group) return NextResponse.json({ error: "group not found" }, { status: 404 });
    if (!isAdmin && ownerCoachId !== session.user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const update: Record<string, unknown> = {};

    if (body.customer_id !== undefined) {
      const newCustId = body.customer_id;
      if (!newCustId) return NextResponse.json({ error: "customer_id cannot be empty" }, { status: 400 });
      const { data: newCust } = await admin
        .from("customers")
        .select("id, coach_id")
        .eq("id", newCustId)
        .maybeSingle();
      if (!newCust) return NextResponse.json({ error: "customer not found" }, { status: 404 });
      if (!isAdmin && newCust.coach_id !== session.user.id) {
        return NextResponse.json({ error: "forbidden — ผูกได้เฉพาะลูกค้าของตัวเอง" }, { status: 403 });
      }
      update.customer_id = newCustId;
    }
    if (body.program_start_date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(body.program_start_date))) {
      update.program_start_date = body.program_start_date;
    }
    if (body.push_enabled !== undefined) update.push_enabled = !!body.push_enabled;
    if (body.push_time !== undefined && /^\d{2}:\d{2}(:\d{2})?$/.test(String(body.push_time))) {
      const t = String(body.push_time);
      update.push_time = t.length === 5 ? `${t}:00` : t;
    }
    if (body.seed !== undefined) {
      const n = Number(body.seed);
      if (Number.isFinite(n) && n >= 0) update.seed = Math.round(n);
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "no valid fields to update" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("line_bot_groups")
      .update(update)
      .eq("id", params.id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ group: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const admin = createAdminClient();
    const isAdmin = session.profile.role === "admin";

    const { group, ownerCoachId } = await loadGroupOwner(admin, params.id);
    if (!group) return NextResponse.json({ error: "group not found" }, { status: 404 });
    if (!isAdmin && ownerCoachId !== session.user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { error } = await admin.from("line_bot_groups").delete().eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
