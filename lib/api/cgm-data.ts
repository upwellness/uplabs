/**
 * I/O for CGM data behind the External API. Decisions live in cgm-import.ts and
 * cgm-metrics.ts (pure, tested); this file only moves rows.
 *
 * The join between a customer and their readings is `customers.cgm_profile_names[]`
 * → `cgm_readings.profile_name`. Historic imports named profiles by nickname, so a
 * customer may legitimately map to more than one profile name.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { CgmRow } from "./cgm-import";
import type { Point } from "./cgm-metrics";

const BKK_MS = 7 * 3_600_000;

export async function getProfileNames(customerId: string): Promise<{ name: string; profiles: string[] } | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("customers").select("name, cgm_profile_names").eq("id", customerId).maybeSingle();
  if (!data) return null;
  const profiles = Array.isArray((data as any).cgm_profile_names) ? ((data as any).cgm_profile_names as string[]) : [];
  return { name: (data as any).name as string, profiles };
}

/**
 * Make sure a profile name exists in cgm_profiles and is attached to the customer.
 * Both writes are idempotent so a repeated import costs nothing.
 */
export async function ensureProfile(customerId: string, profileName: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("cgm_profiles").upsert({ profile_name: profileName, customer_id: customerId }, { onConflict: "profile_name", ignoreDuplicates: true });
  const cur = await getProfileNames(customerId);
  if (cur && !cur.profiles.includes(profileName)) {
    await admin.from("customers").update({ cgm_profile_names: [...cur.profiles, profileName] }).eq("id", customerId);
  }
}

export interface InsertOutcome { inserted: number; skipped_existing: number }

/** Insert in chunks; rows already present (same profile + timestamp) are skipped, never overwritten. */
export async function insertReadings(rows: CgmRow[]): Promise<InsertOutcome | { error: string }> {
  const admin = createAdminClient();
  if (rows.length === 0) return { inserted: 0, skipped_existing: 0 };
  const profile = rows[0].profile_name;
  const lo = rows[0].reading_timestamp, hi = rows[rows.length - 1].reading_timestamp;

  // Count what is already there in this window so the caller can report "new vs already had".
  const { count: before } = await admin.from("cgm_readings")
    .select("id", { count: "exact", head: true })
    .eq("profile_name", profile).gte("reading_timestamp", lo).lte("reading_timestamp", hi);

  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await admin.from("cgm_readings")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "profile_name,reading_timestamp", ignoreDuplicates: true });
    if (error) return { error: error.message };
  }

  const { count: after } = await admin.from("cgm_readings")
    .select("id", { count: "exact", head: true })
    .eq("profile_name", profile).gte("reading_timestamp", lo).lte("reading_timestamp", hi);

  const inserted = Math.max(0, (after ?? 0) - (before ?? 0));
  return { inserted, skipped_existing: rows.length - inserted };
}

export interface ReadingRow { profile_name: string; original_time: string; reading_timestamp: number; date_str: string; glucose: number }

/** Readings for a set of profile names between two local dates (inclusive), ascending, capped. */
export async function getReadings(
  profiles: string[], fromDate: string, toDate: string, cap = 20_000,
): Promise<ReadingRow[]> {
  if (profiles.length === 0) return [];
  const admin = createAdminClient();
  const { data } = await admin.from("cgm_readings")
    .select("profile_name, original_time, reading_timestamp, date_str, glucose")
    .in("profile_name", profiles)
    .gte("date_str", fromDate).lte("date_str", toDate)
    .order("reading_timestamp", { ascending: true })
    .limit(cap);
  return ((data ?? []) as any[]).map((r) => ({ ...r, reading_timestamp: Number(r.reading_timestamp), glucose: Number(r.glucose) }));
}

export const toPoints = (rows: ReadingRow[]): Point[] => rows.map((r) => ({ t: r.reading_timestamp, v: r.glucose }));

/** Latest reading date across the customer's profiles — anchors the default "last N days" window. */
export async function latestDate(profiles: string[]): Promise<string | null> {
  if (profiles.length === 0) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("cgm_readings").select("date_str").in("profile_name", profiles)
    .order("date_str", { ascending: false }).limit(1).maybeSingle();
  return (data as any)?.date_str ?? null;
}

/** "YYYY-MM-DD" for a local Bangkok date N days before another local date. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const todayBangkok = () => new Date(Date.now() + BKK_MS).toISOString().slice(0, 10);
