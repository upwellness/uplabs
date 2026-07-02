/**
 * UP Labs v2 · Pulse — Unified Wearable + Longevity report (SPEC §7.6).
 * ─────────────────────────────────────────────────────────────────────
 * Server component — same auth as v1 (getSession + ownership/co-coach), same wearable
 * + lab data model via buildWearableReport / buildLabTrends (lib/pulse/wearable-report.ts).
 * EXTENDED to also fetch & summarize 4 conditional sections (lib/pulse/extra-report.ts):
 *   BCA (measurements) · CGM (cgm_readings via customers.cgm_profile_names) ·
 *   Food (nutriscan_scans) · Combined insight. Each builder returns null when absent so
 *   the view skips it. The view (_ReportView) renders the premium "Pook" olive/gold CI
 *   and lazy-imports recharts so charts stay out of First-Load JS.
 *
 * Reuses: lib/pulse/wearable-report.ts · whoop_daily · pulse_readings · customer_lab_values
 *         · measurements · cgm_readings · cgm_meals · nutriscan_scans.
 */
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer, isDownlineCustomer } from "@/lib/customers/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWearableReport, buildLabTrends } from "@/lib/pulse/wearable-report";
import {
  buildBcaSummary, buildCgmSummary, buildFoodSummary, buildCombinedInsight,
} from "@/lib/pulse/extra-report";
import { resolveAge, birthDateLabel } from "@/lib/v2/identity";
import { ReportView } from "./_ReportView";

export const dynamic = "force-dynamic";

export default async function V2WearableReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSession();
  if (!session) redirect("/login");

  const admin = createAdminClient();
  const { data: customer } = await admin
    .from("customers").select("*").eq("id", id).maybeSingle();
  if (!customer) redirect("/v2/pulse");

  const isAdmin = session.profile.role === "admin";
  if (!isAdmin && customer.coach_id !== session.user.id && !(await isAssignedToCustomer(session.user.id, id)) && !(await isDownlineCustomer(session.user.id, id))) {
    redirect("/v2/pulse");
  }

  // cgm_profile_names links a customer → cgm_readings rows (admin client bypasses RLS).
  const cgmNames = Array.isArray(customer.cgm_profile_names)
    ? (customer.cgm_profile_names as string[]).filter(Boolean)
    : [];

  const [
    { data: whoop }, { data: pulse }, { data: labs },
    { data: bca }, { data: food }, cgmRes, cgmMealsRes,
  ] = await Promise.all([
    admin.from("whoop_daily")
      .select("cycle_date, recovery, rhr, hrv, spo2, skin_temp, strain, sleep_perf, resp_rate, asleep_min, deep_min, rem_min, light_min, sleep_eff")
      .eq("customer_id", id)
      .order("cycle_date", { ascending: true }),
    admin.from("pulse_readings")
      .select("metric_type, value, recorded_at")
      .eq("customer_id", id)
      .order("recorded_at", { ascending: true }).limit(5000),
    admin.from("customer_lab_values")
      .select("category, metric_key, metric_label_th, value_num, unit, ref_low, ref_high, ref_text, status, recorded_at")
      .eq("customer_id", id)
      .order("recorded_at", { ascending: true }),
    // BCA / body composition
    admin.from("measurements")
      .select("weight, fat_pct, muscle_pct, visceral, body_age, bmr, recorded_at")
      .eq("customer_id", id)
      .order("recorded_at", { ascending: true }),
    // Food / nutrition
    admin.from("nutriscan_scans")
      .select("food_identified, meal_type, eaten_on, calories_estimate, carb_g, protein_g, fat_g, fiber_g, glucose_impact_score, health_score, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: true }),
    // CGM / glucose — only query when the customer has linked profile names
    cgmNames.length
      ? admin.from("cgm_readings")
          .select("profile_name, reading_timestamp, date_str, glucose")
          .in("profile_name", cgmNames)
          .order("reading_timestamp", { ascending: true }).limit(20000)
      : Promise.resolve({ data: [] as any[] }),
    cgmNames.length
      ? admin.from("cgm_meals")
          .select("profile_name, meal_timestamp, date_str, description")
          .in("profile_name", cgmNames)
          .order("meal_timestamp", { ascending: true }).limit(2000)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const report = buildWearableReport({
    whoop: (whoop ?? []) as any,
    pulseReadings: (pulse ?? []).map((r: any) => ({ ...r, value: Number(r.value) })),
  });
  const labTrends = buildLabTrends((labs ?? []) as any);

  // New conditional sections — each builder returns null when the data is absent.
  const bcaSummary = buildBcaSummary((bca ?? []) as any);
  const cgmSummary = buildCgmSummary((cgmRes?.data ?? []) as any, (cgmMealsRes?.data ?? []) as any);
  const foodSummary = buildFoodSummary((food ?? []) as any);
  const combinedInsight = buildCombinedInsight({
    report,
    labByCategory: labTrends.byCategory,
    bca: bcaSummary,
    cgm: cgmSummary,
    food: foodSummary,
  });

  // Identity (SPEC §4): age via shared helper (birth_date → birth_year), DOB in ค.ศ.
  const idInput = { birth_date: customer.birth_date, birth_year: customer.birth_year };
  const age = resolveAge(idInput as any);
  const birthDate = customer.birth_date || customer.birth_year != null ? birthDateLabel(idInput as any) : null;

  return (
    <ReportView
      customerId={id}
      customer={{
        name: customer.name ?? "ลูกค้า",
        gender: customer.gender,
        age,
        height: customer.height ?? null,
        birthDate,
      }}
      report={report}
      labByCategory={labTrends.byCategory}
      labDates={labTrends.dates}
      bca={bcaSummary}
      cgm={cgmSummary}
      food={foodSummary}
      combinedInsight={combinedInsight}
      generatedAt={new Date().toISOString()}
    />
  );
}
