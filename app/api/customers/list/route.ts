import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";

/**
 * Customer list with cross-app stats (BCA count · CGM linked · Pulse connected · leads).
 * Admin sees all · coach sees own.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const isAdmin = session.profile.role === "admin";
    const supa = createClient();
    const admin = createAdminClient();

    let custQuery = supa.from("customers")
      .select("id, name, gender, birth_year, birth_date, height, coach_id, cgm_profile_names, created_at")
      .order("name");
    if (!isAdmin) custQuery = custQuery.eq("coach_id", session.user.id);
    const { data: customers, error } = await custQuery;
    if (error) throw error;

    const customerIds = (customers ?? []).map((c) => c.id);
    if (customerIds.length === 0) return NextResponse.json({ customers: [] });

    // Cross-app stats in parallel
    const [
      { data: bcaCounts },
      { data: pulseConnections },
      { data: leadCounts },
    ] = await Promise.all([
      // BCA measurement count per customer
      admin.from("measurements").select("customer_id").in("customer_id", customerIds),
      // Pulse connections
      admin.from("pulse_connections").select("customer_id, provider, status, last_sync_at").in("customer_id", customerIds),
      // Health Check leads converted to this customer
      admin.from("healthcheck_leads").select("customer_id").in("customer_id", customerIds),
    ]);

    const bcaCount = new Map<string, number>();
    for (const r of bcaCounts ?? []) bcaCount.set(r.customer_id, (bcaCount.get(r.customer_id) ?? 0) + 1);

    const pulseMap = new Map<string, { provider: string; status: string; last_sync_at: string | null }>();
    for (const c of pulseConnections ?? []) pulseMap.set(c.customer_id, c);

    const leadCount = new Map<string, number>();
    for (const l of leadCounts ?? []) leadCount.set(l.customer_id, (leadCount.get(l.customer_id) ?? 0) + 1);

    const result = (customers ?? []).map((c) => ({
      ...c,
      stats: {
        bca:    bcaCount.get(c.id) ?? 0,
        cgm:    (c.cgm_profile_names ?? []).length,
        pulse:  pulseMap.get(c.id) ?? null,
        leads:  leadCount.get(c.id) ?? 0,
      },
    }));

    return NextResponse.json({ customers: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
