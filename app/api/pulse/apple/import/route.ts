import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { APPLE_METRIC_MAP, type AppleDaily } from "@/lib/pulse/apple-health";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Import Apple Health daily summary (already parsed client-side from export.xml).
 *
 * Body: { customer_id: string, days: AppleDaily[] }
 *
 * Apple HealthKit has no server API, so the browser parses the big export and
 * sends only the compact daily aggregates. We store them in pulse_readings
 * (provider 'apple_manual') — the same generic table Google Fit uses — so they
 * flow straight into the unified wearable report.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const customerId: string | undefined = body.customer_id;
    const days: AppleDaily[] | undefined = body.days;
    if (!customerId) return NextResponse.json({ error: "customer_id required" }, { status: 400 });
    if (!Array.isArray(days) || days.length === 0) {
      return NextResponse.json({ error: "no days to import" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Ownership check (admin bypasses)
    const isAdmin = session.profile.role === "admin";
    if (!isAdmin) {
      const { data: cust } = await admin
        .from("customers").select("id, coach_id").eq("id", customerId).maybeSingle();
      if (!cust) return NextResponse.json({ error: "customer not found" }, { status: 404 });
      if (cust.coach_id !== session.user.id)
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Connection (provider apple_manual · already allowed by pulse_connections check)
    const { data: conn } = await admin
      .from("pulse_connections")
      .upsert({
        customer_id: customerId, provider: "apple_manual",
        access_token_enc: "manual", status: "active",
        connected_at: new Date().toISOString(), last_sync_at: new Date().toISOString(),
      }, { onConflict: "customer_id,provider" })
      .select().single();
    const connectionId = conn?.id ?? null;

    // Idempotent: clear previous apple readings for this connection
    if (connectionId) {
      await admin.from("pulse_readings").delete().eq("connection_id", connectionId);
    }

    // Flatten daily aggregates → one pulse_readings row per metric per day
    const rows: any[] = [];
    for (const d of days) {
      const recordedAt = `${d.date}T12:00:00Z`; // noon anchor per day
      for (const { field, metric, unit } of APPLE_METRIC_MAP) {
        const v = (d as any)[field];
        if (v == null) continue;
        rows.push({
          customer_id: customerId,
          connection_id: connectionId,
          recorded_at: recordedAt,
          metric_type: metric,
          value: v,
          unit,
          source_data: { source: "apple_health", field },
        });
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "no metrics parsed from export" }, { status: 400 });
    }

    // Insert in chunks (avoid payload limits)
    const CHUNK = 1000;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await admin.from("pulse_readings").insert(rows.slice(i, i + CHUNK));
      if (error) throw new Error(`pulse_readings insert: ${error.message}`);
    }
    await admin.from("pulse_connections")
      .update({ last_sync_at: new Date().toISOString() }).eq("id", connectionId);

    const dates = days.map((d) => d.date).sort();
    return NextResponse.json({
      ok: true,
      days: days.length,
      metrics_written: rows.length,
      date_range: { start: dates[0], end: dates[dates.length - 1] },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
