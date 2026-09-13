import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { canManageCustomer } from "@/lib/customers/access";
import { decryptToken, encryptToken } from "@/lib/pulse/crypto";
import { fetch7DaySummary, refreshAccessToken } from "@/lib/pulse/google-fit";
import { syncGoogleHealth } from "@/lib/pulse/google-health-sync";

/**
 * Manual "Sync Now" — pulls fresh 7-day biomarker data.
 * Refreshes the access token if it's expired.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const { data: customer, error: cErr } = await supa
      .from("customers").select("id, coach_id").eq("id", params.id).single();
    if (cErr || !customer) return NextResponse.json({ error: "customer not found" }, { status: 404 });

    const isAdmin = session.profile.role === "admin";
    if (!isAdmin && customer.coach_id !== session.user.id && !(await canManageCustomer(session.user.id, params.id))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    // Google Health first; a legacy Google Fit link still syncs until Google turns Fit off (end of 2026).
    const { data: gh } = await admin.from("pulse_connections").select("*").eq("customer_id", params.id).eq("provider", "google_health").eq("status", "active").maybeSingle();
    if (gh) {
      const r = await syncGoogleHealth(gh as any);
      return NextResponse.json({ ok: true, provider: "google_health", count: r.count, errors: r.errors });
    }
    const { data: conn, error: connErr } = await admin
      .from("pulse_connections")
      .select("*")
      .eq("customer_id", params.id)
      .eq("provider", "google_fit")
      .eq("status", "active")
      .single();
    if (connErr || !conn) return NextResponse.json({ error: "not connected" }, { status: 404 });

    // Determine if access token needs refresh
    let accessToken = decryptToken(conn.access_token_enc);
    const expiresAt = new Date(conn.expires_at).getTime();
    const expiringSoon = expiresAt - Date.now() < 5 * 60 * 1000; // <5min

    if (expiringSoon && conn.refresh_token_enc) {
      try {
        const refresh = decryptToken(conn.refresh_token_enc);
        const tokens = await refreshAccessToken(refresh);
        accessToken = tokens.access_token;
        await admin.from("pulse_connections").update({
          access_token_enc: encryptToken(tokens.access_token),
          expires_at:       new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        }).eq("id", conn.id);
      } catch (err: any) {
        return NextResponse.json({ error: "token refresh failed", detail: err.message }, { status: 500 });
      }
    }

    // Pull 7-day data
    const rows = await fetch7DaySummary(accessToken);

    // Replace last-7d window (clear then insert) so we don't accumulate dupes
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from("pulse_readings")
      .delete()
      .eq("customer_id", params.id)
      .gte("recorded_at", cutoff);

    if (rows.length > 0) {
      const inserts = rows.map((r) => ({
        customer_id:   params.id,
        connection_id: conn.id,
        recorded_at:   r.recorded_at,
        metric_type:   r.metric_type,
        value:         r.value,
        unit:          r.unit,
      }));
      const { error: insErr } = await admin.from("pulse_readings").insert(inserts);
      if (insErr) throw insErr;
    }

    await admin.from("pulse_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", conn.id);

    return NextResponse.json({ ok: true, count: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
