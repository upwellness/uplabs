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

    // Use Postgres RPC `cgm_list_profiles` to aggregate in SQL — avoids PostgREST row limits.
    const { data, error } = await supa.rpc("cgm_list_profiles");

    if (error) {
      // Fallback: scan rows client-side (capped). Useful while RPC isn't installed.
      const fallback = await supa
        .from("cgm_readings")
        .select("profile_name, reading_timestamp")
        .order("reading_timestamp", { ascending: false })
        .limit(50000);

      if (fallback.error) throw error; // throw original RPC error

      const map = new Map<string, { count: number; first: number; last: number }>();
      for (const r of fallback.data ?? []) {
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
      return NextResponse.json({ profiles, fallback: true });
    }

    const profiles = (data ?? []).map((r: any) => ({
      name:           r.profile_name,
      readings_count: Number(r.readings_count),
      first_reading:  Number(r.first_reading),
      last_reading:   Number(r.last_reading),
    }));

    return NextResponse.json({ profiles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
