/**
 * One sync of one google_health connection: refresh the access token when needed,
 * pull the last 14 days, replace that window in pulse_readings, add any blood-glucose
 * samples to the customer's CGM profile (cgm_readings), stamp last_sync_at.
 * Shared by the manual "Sync now" button, the OAuth callback and the nightly cron.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "./crypto";
import { fetchWindow, fetchGlucose, refreshAccessToken } from "./google-health";
import { getProfileNames, ensureProfile, insertReadings } from "@/lib/api/cgm-data";
import { normaliseProfileName } from "@/lib/api/cgm-import";
import { recomputeQuietly } from "@/lib/health-design/load";

export const SYNC_DAYS = 14;

export interface SyncResult { count: number; errors: string[]; glucose: { fetched: number; inserted: number; profile: string | null } }

export async function syncGoogleHealth(conn: { id: string; customer_id: string; access_token_enc: string; refresh_token_enc: string | null; expires_at: string | null }): Promise<SyncResult> {
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
  // Blood glucose → the customer's CGM profile (same dedupe rule as file import: existing timestamps are never overwritten).
  const glucose = { fetched: 0, inserted: 0, profile: null as string | null };
  try {
    const samples = await fetchGlucose(accessToken, SYNC_DAYS);
    glucose.fetched = samples.length;
    if (samples.length) {
      const cust = await getProfileNames(conn.customer_id);
      const profile = cust?.profiles[0] ?? normaliseProfileName(cust?.name ?? "") ?? conn.customer_id.slice(0, 8);
      glucose.profile = profile;
      await ensureProfile(conn.customer_id, profile);
      const out = await insertReadings(samples.map((s) => ({ profile_name: profile, original_time: s.original, reading_timestamp: s.ts_ms, date_str: s.local_date, glucose: s.mgdl })));
      if ("error" in out) errors.push(`blood-glucose: บันทึกไม่สำเร็จ — ${out.error}`); else glucose.inserted = out.inserted;
    }
  } catch (e: any) { errors.push(`blood-glucose: ${e?.message ?? e}`); }

  await admin.from("pulse_connections").update({ last_sync_at: new Date().toISOString(), status: "active", last_sync_error: errors.length ? errors.join("\n").slice(0, 2000) : null }).eq("id", conn.id);
  if (rows.length) await recomputeQuietly(conn.customer_id, "wearable_sync");
  if (glucose.inserted) await recomputeQuietly(conn.customer_id, "cgm_import");
  return { count: rows.length, errors, glucose };
}
