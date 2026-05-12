import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { decryptToken, encryptToken } from "@/lib/pulse/crypto";
import { refreshAccessToken } from "@/lib/pulse/google-fit";

/**
 * Debug endpoint — returns RAW Google Fit response so we can see what data exists.
 * Coach/admin only. Use to diagnose "sync returned 0 readings" cases.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const { data: customer } = await supa
      .from("customers").select("id, coach_id").eq("id", params.id).single();
    if (!customer) return NextResponse.json({ error: "not found" }, { status: 404 });

    const isAdmin = session.profile.role === "admin";
    if (!isAdmin && customer.coach_id !== session.user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: conn } = await admin
      .from("pulse_connections").select("*").eq("customer_id", params.id).single();
    if (!conn) return NextResponse.json({ error: "not connected" }, { status: 404 });

    // Refresh if expiring
    let accessToken = decryptToken(conn.access_token_enc);
    const expiringSoon = new Date(conn.expires_at).getTime() - Date.now() < 5 * 60 * 1000;
    if (expiringSoon && conn.refresh_token_enc) {
      const refresh = decryptToken(conn.refresh_token_enc);
      const tokens = await refreshAccessToken(refresh);
      accessToken = tokens.access_token;
      await admin.from("pulse_connections").update({
        access_token_enc: encryptToken(tokens.access_token),
        expires_at:       new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      }).eq("id", conn.id);
    }

    const endMs = Date.now();
    const startMs = endMs - 7 * 24 * 60 * 60 * 1000;

    // Try different data type calls separately to diagnose
    const [hrRaw, stepsRaw, sleepRaw] = await Promise.all([
      fetchAggregate(accessToken, "com.google.heart_rate.bpm", startMs, endMs),
      fetchAggregate(accessToken, "com.google.step_count.delta", startMs, endMs),
      fetchAggregate(accessToken, "com.google.sleep.segment", startMs, endMs),
    ]);

    // List data sources (gives us hint of what's actually available)
    const sourcesRes = await fetch(
      "https://www.googleapis.com/fitness/v1/users/me/dataSources",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const sources = await sourcesRes.json();

    return NextResponse.json({
      connection: {
        provider:    conn.provider,
        connected_at: conn.connected_at,
        last_sync_at: conn.last_sync_at,
        scopes:      conn.scopes,
      },
      window: { startMs, endMs, days: 7 },
      results: {
        heart_rate: summarize(hrRaw),
        steps:      summarize(stepsRaw),
        sleep:      summarize(sleepRaw),
      },
      available_data_sources: (sources.dataSource ?? [])
        .map((s: any) => ({ id: s.dataStreamId, name: s.name, type: s.dataType?.name })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

async function fetchAggregate(accessToken: string, dataType: string, startMs: number, endMs: number) {
  const res = await fetch(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName: dataType }],
        bucketByTime: { durationMillis: 86_400_000 },
        startTimeMillis: startMs,
        endTimeMillis: endMs,
      }),
    },
  );
  if (!res.ok) return { error: `${res.status}: ${await res.text()}` };
  return res.json();
}

function summarize(raw: any) {
  if (raw?.error) return { error: raw.error };
  const buckets = raw.bucket ?? [];
  let totalPoints = 0;
  for (const b of buckets) for (const d of (b.dataset ?? [])) totalPoints += (d.point ?? []).length;
  return {
    bucket_count: buckets.length,
    total_points: totalPoints,
    first_bucket_sample: buckets[0]?.dataset?.[0]?.point?.[0] ?? null,
  };
}
