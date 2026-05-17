"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { MetricGauge } from "./_components/MetricGauge";
import { TrendCharts } from "./_components/TrendCharts";
import { CustomerPicker } from "./_components/CustomerPicker";
import { MeasurementForm } from "./_components/MeasurementForm";
import { MeasurementTable } from "./_components/MeasurementTable";
import { ReportBuilder } from "./_components/ReportBuilder";
import {
  classifyBodyFat, classifyMusclePct, classifyVisceralFat,
  classifyBMI, classifyBodyAge,
} from "@/lib/medical-status";
import { deriveBMI, deriveFatMass, deriveMuscleMass, deriveChronoAge } from "@/lib/bca-derive";
import type { Customer, Measurement, MeasurementWithDerived } from "@/lib/types";

export default function BCAPage() {
  const [customer,     setCustomer]     = useState<Customer | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementWithDerived[]>([]);
  const [formOpen,     setFormOpen]     = useState(false);
  const [editing,      setEditing]      = useState<MeasurementWithDerived | null>(null);
  const [reportOpen,   setReportOpen]   = useState(false);
  const [reportFocus,  setReportFocus]  = useState<MeasurementWithDerived | null>(null);
  const [loadingMs,    setLoadingMs]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const handleSelectCustomer = useCallback(async (c: Customer) => {
    setCustomer(c);
    setMeasurements([]);
    setError(null);
    setLoadingMs(true);
    try {
      const res  = await fetch(`/api/customers/${c.id}/measurements`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "โหลดข้อมูลไม่สำเร็จ");
      setMeasurements(json.measurements ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingMs(false);
    }
  }, []);

  const enrich = useCallback((m: Measurement): MeasurementWithDerived => ({
    ...m,
    bmi:         deriveBMI(m.weight, customer!.height),
    fat_mass:    deriveFatMass(m.weight, m.fat_pct),
    muscle_mass: deriveMuscleMass(m.weight, m.muscle_pct),
    chrono_age:  deriveChronoAge(customer!.birth_date ?? customer!.birth_year, m.recorded_at),
  }), [customer]);

  const handleSubmit = useCallback(async (data: Omit<Measurement, "id" | "customer_id">) => {
    if (!customer) return;
    try {
      if (editing) {
        const res = await fetch(`/api/measurements/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "แก้ไขไม่สำเร็จ");
        const updated = enrich(json.measurement);
        setMeasurements((prev) => prev.map((m) => (m.id === updated.id ? updated : m))
          .sort((a, b) => +new Date(b.recorded_at) - +new Date(a.recorded_at)));
      } else {
        const res = await fetch(`/api/customers/${customer.id}/measurements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ");
        const enriched = enrich(json.measurement);
        setMeasurements((prev) => [enriched, ...prev]);
      }
      setFormOpen(false);
      setEditing(null);
    } catch (e: any) {
      alert(e.message);
    }
  }, [customer, editing, enrich]);

  const handleEdit = useCallback((m: MeasurementWithDerived) => {
    setEditing(m);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback(async (m: MeasurementWithDerived) => {
    try {
      const res = await fetch(`/api/measurements/${m.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ลบไม่สำเร็จ");
      setMeasurements((prev) => prev.filter((x) => x.id !== m.id));
    } catch (e: any) {
      alert(e.message);
    }
  }, []);

  const openReportFromSession = (m: MeasurementWithDerived) => {
    setReportFocus(m);
    setReportOpen(true);
  };

  const latest   = measurements[0];
  const previous = measurements[1];

  const stats = useMemo(() => {
    if (!latest || !customer) return null;
    return {
      bmi:      latest.bmi != null     ? { value: latest.bmi,      level: classifyBMI(latest.bmi) } : null,
      fat:      latest.fat_pct != null ? { value: latest.fat_pct,  level: classifyBodyFat(latest.fat_pct, customer.gender) } : null,
      muscle:   latest.muscle_pct != null ? { value: latest.muscle_pct, level: classifyMusclePct(latest.muscle_pct, customer.gender) } : null,
      visceral: latest.visceral != null   ? { value: latest.visceral,   level: classifyVisceralFat(latest.visceral) } : null,
      bodyAge:  latest.body_age != null && latest.chrono_age != null
        ? { value: latest.body_age, level: classifyBodyAge(latest.body_age, latest.chrono_age) }
        : null,
    };
  }, [latest, customer]);

  /* Journey metrics */
  const journey = useMemo(() => {
    if (measurements.length === 0) return null;
    const sorted = [...measurements].sort((a, b) => +new Date(a.recorded_at) - +new Date(b.recorded_at));
    const first = sorted[0];
    const last  = sorted[sorted.length - 1];
    const daysSpan = Math.round((+new Date(last.recorded_at) - +new Date(first.recorded_at)) / (1000 * 60 * 60 * 24));
    const daysSinceLast = Math.round((Date.now() - +new Date(last.recorded_at)) / (1000 * 60 * 60 * 24));
    const weightStart = first.weight ?? null;
    const weightLast  = last.weight ?? null;
    const weightChange = weightStart != null && weightLast != null ? +(weightLast - weightStart).toFixed(1) : null;
    return { count: measurements.length, daysSpan, daysSinceLast, weightChange };
  }, [measurements]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-warm-white">
      <BgMesh />

      {/* ── Header ────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-ink-10/60 bg-warm-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-5">
            <Link href="/" className="group flex items-center gap-1.5 text-ink-40 hover:text-ink transition-colors text-sm">
              <span className="transition-transform group-hover:-translate-x-0.5">←</span>
              <span className="font-thai">Hub</span>
            </Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full border border-rose/20 bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-rose">
              BCA Tracker
            </span>
          </div>
          <CustomerPicker current={customer} onChange={handleSelectCustomer} />
        </div>
      </header>

      {/* ── No customer ───────────────────────────────── */}
      {!customer && <EmptyHero />}

      {/* ── Customer view ─────────────────────────────── */}
      {customer && (
        <>
          {/* Hero · Patient card */}
          <section className="relative mx-auto max-w-content px-6 lg:px-10 pt-10 lg:pt-14">
            <div className="mb-5 inline-flex items-center gap-2">
              <span className="h-px w-7 bg-rose" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-rose">Body Composition Analysis</span>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-ink-10 bg-white p-7 lg:p-9 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
              {/* decorative corner blob */}
              <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-gradient-to-br from-rose-pale/60 via-amber-pale/40 to-transparent blur-3xl" />

              <div className="relative flex flex-wrap items-start justify-between gap-6">
                <div className="flex items-start gap-5">
                  <PatientAvatar customer={customer} />
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
                      Patient · {customer.id.slice(0, 8)}
                    </div>
                    <h1 className="mt-1.5 font-head text-[clamp(28px,3.4vw,40px)] font-extrabold leading-[1.1] tracking-[-1px] text-ink">
                      {customer.name}
                    </h1>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-thai text-[13px] text-ink-60">
                      <PatientMeta icon={customer.gender === "male" ? "♂" : "♀"} label={customer.gender === "male" ? "ชาย" : "หญิง"} />
                      <Dot />
                      <PatientMeta
                        icon="🎂"
                        label={customer.birth_year ? `${new Date().getFullYear() - customer.birth_year} ปี` : "—"}
                      />
                      <Dot />
                      <PatientMeta icon="📏" label={customer.height ? `${customer.height} cm` : "—"} />
                      <Dot />
                      {loadingMs ? (
                        <span className="font-mono text-[11px] text-ink-40 animate-pulse">กำลังโหลด...</span>
                      ) : (
                        <PatientMeta icon="📊" label={`${measurements.length} measurements`} />
                      )}
                    </div>
                    {error && <p className="mt-2 text-xs text-status-warning">⚠ {error}</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => { setReportFocus(null); setReportOpen(true); }} disabled={measurements.length === 0}>
                    📄 สร้างรายงาน
                  </Button>
                  <Button variant="rose" onClick={() => { setEditing(null); setFormOpen(true); }}>+ บันทึกใหม่</Button>
                </div>
              </div>

              {/* Journey strip */}
              {journey && (
                <div className="relative mt-7 grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 border-t border-ink-5 pt-6">
                  <JourneyStat label="Sessions" value={journey.count}        unit=""    accent="rose"     />
                  <JourneyStat label="Days tracked" value={journey.daysSpan} unit="วัน" accent="science"  />
                  <JourneyStat
                    label={journey.daysSinceLast === 0 ? "Latest" : "Last measurement"}
                    value={journey.daysSinceLast}
                    unit={journey.daysSinceLast === 0 ? "วันนี้" : "วันก่อน"}
                    accent={journey.daysSinceLast > 30 ? "amber" : "wellness"}
                  />
                  <JourneyStat
                    label="Weight Δ overall"
                    value={journey.weightChange != null ? Math.abs(journey.weightChange) : 0}
                    unit={journey.weightChange == null ? "—" : journey.weightChange > 0 ? "kg ↑" : journey.weightChange < 0 ? "kg ↓" : "kg"}
                    accent={journey.weightChange == null ? "ink" : journey.weightChange < 0 ? "wellness" : journey.weightChange > 0 ? "amber" : "ink"}
                  />
                </div>
              )}
            </div>
          </section>

          {/* Latest snapshot */}
          {latest && stats && (
            <section className="relative mx-auto max-w-content px-6 lg:px-10 mt-12">
              <SectionHeader number="01" label="Latest snapshot" title="ค่าล่าสุดของการวัด" />
              <div className="grid gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-5">
                <SummaryCard label="น้ำหนัก" value={latest.weight ?? 0} unit="kg"
                  delta={previous ? +((latest.weight ?? 0) - (previous.weight ?? 0)).toFixed(1) : null} accent="rose" featured />
                {stats.fat && <SummaryCard label="Body Fat" value={stats.fat.value} unit="%" level={stats.fat.level}
                  delta={previous?.fat_pct ? +(stats.fat.value - previous.fat_pct).toFixed(1) : null} />}
                {stats.visceral && <SummaryCard label="Visceral Fat" value={stats.visceral.value} unit="lv" level={stats.visceral.level}
                  delta={previous?.visceral ? stats.visceral.value - previous.visceral : null} />}
                {stats.muscle && <SummaryCard label="Muscle" value={stats.muscle.value} unit="%" level={stats.muscle.level}
                  delta={previous?.muscle_pct ? +(stats.muscle.value - previous.muscle_pct).toFixed(1) : null} deltaInverted />}
                {stats.bodyAge && <SummaryCard label="Body Age" value={stats.bodyAge.value} unit="yr" level={stats.bodyAge.level}
                  delta={previous?.body_age ? stats.bodyAge.value - previous.body_age : null} />}
              </div>
            </section>
          )}

          {/* Gauges */}
          {latest && stats && (
            <section className="relative mx-auto max-w-content px-6 lg:px-10 mt-12">
              <SectionHeader number="02" label="Clinical reference" title="วิเคราะห์ตามเกณฑ์มาตรฐาน" description="ACE · WHO Asian-Pacific · UP Wellness scale" />
              <div className="grid gap-4 lg:grid-cols-2">
                {stats.fat && (
                  <MetricGauge title="Body Fat Percentage" subtitle={`ACE · เพศ${customer.gender === "male" ? "ชาย" : "หญิง"}`}
                    value={stats.fat.value} unit="%" min={5} max={45}
                    markers={customer.gender === "male"
                      ? [{ v: 13, label: "Athletic" }, { v: 17, label: "Fitness" }, { v: 24, label: "Average" }, { v: 29, label: "Obese" }]
                      : [{ v: 20, label: "Athletic" }, { v: 24, label: "Fitness" }, { v: 31, label: "Average" }, { v: 36, label: "Obese" }]}
                    level={stats.fat.level} sub={`Fat Mass · ${latest.fat_mass} kg`} />
                )}
                {stats.visceral && (
                  <MetricGauge title="Visceral Fat" subtitle="UP Wellness scale · เป้าหมาย ≤ 5"
                    value={stats.visceral.value} unit="" min={1} max={20}
                    markers={[
                      { v: 2,  label: "ดี" },
                      { v: 5,  label: "ปกติ" },
                      { v: 9,  label: "สูง" },
                      { v: 15, label: "สูงมาก" },
                    ]}
                    level={stats.visceral.level} sub="1-2 ดี · 3-5 ปกติ · 6-9 สูง · 10-15 สูงมาก · 16+ อันตราย" />
                )}
                {stats.muscle && (
                  <MetricGauge title="Muscle Mass %" subtitle="ค่าสูง = กล้ามเนื้อแข็งแรง"
                    value={stats.muscle.value} unit="%" min={20} max={50}
                    markers={customer.gender === "male"
                      ? [{ v: 33, label: "Low" }, { v: 40, label: "Normal" }, { v: 44, label: "High" }]
                      : [{ v: 24, label: "Low" }, { v: 31, label: "Normal" }, { v: 35, label: "High" }]}
                    level={stats.muscle.level} sub={`Muscle Mass · ${latest.muscle_mass} kg`} higherIsBetter />
                )}
                {stats.bmi && (
                  <MetricGauge title="BMI" subtitle="WHO Asian-Pacific standards"
                    value={stats.bmi.value} unit="" min={15} max={40}
                    markers={[{ v: 18.5, label: "Under" }, { v: 23, label: "Normal" }, { v: 25, label: "Over" }, { v: 30, label: "Obese" }]}
                    level={stats.bmi.level} sub="WHO Asian standards" />
                )}
              </div>
            </section>
          )}

          {/* Trends */}
          {measurements.length > 0 && (
            <section className="relative mx-auto max-w-content px-6 lg:px-10 mt-12">
              <SectionHeader number="03" label="Progress" title="แนวโน้มย้อนหลัง" description={`${measurements.length} sessions · ${journey?.daysSpan ?? 0} วัน`} />
              <div className="rounded-3xl border border-ink-10 bg-white p-6 lg:p-8 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                <TrendCharts measurements={measurements} gender={customer.gender} />
              </div>
            </section>
          )}

          {/* History */}
          {measurements.length > 0 && (
            <section className="relative mx-auto max-w-content px-6 lg:px-10 mt-12 mb-16">
              <SectionHeader number="04" label="History" title="ประวัติการวัด" description="คลิกแถวเพื่อสร้างรายงานของรอบนั้น" />
              <div className="rounded-3xl border border-ink-10 bg-white p-4 lg:p-6 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                <MeasurementTable
                  measurements={measurements}
                  gender={customer.gender}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onSelect={openReportFromSession}
                />
              </div>
            </section>
          )}

          {/* Loading skeleton (no measurements yet, still loading) */}
          {loadingMs && measurements.length === 0 && (
            <section className="relative mx-auto max-w-content px-6 lg:px-10 mt-12">
              <SectionHeader number="01" label="Loading" title="กำลังโหลดข้อมูล..." />
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-ink-10 bg-white p-5">
                    <div className="h-3 w-16 rounded bg-ink-5 animate-pulse" />
                    <div className="mt-3 h-9 w-20 rounded bg-ink-5 animate-pulse" />
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-3xl border border-ink-10 bg-white p-8">
                <div className="h-72 animate-pulse rounded-2xl bg-surface" />
              </div>
            </section>
          )}

          {/* Empty: no measurements yet */}
          {!loadingMs && measurements.length === 0 && !error && (
            <section className="relative mx-auto max-w-content px-6 lg:px-10 mt-12 mb-16">
              <div className="rounded-3xl border border-dashed border-ink-10 bg-white/60 p-12 text-center backdrop-blur-sm">
                <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-ultra to-amber-ultra text-3xl ring-1 ring-rose-pale/60">
                  📊
                </div>
                <div className="mt-5 font-head text-[20px] font-extrabold text-ink">ยังไม่มีข้อมูลการวัด</div>
                <p className="mt-2 max-w-sm mx-auto font-thai text-[13px] text-ink-60">
                  เริ่มต้นด้วยการบันทึกค่าการวัดครั้งแรก · จะ track น้ำหนัก · fat % · muscle · visceral · body age · BMR
                </p>
                <div className="mt-5">
                  <Button variant="rose" onClick={() => { setEditing(null); setFormOpen(true); }}>+ บันทึกครั้งแรก</Button>
                </div>
              </div>
            </section>
          )}

          <footer className="relative mx-auto max-w-content px-6 lg:px-10 pb-10 text-center font-mono text-[11px] text-ink-40">
            UPLABS BCA Tracker · v2.0 · ACE · WHO Asian-Pacific · UP Wellness Visceral scale
          </footer>
        </>
      )}

      {formOpen && customer && (
        <MeasurementForm
          customer={customer}
          initial={editing ?? undefined}
          onCancel={() => { setFormOpen(false); setEditing(null); }}
          onSubmit={handleSubmit}
        />
      )}

      {reportOpen && customer && (
        <ReportBuilder
          customer={customer}
          measurements={measurements}
          highlight={reportFocus}
          onClose={() => { setReportOpen(false); setReportFocus(null); }}
        />
      )}
    </main>
  );
}

/* ──────────────────────────────────────────────────── */
/* Background mesh                                      */
/* ──────────────────────────────────────────────────── */

function BgMesh() {
  return (
    <>
      <style>{`
        @keyframes bca-mesh-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-20px) scale(1.05); } }
        @keyframes bca-mesh-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-20px,15px) scale(0.95); } }
        .bca-mesh-a { animation: bca-mesh-a 22s ease-in-out infinite; }
        .bca-mesh-b { animation: bca-mesh-b 26s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .bca-mesh-a, .bca-mesh-b { animation: none; }
        }
      `}</style>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <div className="bca-mesh-a absolute -top-24 -left-16 h-[400px] w-[400px] rounded-full bg-rose-pale/45 blur-[120px]" />
        <div className="bca-mesh-b absolute top-16 right-0 h-[360px] w-[360px] rounded-full bg-science-pale/55 blur-[120px]" />
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────── */
/* Empty hero (no customer)                             */
/* ──────────────────────────────────────────────────── */

function EmptyHero() {
  return (
    <section className="relative mx-auto max-w-content px-6 lg:px-10 pt-16 pb-24">
      <div className="mb-5 inline-flex items-center gap-2">
        <span className="h-px w-7 bg-rose" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-rose">Body Composition Analysis</span>
      </div>
      <h1 className="font-head font-extrabold leading-[1.04] tracking-[-1.5px] text-ink text-[clamp(34px,4.5vw,52px)]">
        ติดตาม
        <span className="bg-gradient-to-br from-rose-deep via-rose to-amber bg-clip-text text-transparent"> Body Composition</span>
        <br />
        ของลูกค้าแบบต่อเนื่อง
      </h1>
      <p className="mt-4 max-w-2xl font-thai text-[15px] leading-[1.7] text-ink-60">
        บันทึก · วิเคราะห์ · ติดตามแนวโน้ม · สร้างรายงาน — ตามเกณฑ์ ACE · WHO Asian-Pacific · UP Wellness Visceral scale
      </p>
      <div className="mt-10 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-3 rounded-2xl border border-rose/30 bg-rose-ultra px-5 py-3.5">
          <span className="text-2xl">👈</span>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-rose font-bold">Step 1</div>
            <div className="font-thai text-sm font-semibold text-ink">เลือกลูกค้าที่มุมขวาบนเพื่อเริ่ม</div>
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        <FeatureCard
          icon="📏"
          title="6 metrics ครบ"
          description="น้ำหนัก · Body Fat % · Visceral Fat · Muscle % · Body Age · BMR"
          accent="rose"
        />
        <FeatureCard
          icon="📈"
          title="แนวโน้มย้อนหลัง"
          description="เห็น progress ทุก session · ดูได้ว่าค่าไหนกำลังดีขึ้นหรือแย่ลง"
          accent="science"
        />
        <FeatureCard
          icon="📄"
          title="รายงาน PDF/Image"
          description="สร้างรายงานพร้อมพิมพ์ ส่งให้ลูกค้าได้ทันที"
          accent="amber"
        />
      </div>
    </section>
  );
}

function FeatureCard({ icon, title, description, accent }: {
  icon: string; title: string; description: string; accent: "rose" | "wellness" | "science" | "amber";
}) {
  const bgMap = {
    rose: "bg-rose-ultra",
    wellness: "bg-wellness-ultra",
    science: "bg-science-ultra",
    amber: "bg-amber-ultra",
  } as const;
  return (
    <div className="rounded-2xl border border-ink-10 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(0,0,0,0.08)] hover:border-ink-20">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${bgMap[accent]} text-xl`}>{icon}</div>
      <h3 className="mt-4 font-head text-[16px] font-bold tracking-tight text-ink">{title}</h3>
      <p className="mt-1.5 font-thai text-[13px] leading-[1.6] text-ink-60">{description}</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────── */
/* Patient avatar                                       */
/* ──────────────────────────────────────────────────── */

function PatientAvatar({ customer }: { customer: Customer }) {
  const initials = customer.name.replace(/^(คุณ|นาย|นาง|น\.ส\.)\s?/, "").slice(0, 2).toUpperCase();
  const bg   = customer.gender === "male" ? "bg-science" : "bg-rose";
  const ring = customer.gender === "male" ? "ring-science-pale" : "ring-rose-pale";
  return (
    <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${bg} font-head text-[20px] font-extrabold text-white ring-4 ${ring}`}>
      {initials}
    </div>
  );
}

function PatientMeta({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[12px] opacity-70">{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function Dot() { return <span className="h-1 w-1 rounded-full bg-ink-20" />; }

/* ──────────────────────────────────────────────────── */
/* Journey stat                                         */
/* ──────────────────────────────────────────────────── */

const JOURNEY_ACCENT = {
  rose:     "text-rose",
  wellness: "text-wellness",
  science:  "text-science",
  amber:    "text-amber",
  ink:      "text-ink",
} as const;

function JourneyStat({ label, value, unit, accent }: {
  label: string; value: number; unit: string; accent: keyof typeof JOURNEY_ACCENT;
}) {
  return (
    <div>
      <div className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink-40">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`font-head text-[26px] font-extrabold leading-none tracking-tight ${JOURNEY_ACCENT[accent]}`}>{value.toLocaleString()}</span>
        <span className="font-mono text-[11px] text-ink-40">{unit}</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────── */
/* Section header                                       */
/* ──────────────────────────────────────────────────── */

function SectionHeader({ number, label, title, description }: {
  number: string; label: string; title: string; description?: string;
}) {
  return (
    <div className="mb-5 lg:mb-7 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-3 mb-1.5">
          <span className="font-mono text-[10px] text-ink-40">{number}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-rose" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rose">{label}</span>
        </div>
        <h2 className="font-thai text-[22px] lg:text-[26px] font-extrabold leading-tight tracking-tight text-ink">{title}</h2>
      </div>
      {description && (
        <p className="font-thai text-[12px] text-ink-50 max-w-md md:text-right">{description}</p>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────── */
/* Summary card (latest snapshot)                       */
/* ──────────────────────────────────────────────────── */

function SummaryCard({ label, value, unit, level, delta, deltaInverted, accent, featured }: {
  label: string; value: number; unit: string;
  level?: import("@/lib/medical-status").StatusLevel;
  delta?: number | null; deltaInverted?: boolean;
  accent?: "rose"; featured?: boolean;
}) {
  const deltaSign = delta == null ? null : delta > 0 ? "+" : "";
  const deltaGood = delta == null ? false : deltaInverted ? delta > 0 : delta < 0;
  const arrow = delta == null ? "" : delta > 0 ? "↑" : delta < 0 ? "↓" : "→";

  return (
    <div className={`group relative overflow-hidden rounded-2xl border ${featured ? "border-rose/30 bg-gradient-to-br from-rose-ultra to-warm-white" : "border-ink-10 bg-white"} px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(0,0,0,0.08)]`}>
      {featured && <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-rose-pale/60 blur-2xl" />}
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-40">{label}</div>
          {level && <StatusPill level={level} className="scale-90 origin-right" />}
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <div className="font-head text-[32px] font-extrabold leading-none tracking-tight text-ink">{value}</div>
          <div className="text-sm text-ink-40">{unit}</div>
        </div>
        {delta != null && delta !== 0 && (
          <div className={`mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${
            deltaGood ? "bg-status-bg-optimal text-status-optimal" : "bg-status-bg-warning text-status-warning"
          }`}>
            <span>{arrow}</span>
            <span>{deltaSign}{delta} {unit}</span>
          </div>
        )}
        {delta === 0 && (
          <div className="mt-1.5 font-mono text-[10px] text-ink-40">— ไม่เปลี่ยน</div>
        )}
      </div>
    </div>
  );
}
