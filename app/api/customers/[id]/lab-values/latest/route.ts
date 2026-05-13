import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

/**
 * Return latest value per metric_key for one customer.
 * Used for overview card on customer profile (most-recent value of each metric + which record it came from).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const { data, error } = await supa.from("customer_lab_values")
      .select("metric_key, metric_label_th, metric_label_en, value, value_num, unit, status, category, recorded_at, record_id")
      .eq("customer_id", params.id)
      .order("recorded_at", { ascending: false });
    if (error) throw error;

    // De-dup: keep only the latest per metric_key (data is already sorted desc)
    const seen = new Set<string>();
    const latest: any[] = [];
    for (const v of data ?? []) {
      if (seen.has(v.metric_key)) continue;
      seen.add(v.metric_key);
      latest.push(v);
    }

    return NextResponse.json({ values: latest });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
