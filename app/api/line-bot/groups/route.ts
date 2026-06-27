import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";

/**
 * น้องจาน · LINE bot group ↔ customer mappings.
 *
 *   GET  → list groups (admin = all · coach = own customers' groups) +
 *          the coach's customers (for the picker) + recent logs.
 *   POST → create / upsert a group mapping (line_group_id is unique).
 *
 * Mirrors the customer-child-table write pattern (allergies/tests, coach_notes):
 *   getSession → createAdminClient → verify customers.coach_id → admin write.
 * Coach may only map a group to one of their OWN customers (admin: any).
 */

/** Coach can manage a group only if it's mapped to a customer they own (admin: always). */
function customerFilterFor(session: { profile: { role: string }; user: { id: string } }) {
  return session.profile.role === "admin" ? null : session.user.id;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const admin = createAdminClient();
    const coachId = customerFilterFor(session);

    // Customers the coach can map (admin = all).
    let custQuery = admin
      .from("customers")
      .select("id, name, gender, height, coach_id")
      .order("name");
    if (coachId) custQuery = custQuery.eq("coach_id", coachId);
    const { data: customers, error: custErr } = await custQuery;
    if (custErr) throw custErr;

    const ownedIds = new Set((customers ?? []).map((c) => c.id));

    // Groups. Admin sees all; coach sees only groups mapped to their own customers.
    const { data: groupsRaw, error: grpErr } = await admin
      .from("line_bot_groups")
      .select("id, line_group_id, customer_id, program_start_date, push_enabled, push_time, seed, created_at")
      .order("created_at", { ascending: false });
    if (grpErr) throw grpErr;

    const groups = (groupsRaw ?? []).filter(
      (g) => coachId === null || (g.customer_id != null && ownedIds.has(g.customer_id)),
    );

    // Recent logs for the visible groups (read-only audit view). Best-effort.
    const groupRowIds = groups.map((g) => g.id);
    let logs: any[] = [];
    if (groupRowIds.length) {
      const { data: logRows } = await admin
        .from("line_bot_logs")
        .select("id, group_id, type, status, payload, sent_at")
        .in("group_id", groupRowIds)
        .order("sent_at", { ascending: false })
        .limit(40);
      logs = logRows ?? [];
    }

    return NextResponse.json({ groups, customers: customers ?? [], logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json();
    const lineGroupId = typeof body.line_group_id === "string" ? body.line_group_id.trim() : "";
    const customerId = typeof body.customer_id === "string" ? body.customer_id : "";
    if (!lineGroupId) return NextResponse.json({ error: "line_group_id is required" }, { status: 400 });
    if (!customerId)  return NextResponse.json({ error: "customer_id is required" }, { status: 400 });

    const admin = createAdminClient();

    // Only allow mapping to a customer the coach owns (admin: any).
    const { data: customer } = await admin
      .from("customers")
      .select("id, coach_id")
      .eq("id", customerId)
      .maybeSingle();
    if (!customer) return NextResponse.json({ error: "customer not found" }, { status: 404 });
    const isAdmin = session.profile.role === "admin";
    if (!isAdmin && customer.coach_id !== session.user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // 1 group : 1 customer — line_group_id is unique. If it already exists, guard re-map.
    const { data: existing } = await admin
      .from("line_bot_groups")
      .select("id, customer_id")
      .eq("line_group_id", lineGroupId)
      .maybeSingle();

    const row: Record<string, unknown> = {
      line_group_id: lineGroupId,
      customer_id: customerId,
      program_start_date: normDate(body.program_start_date),
      push_enabled: body.push_enabled === undefined ? true : !!body.push_enabled,
      push_time: normTime(body.push_time),
      seed: normSeed(body.seed),
    };

    if (existing) {
      // Re-mapping an existing group: a coach may only touch it if they already own the
      // currently-mapped customer (admin: any). Then update in place ("ผูกซ้ำ = ทับ").
      if (!isAdmin && existing.customer_id) {
        const { data: prevCust } = await admin
          .from("customers")
          .select("coach_id")
          .eq("id", existing.customer_id)
          .maybeSingle();
        if (prevCust && prevCust.coach_id !== session.user.id) {
          return NextResponse.json({ error: "กลุ่มนี้ถูกผูกกับลูกค้าของโค้ชคนอื่นแล้ว" }, { status: 403 });
        }
      }
      const { data, error } = await admin
        .from("line_bot_groups")
        .update(row)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ group: data, updated: true });
    }

    const { data, error } = await admin
      .from("line_bot_groups")
      .insert({ ...row, created_by: session.user.id })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ group: data, updated: false });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

/* ── normalizers ───────────────────────────────────────── */

function normDate(v: unknown): string {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // default = today (Asia/Bangkok)
  const shifted = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}
function normTime(v: unknown): string {
  if (typeof v === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(v)) return v.length === 5 ? `${v}:00` : v;
  return "18:00:00";
}
function normSeed(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 1;
}
