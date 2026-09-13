/**
 * One sync of one google_health connection: refresh the access token when needed,
 * pull the last 14 days, replace that window in pulse_readings, stamp last_sync_at.
 * Shared by the manual "Sync now" button, the OAuth callback and the nightly cron.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "./crypto";
import { fetchWindow, refreshAccessToken } from "./google-health";
import { recomputeQuietly } from "@/lib/health-design/load";

export const SYNC_DAYS = 14;

export async function syncGoogleHealth(conn: { id: string; customer_id: string; access_token_enc: string; refresh_token_enc: string | null; expires_at: string | null }): Promise<{ count: number; errors: string[] }> {
  const admin = createAdminClient();
  let accessToken = decryptToken(conn.access_token_enc);
  const expiringSoon = !conn.expires_at || new Date(conn.expires_at).getTime() - Date.now() < 5 * 60_000;
  if (expiringSoon) {
    if (!conn.refresh_token_enc) throw new Error("token หมดอายุและไม่มี refresh token — ต้องเชื่อมต่อใหม่");
    const t = await refreshAccessToken(decryptToken(conn.refresh_token_enc));
    accessToken = t.access_token;
    await admin.from("pulse_connections").update({ access_token_enc: encryptToken(t.access_token), expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString() }).eq("id", conn.id);
  }
  const { rows, errors } = await fetchWindow(accessToken, SYNC_DAYS);
  const cutoff = new Date(Date.now() - SYNC_DAYS * 864e5).toISOString();
  await admin.from("pulse_readings").delete().eq("connection_id", conn.id).gte("recorded_at", cutoff);
  if (rows.length) {
    const { error } = await admin.from("pulse_readings").insert(rows.map((r) => ({ customer_id: conn.customer_id, connection_id: conn.id, recorded_at: r.recorded_at, metric_type: r.metric_type, value: r.value, unit: r.unit, source_data: r.source_data ?? null })));
    if (error) throw new Error(error.message);
  }
  await admin.from("pulse_connections").update({ last_sync_at: new Date().toISOString(), status: "active", last_sync_error: errors.length ? errors.join("\n").slice(0, 2000) : null }).eq("id", conn.id);
  if (rows.length) await recomputeQuietly(conn.customer_id, "wearable_sync");
  return { count: rows.length, errors };
}
