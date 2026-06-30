/**
 * UP Labs v2 · Pulse — Unified Wearable + Longevity report (SPEC §7.6).
 * ─────────────────────────────────────────────────────────────────────
 * Server component — mirrors v1 app/pulse/report/[id]/page.tsx exactly: same auth
 * (getSession + ownership/co-coach), same admin queries, and the SAME data model via
 * buildWearableReport / buildLabTrends (lib/pulse/wearable-report.ts) so the report
 * logic is identical. Only the rendered view (_ReportView) is clinical-warm, and it
 * lazy-imports recharts so charts stay out of First-Load JS.
 *
 * Reuses: lib/pulse/wearable-report.ts · whoop_daily · pulse_readings · customer_lab_values.
 */
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer } from "@/lib/customers/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWearableReport, buildLabTrends } from "@/lib/pulse/wearable-report";
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
  if (!isAdmin && customer.coach_id !== session.user.id && !(await isAssignedToCustomer(session.user.id, id))) {
    redirect("/v2/pulse");
  }

  const [{ data: whoop }, { data: pulse }, { data: labs }] = await Promise.all([
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
  ]);

  const report = buildWearableReport({
    whoop: (whoop ?? []) as any,
    pulseReadings: (pulse ?? []).map((r: any) => ({ ...r, value: Number(r.value) })),
  });
  const labTrends = buildLabTrends((labs ?? []) as any);

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
      generatedAt={new Date().toISOString()}
    />
  );
}
