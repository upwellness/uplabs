import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

/**
 * List distinct CGM profile_name values.
 * For each: count of readings + first/last reading timestamps.
 * v1 schema doesn't have FK to customers — profile_name is a string key.
 * Admin sees all; non-admin sees all too (v1 had no row-level filter — review later).
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    // Aggregate per profile_name. Supabase doesn't expose GROUP BY in PostgREST,
    // so we use a Postgres function or fall back to fetching distinct names then count.
    // Fast path: get all profile_names + timestamps then aggregate in JS.
    // To stay cheap, select just the 3 columns.
    const { data, error } = await supa
      .from("cgm_readings")
      .select("profile_name, reading_timestamp")
      .order("reading_timestamp", { ascending: false })
      .limit(50000);

    if (error) throw error;

    const map = new Map<string, { count: number; first: number; last: number }>();
    for (const r of data ?? []) {
      const name = r.profile_name as string;
      const ts   = Number(r.reading_timestamp);
      const cur = map.get(name);
      if (cur) {
        cur.count += 1;
        if (ts < cur.first) cur.first = ts;
        if (ts > cur.last)  cur.last  = ts;
      } else {
        map.set(name, { count: 1, first: ts, last: ts });
      }
    }

    const profiles = Array.from(map.entries())
      .map(([name, v]) => ({ name, readings_count: v.count, first_reading: v.first, last_reading: v.last }))
      .sort((a, b) => b.last_reading - a.last_reading);

    return NextResponse.json({ profiles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
