import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer, isDownlineCustomer } from "@/lib/customers/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/ui/Logo";
import { CgmLinkManager } from "../../pulse/master/[id]/CgmLinkManager";
import { CustomerEditor } from "./CustomerEditor";
import { WearableLinkPanel } from "./WearableLinkPanel";
import { LatestLabsCard } from "./LatestLabsCard";
import { LabTrendCharts } from "./LabTrendCharts";
import { AllergyPanel } from "./AllergyPanel";
import { Customer360 } from "./Customer360";

export const dynamic = "force-dynamic";

export default async function CustomerProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { legacy?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const admin = createAdminClient();
  const { data: customer } = await admin
    .from("customers").select("*").eq("id", params.id).maybeSingle();
  if (!customer) redirect("/customers");

  const isAdmin = session.profile.role === "admin";
  if (
    !isAdmin &&
    customer.coach_id !== session.user.id &&
    !(await isAssignedToCustomer(session.user.id, params.id)) &&
    !(await isDownlineCustomer(session.user.id, params.id)) // upline read-only visibility
  ) redirect("/customers");

  // ─── Customer 360 view (default · new) ───
  if (searchParams.legacy !== "1") {
    return (
      <main className="min-h-screen bg-surface">
        <Customer360 customerId={params.id} />
      </main>
    );
  }

  // ─── Legacy view (fallback · ?legacy=1) ───

  // Parallel fetch all related data
  const [
    { data: bcaLatest },
    { count: bcaCount },
    { data: connection },
    { count: readingCount },
    { data: latestIntake },
    { data: assessments },
    { data: linkedLeads },
    { data: allCgmProfiles },
  ] = await Promise.all([
    admin.from("measurements")
      .select("recorded_at, weight, fat_pct, muscle_pct, visceral, body_age")
      .eq("customer_id", params.id)
      .order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("measurements").select("*", { count: "exact", head: true }).eq("customer_id", params.id),
    admin.from("pulse_connections")
      .select("id, provider, status, connected_at, last_sync_at, expires_at")
      .eq("customer_id", params.id).maybeSingle(),
    admin.from("pulse_readings").select("*", { count: "exact", head: true }).eq("customer_id", params.id),
    admin.from("pulse_intakes")
      .select("submitted_at, goal, budget_range")
      .eq("customer_id", params.id)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("pulse_assessments")
      .select("id, status, blocked, share_token, sent_at, created_at, ai_output")
      .eq("customer_id", params.id)
      .order("created_at", { ascending: false }).limit(3),
    admin.from("healthcheck_leads")
      .select("id, quiz_type, name, risk_score, risk_level, created_at")
      .eq("customer_id", params.id)
      .order("created_at", { ascending: false }),
    admin.rpc("cgm_list_profiles").then(
      (r: any) => r.error
        ? admin.from("cgm_readings").select("profile_name").limit(5000)
        : { data: (r.data ?? []).map((x: any) => ({ profile_name: x.profile_name })) },
    ),
  ]);

  const age = customer.birth_year ? new Date().getFullYear() - customer.birth_year : null;
  const cgmProfiles: string[] = customer.cgm_profile_names ?? [];
  const allProfileOpts = Array.from(new Set((allCgmProfiles ?? []).map((p: any) => p.profile_name).filter(Boolean) as string[])).sort();

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
          <div className="flex items-center gap-5">
            <Link href="/customers" className="text-ink-40 hover:text-ink transition-colors text-sm">← Customers</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-rose">
              Customer Profile
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-content px-6 py-10">
        {/* Header card */}
        <section className="rounded-3xl border border-ink-10 bg-white p-8">
          <CustomerEditor customer={customer} />
        </section>

        {/* Medical Records Overview */}
        <Section title="🧾 Medical Records · Latest Labs" subtitle="ดูค่าผลตรวจล่าสุดของแต่ละหมวด · คลิกขยายเพื่อดูรายการ">
          <LatestLabsCard customerId={params.id} />
        </Section>

        {/* Lab Trends — chart per metric over time */}
        <Section title="📈 ผลเลือดย้อนหลัง · กราฟแนวโน้ม" subtitle="เลือกหมวดเพื่อดูแต่ละค่าตามเวลา · monotone smooth · มี reference range">
          <LabTrendCharts customerId={params.id} />
        </Section>

        {/* Allergy / Food Sensitivity */}
        <Section title="🧪 Allergy · Food Sensitivity" subtitle="IgG/IgE test results · supplement safety mapping">
          <AllergyPanel customerId={params.id} />
        </Section>

        {/* Cross-app quick access */}
        <section className="mt-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
          <AppCard
            icon="📊" name="BCA Tracker" subtitle={`${bcaCount ?? 0} measurements`}
            href={`/bca`}
            extra={bcaLatest ? `ล่าสุด: ${new Date(bcaLatest.recorded_at).toLocaleDateString("th-TH")}` : "ยังไม่มี"}
            active={(bcaCount ?? 0) > 0}
          />
          <AppCard
            icon="📈" name="CGM Analyzer" subtitle={`${cgmProfiles.length} profile linked`}
            href={`/cgm`}
            extra={cgmProfiles.length > 0 ? cgmProfiles.join(" · ") : "ยังไม่ link"}
            active={cgmProfiles.length > 0}
          />
          <AppCard
            icon="📱" name="UP Pulse" subtitle={connection?.status === "active" ? "Connected" : "ไม่ได้ connect"}
            href={`/pulse`}
            extra={`${readingCount ?? 0} readings · ${assessments?.length ?? 0} assessments`}
            active={connection?.status === "active"}
          />
          <AppCard
            icon="🏥" name="Health Check Lead" subtitle={`${linkedLeads?.length ?? 0} leads`}
            href={`/healthcheck`}
            extra={linkedLeads?.[0] ? `Risk ${linkedLeads[0].risk_score}` : "ไม่มี lead"}
            active={(linkedLeads?.length ?? 0) > 0}
          />
        </section>

        {/* BCA latest */}
        {bcaLatest && (
          <Section title="BCA · ค่าล่าสุด" subtitle={new Date(bcaLatest.recorded_at).toLocaleDateString("th-TH")}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Metric label="น้ำหนัก"    value={bcaLatest.weight}     unit="kg" />
              <Metric label="Fat %"      value={bcaLatest.fat_pct}    unit="%" />
              {/* Omron order: Visceral มาก่อน Muscle */}
              <Metric label="Visceral"   value={bcaLatest.visceral}   unit="lv" />
              <Metric label="Muscle %"   value={bcaLatest.muscle_pct} unit="%" />
              <Metric label="Body Age"   value={bcaLatest.body_age}   unit="yr" />
            </div>
          </Section>
        )}

        {/* CGM Link Manager */}
        <Section title="CGM · Link Profile" subtitle={cgmProfiles.length > 0 ? `linked ${cgmProfiles.length}` : "ยังไม่ link"}>
          <CgmLinkManager
            customerId={params.id}
            linked={cgmProfiles}
            allProfiles={allProfileOpts}
          />
        </Section>

        {/* Wearable / Pulse */}
        <Section title="Wearable · Google Fit" subtitle={connection?.status === "active" ? "Connected" : "ไม่ได้ connect"}>
          <WearableLinkPanel
            customerId={params.id}
            connection={connection ?? null}
            readingCount={readingCount ?? 0}
          />
        </Section>

        {/* Health Check leads */}
        {linkedLeads && linkedLeads.length > 0 && (
          <Section title="Health Check / MetaFlex · Leads ที่ convert มา" subtitle={`${linkedLeads.length} leads`}>
            <div className="space-y-2">
              {linkedLeads.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between rounded-xl border border-ink-10 bg-white px-4 py-3">
                  <div>
                    <div className="font-thai text-sm font-semibold text-ink">
                      {l.quiz_type === "metaflex" ? "🔥 MetaFlex" : "🏥 Health Check"} · {l.name}
                    </div>
                    <div className="font-mono text-[10px] text-ink-40">
                      {new Date(l.created_at).toLocaleString("th-TH")}
                    </div>
                  </div>
                  <div className="rounded-full bg-ink px-3 py-1 font-mono text-[10px] font-bold text-white">
                    Risk {l.risk_score}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Pulse assessments */}
        {assessments && assessments.length > 0 && (
          <Section title="UP Pulse · Assessments" subtitle={`${assessments.length} รายงาน`}>
            <div className="space-y-2">
              {assessments.map((a: any) => (
                <div key={a.id} className="rounded-xl border border-ink-10 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-thai text-sm font-semibold text-ink">
                          {a.blocked ? "⚕️ Blocked" : a.sent_at ? "✅ Sent" : "📝 Draft"}
                        </div>
                        <div className="font-mono text-[10px] text-ink-40">{new Date(a.created_at).toLocaleString("th-TH")}</div>
                      </div>
                      <p className="mt-1 font-thai text-[12px] text-ink-60 line-clamp-1">
                        {a.ai_output?.summary ?? "—"}
                      </p>
                    </div>
                    <Link href={`/pulse/assessments/${a.id}`} target="_blank" className="rounded-md border border-ink-10 px-2.5 py-1 text-[11px] font-semibold text-ink hover:border-ink-20">
                      👁
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Intake */}
        {latestIntake && (
          <Section title="UP Pulse · Latest Intake" subtitle={new Date(latestIntake.submitted_at).toLocaleString("th-TH")}>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-surface px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-ink-40">เป้าหมาย</div>
                <div className="mt-1 font-thai text-sm text-ink">{latestIntake.goal ?? "—"}</div>
              </div>
              <div className="rounded-xl bg-surface px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-ink-40">งบประมาณ</div>
                <div className="mt-1 font-thai text-sm text-ink">{latestIntake.budget_range ?? "—"}</div>
              </div>
            </div>
          </Section>
        )}
      </div>
    </main>
  );
}

/* ─── components ──────────────────────────── */

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-3xl border border-ink-10 bg-white p-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-head text-[18px] font-extrabold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-40">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function AppCard({ icon, name, subtitle, href, extra, active }: {
  icon: string; name: string; subtitle: string; href: string; extra: string; active: boolean;
}) {
  return (
    <Link href={href} className={`block rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm ${active ? "border-ink-10 bg-white" : "border-dashed border-ink-10 bg-surface opacity-80"}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-ultra text-xl">{icon}</div>
      <div className="mt-3 font-head text-[14px] font-bold text-ink">{name}</div>
      <div className="mt-0.5 font-thai text-[11px] text-ink-60">{subtitle}</div>
      <div className="mt-2 font-mono text-[10px] text-ink-40 truncate">{extra}</div>
    </Link>
  );
}

function Metric({ label, value, unit }: { label: string; value: any; unit: string }) {
  return (
    <div className="rounded-xl bg-surface px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-40">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <div className="font-head text-[22px] font-extrabold leading-none text-ink">{value ?? "—"}</div>
        <div className="text-[11px] text-ink-40">{unit}</div>
      </div>
    </div>
  );
}
