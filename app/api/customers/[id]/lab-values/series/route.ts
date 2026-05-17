import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

/**
 * Return full time-series of lab values for one customer.
 * Sorted ascending by recorded_at so charts can plot directly.
 * Used by LabTrendCharts on the customer profile.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const { data, error } = await supa.from("customer_lab_values")
      .select("metric_key, metric_label_th, metric_label_en, value, value_num, unit, status, category, recorded_at, ref_low, ref_high, ref_text, record_id")
      .eq("customer_id", params.id)
      .order("recorded_at", { ascending: true });
    if (error) throw error;

    return NextResponse.json({ values: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
