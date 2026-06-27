import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";

/**
 * น้องจาน · per-customer supplement schedule (vitamins per meal slot).
 *   GET → all rows for the customer (ordered by sort).
 *   PUT → REPLACE the whole set: delete existing rows, insert the supplied ones.
 *
 * The bot (lib/line/meal-plan.ts → getDayMeals) reads { meal_slot, items[], sort }
 * and matches meal_slot loosely against engine meal names, so meal_slot is free text
 * but the UI offers the canonical slots (เช้า / กลางวัน / เย็น / ของว่าง).
 *
 * Replace-set keeps it simple and respects the table's unique(customer_id, meal_slot).
 * Auth mirrors the customer-child-table pattern (verify customers.coach_id).
 */

async function authCustomer(customerId: string, session: { profile: { role: string }; user: { id: string } }) {
  const admin = createAdminClient();
  const { data: customer } = await admin
    .from("customers")
    .select("id, coach_id, name")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return { ok: false as const, status: 404, error: "customer not found" };
  const isAdmin = session.profile.role === "admin";
  if (!isAdmin && customer.coach_id !== session.user.id) {
    return { ok: false as const, status: 403, error: "forbidden" };
  }
  return { ok: true as const, admin, customer };
}

export async function GET(_req: Request, { params }: { params: { customerId: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const auth = await authCustomer(params.customerId, session);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { admin } = auth;

    const { data, error } = await admin
      .from("supplement_schedule")
      .select("id, meal_slot, items, sort")
      .eq("customer_id", params.customerId)
      .order("sort", { ascending: true });
    if (error) throw error;

    return NextResponse.json({
      rows: (data ?? []).map((r) => ({
        id: r.id,
        meal_slot: r.meal_slot,
        items: Array.isArray(r.items) ? (r.items as unknown[]).map(String) : [],
        sort: r.sort,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { customerId: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const auth = await authCustomer(params.customerId, session);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { admin } = auth;

    const body = await req.json();
    const rawRows: unknown[] = Array.isArray(body.rows) ? body.rows : [];

    // Normalize → drop blank slots / empty item lists. Collapse duplicate slots (keep first)
    // to respect unique(customer_id, meal_slot).
    const seen = new Set<string>();
    const rows: { customer_id: string; meal_slot: string; items: string[]; sort: number }[] = [];
    rawRows.forEach((r, i) => {
      const obj = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      const slot = typeof obj.meal_slot === "string" ? obj.meal_slot.trim() : "";
      if (!slot || seen.has(slot)) return;
      const items = Array.isArray(obj.items)
        ? obj.items.map((x) => String(x).trim()).filter(Boolean)
        : [];
      if (!items.length) return;
      seen.add(slot);
      const sort = Number.isFinite(Number(obj.sort)) ? Number(obj.sort) : i;
      rows.push({ customer_id: params.customerId, meal_slot: slot, items, sort });
    });

    // Replace-set: clear then insert.
    const { error: delErr } = await admin
      .from("supplement_schedule")
      .delete()
      .eq("customer_id", params.customerId);
    if (delErr) throw delErr;

    if (rows.length) {
      const { error: insErr } = await admin.from("supplement_schedule").insert(rows);
      if (insErr) throw insErr;
    }

    return NextResponse.json({ ok: true, count: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
