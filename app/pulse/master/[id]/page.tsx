import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMasterSnapshot } from "@/lib/pulse/master-data";
import { Logo } from "@/components/ui/Logo";

export const dynamic = "force-dynamic";

export default async function MasterPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const admin = createAdminClient();
  const { data: customer } = await admin
    .from("customers").select("*").eq("id", params.id).maybeSingle();
  if (!customer) redirect("/pulse");

  const isAdmin = session.profile.role === "admin";
  if (!isAdmin && customer.coach_id !== session.user.id) redirect("/pulse");

  const sevenDaysAgoIso = new Date(Date.now() - 7  * 86_400_000).toISOString();
  const fourteenDaysAgo = Date.now()    - 14 * 86_400_000;

  const [
    { data: bcaHistory },
    { data: cgmReadings },
    { data: pulseReadings },
    { data: intake },
  ] = await Promise.all([
    admin.from("measurements")
      .select("recorded_at, weight, fat_pct, visceral, muscle_pct, body_age, bmr")
      .eq("customer_id", params.id)
      .order("recorded_at", { ascending: false }).limit(20),
    admin.from("cgm_readings")
      .select("reading_timestamp, glucose")
      .eq("profile_name", customer.name)
      .gte("reading_timestamp", fourteenDaysAgo)
      .order("reading_timestamp", { ascending: false }).limit(5000),
    admin.from("pulse_readings")
      .select("metric_type, value, recorded_at")
      .eq("customer_id", params.id)
      .gte("recorded_at", sevenDaysAgoIso)
      .limit(1000),
    admin.from("pulse_intakes")
      .select("*")
      .eq("customer_id", params.id)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const master = buildMasterSnapshot({
    customer: {
      name:       customer.name,
      gender:     customer.gender,
      birth_year: customer.birth_year,
      height:     customer.height,
    },
    bca_history:    (bcaHistory ?? []) as any,
    cgm_readings:   (cgmReadings ?? []).map((r: any) => ({ ...r, reading_timestamp: Number(r.reading_timestamp) })),
    pulse_readings: (pulseReadings ?? []).map((r: any) => ({ ...r, value: Number(r.value) })),
    pulse_intake: intake ? {
      submitted_at:  intake.submitted_at,
      medications:   intake.medications ?? [],
      conditions:    intake.conditions ?? [],
      pregnant:      !!intake.pregnant,
      breastfeeding: !!intake.breastfeeding,
      goal:          intake.goal,
      budget_range:  intake.budget_range,
    } : null,
  });

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
          <div className="flex items-center gap-5">
            <Link href="/pulse" className="text-ink-40 hover:text-ink transition-colors text-sm">← UP Pulse</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-rose">
              Master Data
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-content px-6 py-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Customer Master Profile</div>
        <h1 className="mt-2 font-head text-[32px] font-extrabold tracking-tight text-ink">{master.customer.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-4 font-thai text-sm text-ink-60">
          <span>{master.customer.gender === "male" ? "ชาย" : "หญิง"}</span>
          {master.customer.age && <><Dot /><span>{master.customer.age} ปี</span></>}
          {master.customer.height_cm && <><Dot /><span>{master.customer.height_cm} cm</span></>}
        </div>

        {/* ── Body Composition ── */}
        <Section title="Body Composition" subtitle="ค่าจาก BCA / Inbody">
          <Grid>
            <Cell point={master.weight}       label="น้ำหนัก" />
            <Cell point={master.bmi}          label="BMI" />
            <Cell point={master.body_fat_pct} label="Body Fat %" />
            <Cell point={master.muscle_pct}   label="Muscle %" />
            <Cell point={master.visceral_fat} label="Visceral Fat" />
            <Cell point={master.body_age}     label="Body Age" />
            <Cell point={master.bmr}          label="BMR" />
          </Grid>
        </Section>

        {/* ── Wearable / Activity ── */}
        <Section title="Wearable · 7 วันล่าสุด" subtitle="Google Fit">
          <Grid>
            <Cell point={master.hr_avg}              label="HR (avg)" />
            <Cell point={master.hr_resting}          label="Resting HR" />
            <Cell point={master.hr_max}              label="HR (max)" />
            <Cell point={master.hr_variability}      label="HR Variability" />
            <Cell point={master.steps_avg}           label="Steps/วัน" />
            <Cell point={master.active_minutes_avg}  label="Active Min/วัน" />
            <Cell point={master.heart_minutes_avg}   label="Heart Min/วัน" />
            <Cell point={master.calories_expended}   label="Calories/วัน" />
            <Cell point={master.sleep_hours}         label="Sleep (total)" />
            <Cell point={master.sleep_deep}          label="Deep Sleep" />
            <Cell point={master.sleep_rem}           label="REM Sleep" />
          </Grid>
        </Section>

        {/* ── CGM ── */}
        <Section title="CGM · 14 วันล่าสุด" subtitle="Continuous Glucose Monitor">
          <Grid>
            <Cell point={master.glucose_avg} label="Avg Glucose" />
            <Cell point={master.glucose_tir} label="Time in Range" />
            <Cell point={master.glucose_max} label="Max" />
            <Cell point={master.glucose_min} label="Min" />
            <Cell point={master.glucose_gmi} label="GMI (HbA1c est)" />
          </Grid>
        </Section>

        {/* ── Intake ── */}
        <Section title="Intake (5 ข้อ)" subtitle={master.intake_as_of ? `submitted ${new Date(master.intake_as_of).toLocaleString("th-TH")}` : "ยังไม่กรอก"}>
          <div className="grid gap-2 sm:grid-cols-2">
            <ListField label="ยาประจำ"        items={master.medications} />
            <ListField label="โรคประจำตัว"   items={master.conditions} />
            <Field label="เป้าหมายหลัก"     value={master.goal} />
            <Field label="งบประมาณ"         value={master.budget_range} />
            <Field label="ตั้งครรภ์"          value={master.pregnant ? "ใช่" : "ไม่"} />
            <Field label="ให้นมบุตร"        value={master.breastfeeding ? "ใช่" : "ไม่"} />
          </div>
        </Section>

        <Link href={`/pulse?customer=${params.id}`} className="mt-8 inline-block rounded-full bg-rose px-5 py-2.5 text-sm font-semibold text-white">
          ← กลับไป UP Pulse
        </Link>
      </div>
    </main>
  );
}

/* ── Components ─────────────────────────────────── */

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-3xl border border-ink-10 bg-white p-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="font-head text-[20px] font-extrabold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-40">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

function Cell({ label, point }: { label: string; point: { value: any; unit?: string; as_of: string | null; days_stale: number | null; source: string } | null }) {
  const stale = point?.days_stale != null && point.days_stale > 30;
  return (
    <div className={`rounded-2xl border bg-white px-4 py-3 ${point ? "border-ink-10" : "border-dashed border-ink-10 opacity-60"}`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-40">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        {point ? (
          <>
            <div className={`font-head text-[22px] font-extrabold leading-none ${stale ? "text-ink-40" : "text-ink"}`}>
              {point.value}
            </div>
            {point.unit && <div className="text-[11px] text-ink-40">{point.unit}</div>}
          </>
        ) : (
          <div className="font-thai text-[12px] text-ink-40">ยังไม่มีข้อมูล</div>
        )}
      </div>
      {point?.as_of && (
        <div className={`mt-1 font-mono text-[10px] ${stale ? "text-amber-600 font-semibold" : "text-ink-40"}`}>
          {stale && "⚠ "}{new Date(point.as_of).toLocaleDateString("th-TH")} · {point.source}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-ink-10 bg-surface px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-40">{label}</div>
      <div className="mt-1 font-thai text-sm text-ink">{value ?? "—"}</div>
    </div>
  );
}

function ListField({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-ink-10 bg-surface px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-40">{label}</div>
      <div className="mt-1 font-thai text-sm text-ink">
        {items.length > 0 ? items.join(" · ") : "ไม่มี"}
      </div>
    </div>
  );
}

function Dot() { return <span className="h-1 w-1 rounded-full bg-ink-20" />; }
