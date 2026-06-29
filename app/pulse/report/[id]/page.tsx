import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer } from "@/lib/customers/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWearableReport, buildLabTrends } from "@/lib/pulse/wearable-report";
import { WearableReportView } from "./WearableReportView";

export const dynamic = "force-dynamic";

export default async function WearableReportPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const admin = createAdminClient();
  const { data: customer } = await admin
    .from("customers").select("*").eq("id", params.id).maybeSingle();
  if (!customer) redirect("/pulse");

  const isAdmin = session.profile.role === "admin";
  if (!isAdmin && customer.coach_id !== session.user.id && !(await isAssignedToCustomer(session.user.id, params.id))) redirect("/pulse");

  const [{ data: whoop }, { data: pulse }, { data: labs }] = await Promise.all([
    admin.from("whoop_daily")
      .select("cycle_date, recovery, rhr, hrv, spo2, skin_temp, strain, sleep_perf, resp_rate, asleep_min, deep_min, rem_min, light_min, sleep_eff")
      .eq("customer_id", params.id)
      .order("cycle_date", { ascending: true }),
    admin.from("pulse_readings")
      .select("metric_type, value, recorded_at")
      .eq("customer_id", params.id)
      .order("recorded_at", { ascending: true }).limit(5000),
    admin.from("customer_lab_values")
      .select("category, metric_key, metric_label_th, value_num, unit, ref_low, ref_high, ref_text, status, recorded_at")
      .eq("customer_id", params.id)
      .order("recorded_at", { ascending: true }),
  ]);

  const report = buildWearableReport({
    whoop: (whoop ?? []) as any,
    pulseReadings: (pulse ?? []).map((r: any) => ({ ...r, value: Number(r.value) })),
  });
  const labTrends = buildLabTrends((labs ?? []) as any);

  // Compute age from birth_year (master uses customer.age via a view; recompute safely)
  const birthYear: number | null = customer.birth_year ?? null;
  const age = birthYear ? new Date().getFullYear() - birthYear : null;

  return (
    <WearableReportView
      customer={{
        name: customer.name,
        gender: customer.gender,
        age,
        height: customer.height ?? null,
      }}
      report={report}
      labByCategory={labTrends.byCategory}
      labDates={labTrends.dates}
      generatedAt={new Date().toISOString()}
    />
  );
}
