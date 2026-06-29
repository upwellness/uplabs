import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { assignedCustomerIds } from "@/lib/customers/access";

/**
 * Customer list with cross-app stats (BCA count · CGM linked · Pulse connected · leads).
 * Admin sees all · coach sees own.
 * Cached 60s per coachId via "dashboard" tag — invalidated by customer/measurement/lead mutations.
 *
 * IMPORTANT: uses createAdminClient inside unstable_cache because cookies() (used by
 * the session-aware createClient) is not accessible inside cached functions.
 * Authorization is enforced OUTSIDE the cache in GET (session check + coach_id arg).
 */

const fetchCustomersList = unstable_cache(
  async (coachId: string | null) => {
    const admin = createAdminClient();
    const isAdmin = coachId === null;

    let custQuery = admin.from("customers")
      .select("id, name, gender, birth_year, birth_date, height, coach_id, cgm_profile_names, created_at")
      .order("name");
    if (!isAdmin) {
      // owner's own customers + any assigned to them (co-coach)
      const assigned = await assignedCustomerIds(coachId!);
      custQuery = assigned.length
        ? custQuery.or(`coach_id.eq.${coachId},id.in.(${assigned.join(",")})`)
        : custQuery.eq("coach_id", coachId!);
    }
    const { data: customers, error } = await custQuery;
    if (error) throw error;

    const customerIds = (customers ?? []).map((c) => c.id);
    if (customerIds.length === 0) return [];

    // Cross-app stats in parallel
    const [
      { data: bcaCounts },
      { data: pulseConnections },
      { data: leadCounts },
    ] = await Promise.all([
      admin.from("measurements").select("customer_id").in("customer_id", customerIds),
      admin.from("pulse_connections").select("customer_id, provider, status, last_sync_at").in("customer_id", customerIds),
      admin.from("healthcheck_leads").select("customer_id").in("customer_id", customerIds),
    ]);

    const bcaCount = new Map<string, number>();
    for (const r of bcaCounts ?? []) bcaCount.set(r.customer_id, (bcaCount.get(r.customer_id) ?? 0) + 1);

    const pulseMap = new Map<string, { provider: string; status: string; last_sync_at: string | null }>();
    for (const c of pulseConnections ?? []) pulseMap.set(c.customer_id, c);

    const leadCount = new Map<string, number>();
    for (const l of leadCounts ?? []) leadCount.set(l.customer_id, (leadCount.get(l.customer_id) ?? 0) + 1);

    return (customers ?? []).map((c) => ({
      ...c,
      stats: {
        bca:    bcaCount.get(c.id) ?? 0,
        cgm:    (c.cgm_profile_names ?? []).length,
        pulse:  pulseMap.get(c.id) ?? null,
        leads:  leadCount.get(c.id) ?? 0,
      },
    }));
  },
  ["customers-list"],
  { revalidate: 60, tags: ["dashboard"] },
);

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const isAdmin = session.profile.role === "admin";
    const result = await fetchCustomersList(isAdmin ? null : session.user.id);

    return NextResponse.json({ customers: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
