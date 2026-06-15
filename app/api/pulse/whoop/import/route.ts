import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import {
  parseCycles, parseSleeps, parseWorkouts, parseJournal, parseWhoopCsvAuto,
  type WhoopDaily, type WhoopSleep, type WhoopWorkout, type WhoopJournal,
} from "@/lib/pulse/whoop";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Import WHOOP CSV export(s) for a customer.
 *
 * Body (JSON): {
 *   customer_id: string,
 *   files?: { cycles?, sleeps?, workouts?, journal? },  // named CSV text
 *   csv?: string,                                        // single CSV (auto-detected)
 * }
 *
 * Captures EVERY field across all 4 WHOOP exports. Upserts on natural keys
 * so re-importing the same export is idempotent. Verifies coach owns the
 * customer (admin bypasses).
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const customerId: string | undefined = body.customer_id;
    if (!customerId) return NextResponse.json({ error: "customer_id required" }, { status: 400 });

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

    // Collect parsed data from whichever inputs were provided
    let daily: WhoopDaily[] = [];
    let sleeps: WhoopSleep[] = [];
    let workouts: WhoopWorkout[] = [];
    let journal: WhoopJournal[] = [];

    const files = body.files ?? {};
    try {
      if (typeof files.cycles === "string")   daily   = parseCycles(files.cycles);
      if (typeof files.sleeps === "string")    sleeps  = parseSleeps(files.sleeps);
      if (typeof files.workouts === "string")  workouts = parseWorkouts(files.workouts);
      if (typeof files.journal === "string")   journal = parseJournal(files.journal);
      if (typeof body.csv === "string") {
        const auto = parseWhoopCsvAuto(body.csv);
        if (auto.daily) daily = auto.daily;
        if (auto.sleeps) sleeps = auto.sleeps;
        if (auto.workouts) workouts = auto.workouts;
        if (auto.journal) journal = auto.journal;
      }
    } catch (parseErr: any) {
      return NextResponse.json({ error: `CSV parse failed: ${parseErr.message}` }, { status: 400 });
    }

    if (daily.length + sleeps.length + workouts.length + journal.length === 0) {
      return NextResponse.json({ error: "no rows parsed — check the CSV file(s)" }, { status: 400 });
    }

    // Ensure a 'whoop_csv' connection exists (for last_sync tracking)
    const { data: conn } = await admin
      .from("pulse_connections")
      .upsert({
        customer_id: customerId, provider: "whoop_csv",
        access_token_enc: "csv", status: "active",
        connected_at: new Date().toISOString(), last_sync_at: new Date().toISOString(),
      }, { onConflict: "customer_id,provider" })
      .select().single();
    const connectionId = conn?.id ?? null;

    const stamp = (arr: any[]) =>
      arr.map((r) => ({ ...r, customer_id: customerId, connection_id: connectionId, raw: { ...r } }));
    const counts: Record<string, number> = {};

    if (daily.length) {
      const { error } = await admin.from("whoop_daily")
        .upsert(stamp(daily), { onConflict: "customer_id,cycle_date" });
      if (error) throw new Error(`whoop_daily: ${error.message}`);
      counts.daily = daily.length;
    }
    if (sleeps.length) {
      const { error } = await admin.from("whoop_sleeps")
        .upsert(stamp(sleeps), { onConflict: "customer_id,sleep_onset" });
      if (error) throw new Error(`whoop_sleeps: ${error.message}`);
      counts.sleeps = sleeps.length;
    }
    if (workouts.length) {
      const { error } = await admin.from("whoop_workouts")
        .upsert(stamp(workouts), { onConflict: "customer_id,workout_start" });
      if (error) throw new Error(`whoop_workouts: ${error.message}`);
      counts.workouts = workouts.length;
    }
    if (journal.length) {
      // journal has no `raw` column — strip it
      const jrows = journal.map((r) => ({ ...r, customer_id: customerId, connection_id: connectionId }));
      const { error } = await admin.from("whoop_journal")
        .upsert(jrows, { onConflict: "customer_id,cycle_start,question_text" });
      if (error) throw new Error(`whoop_journal: ${error.message}`);
      counts.journal = journal.length;
    }

    const dates = daily.map((d) => d.cycle_date).sort();
    return NextResponse.json({
      ok: true,
      imported: counts,
      date_range: dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null,
      connection_id: connectionId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
