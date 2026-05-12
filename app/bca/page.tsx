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
import {
  classifyBodyFat, classifyMusclePct, classifyVisceralFat,
  classifyBMI, classifyBodyAge,
} from "@/lib/medical-status";
import { deriveBMI, deriveFatMass, deriveMuscleMass, deriveChronoAge } from "@/lib/bca-derive";
import type { Customer, MeasurementWithDerived } from "@/lib/types";

export default function BCAPage() {
  const [customer,     setCustomer]     = useState<Customer | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementWithDerived[]>([]);
  const [formOpen,     setFormOpen]     = useState(false);
  const [loadingMs,    setLoadingMs]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  /* ── Load customer + measurements on picker change ── */
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

  /* ── Save new measurement to DB then prepend ── */
  const handleSubmit = useCallback(async (
    m: Omit<MeasurementWithDerived, "id" | "customer_id" | "bmi" | "fat_mass" | "muscle_mass" | "chrono_age">,
  ) => {
    if (!customer) return;
    try {
      const res  = await fetch(`/api/customers/${customer.id}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(m),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ");

      // Enrich locally so UI updates immediately
      const enriched: MeasurementWithDerived = {
        ...json.measurement,
        bmi:         deriveBMI(m.weight, customer.height),
        fat_mass:    deriveFatMass(m.weight, m.fat_pct),
        muscle_mass: deriveMuscleMass(m.weight, m.muscle_pct),
        chrono_age:  deriveChronoAge(customer.birth_year, m.recorded_at),
      };
      setMeasurements((prev) => [enriched, ...prev]);
      setFormOpen(false);
    } catch (e: any) {
      alert(e.message);
    }
  }, [customer]);

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

  return (
    <main className="min-h-screen bg-surface">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-10">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-ink-40 hover:text-ink transition-colors text-sm">← Hub</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-rose">BCA Tracker</span>
          </div>
          <CustomerPicker current={customer} onChange={handleSelectCustomer} />
        </div>
      </header>

      <div className="mx-auto max-w-content px-10 py-10">

        {/* ── Empty state ── */}
        {!customer && (
          <section className="flex flex-col items-center justify-center py-40 text-center">
            <div className="mb-4 text-5xl">📊</div>
            <h2 className="font-head text-2xl font-extrabold text-ink">เลือกลูกค้าเพื่อเริ่มต้น</h2>
            <p className="mt-3 font-thai text-sm text-ink-60">คลิก "เลือกลูกค้า" ที่มุมขวาบน แล้วเลือกชื่อที่ต้องการดู</p>
          </section>
        )}

        {/* ── Patient Card ── */}
        {customer && (
          <section className="rounded-3xl border border-ink-10 bg-white p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Patient · ID {customer.id.slice(0, 8)}</div>
                <h1 className="mt-2 font-head text-[32px] font-extrabold tracking-tight text-ink">{customer.name}</h1>
                <div className="mt-2 flex items-center gap-5 font-thai text-sm text-ink-60">
                  <span>{customer.gender === "male" ? "ชาย" : "หญิง"}</span>
                  <span className="h-1 w-1 rounded-full bg-ink-20" />
                  <span>{customer.birth_year ? `${new Date().getFullYear() - customer.birth_year} ปี` : "—"}</span>
                  <span className="h-1 w-1 rounded-full bg-ink-20" />
                  <span>สูง {customer.height ?? "—"} cm</span>
                  <span className="h-1 w-1 rounded-full bg-ink-20" />
                  {loadingMs
                    ? <span className="animate-pulse text-ink-40">กำลังโหลด...</span>
                    : <span>{measurements.length} measurements</span>
                  }
                </div>
                {error && <p className="mt-2 text-xs text-status-warning">{error}</p>}
              </div>
              <Button variant="rose" onClick={() => setFormOpen(true)}>+ บันทึกการวัดใหม่</Button>
            </div>

            {/* Summary cards */}
            {latest && stats && (
              <div className="mt-8 grid gap-3 grid-cols-2 lg:grid-cols-5">
                <SummaryCard label="น้ำหนัก" value={latest.weight ?? 0} unit="kg"
                  delta={previous ? +((latest.weight ?? 0) - (previous.weight ?? 0)).toFixed(1) : null} />
                {stats.fat && <SummaryCard label="Body Fat" value={stats.fat.value} unit="%" level={stats.fat.level}
                  delta={previous?.fat_pct ? +(stats.fat.value - previous.fat_pct).toFixed(1) : null} />}
                {stats.muscle && <SummaryCard label="Muscle" value={stats.muscle.value} unit="%" level={stats.muscle.level}
                  delta={previous?.muscle_pct ? +(stats.muscle.value - previous.muscle_pct).toFixed(1) : null} deltaInverted />}
                {stats.visceral && <SummaryCard label="Visceral Fat" value={stats.visceral.value} unit="lv" level={stats.visceral.level}
                  delta={previous?.visceral ? stats.visceral.value - previous.visceral : null} />}
                {stats.bodyAge && <SummaryCard label="Body Age" value={stats.bodyAge.value} unit="yr" level={stats.bodyAge.level}
                  delta={previous?.body_age ? stats.bodyAge.value - previous.body_age : null} />}
              </div>
            )}
          </section>
        )}

        {/* ── Gauges ── */}
        {customer && latest && stats && (
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            {stats.fat && (
              <MetricGauge
                title="Body Fat Percentage" subtitle={`ACE · เพศ${customer.gender === "male" ? "ชาย" : "หญิง"}`}
                value={stats.fat.value} unit="%" min={5} max={45}
                markers={customer.gender === "male"
                  ? [{ v: 13, label: "Athletic" }, { v: 17, label: "Fitness" }, { v: 24, label: "Average" }, { v: 29, label: "Obese" }]
                  : [{ v: 20, label: "Athletic" }, { v: 24, label: "Fitness" }, { v: 31, label: "Average" }, { v: 36, label: "Obese" }]}
                level={stats.fat.level} sub={`Fat Mass · ${latest.fat_mass} kg`}
              />
            )}
            {stats.muscle && (
              <MetricGauge
                title="Muscle Mass %" subtitle="ค่าสูง = กล้ามเนื้อแข็งแรง"
                value={stats.muscle.value} unit="%" min={20} max={50}
                markers={customer.gender === "male"
                  ? [{ v: 33, label: "Low" }, { v: 40, label: "Normal" }, { v: 44, label: "High" }]
                  : [{ v: 24, label: "Low" }, { v: 31, label: "Normal" }, { v: 35, label: "High" }]}
                level={stats.muscle.level} sub={`Muscle Mass · ${latest.muscle_mass} kg`} higherIsBetter
              />
            )}
            {stats.bmi && (
              <MetricGauge
                title="BMI" subtitle="WHO Asian-Pacific standards"
                value={stats.bmi.value} unit="" min={15} max={40}
                markers={[{ v: 18.5, label: "Under" }, { v: 23, label: "Normal" }, { v: 25, label: "Over" }, { v: 30, label: "Obese" }]}
                level={stats.bmi.level} sub="WHO Asian standards"
              />
            )}
            {stats.visceral && (
              <MetricGauge
                title="Visceral Fat" subtitle="Tanita scale · เป้าหมาย ≤ 9"
                value={stats.visceral.value} unit="" min={1} max={20}
                markers={[{ v: 9, label: "Optimal" }, { v: 12, label: "High" }, { v: 14, label: "Very High" }]}
                level={stats.visceral.level} sub="ค่าต่ำกว่า 10 = ปลอดภัย"
              />
            )}
          </section>
        )}

        {/* ── Trend Charts (multi-panel) ── */}
        {customer && measurements.length > 0 && (
          <section className="mt-6 rounded-3xl border border-ink-10 bg-white p-8">
            <div className="mb-6">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-40">Progress</div>
              <h2 className="mt-1 font-head text-2xl font-extrabold tracking-tight text-ink">แนวโน้มย้อนหลัง</h2>
            </div>
            <TrendCharts measurements={measurements} gender={customer.gender} />
          </section>
        )}

        {/* ── Loading skeleton ── */}
        {customer && loadingMs && measurements.length === 0 && (
          <section className="mt-6 rounded-3xl border border-ink-10 bg-white p-8">
            <div className="h-72 animate-pulse rounded-2xl bg-surface" />
          </section>
        )}

        {/* ── History Table ── */}
        {customer && measurements.length > 0 && (
          <section className="mt-6 rounded-3xl border border-ink-10 bg-white p-8">
            <div className="mb-6">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-40">History</div>
              <h2 className="mt-1 font-head text-2xl font-extrabold tracking-tight text-ink">ประวัติการวัด</h2>
            </div>
            <MeasurementTable measurements={measurements} gender={customer.gender} />
          </section>
        )}

        {/* ── Empty measurements ── */}
        {customer && !loadingMs && measurements.length === 0 && !error && (
          <section className="mt-6 rounded-3xl border border-ink-10 bg-white p-10 text-center">
            <div className="text-3xl mb-3">📋</div>
            <div className="font-thai text-sm text-ink-60">ยังไม่มีข้อมูลการวัด — กดปุ่ม "บันทึกการวัดใหม่" เพื่อเริ่มต้น</div>
          </section>
        )}

        <footer className="mt-12 pb-8 text-center font-mono text-[11px] text-ink-40">
          UPLABS BCA Tracker · v2.0 · ACE · WHO · Tanita reference standards
        </footer>
      </div>

      {formOpen && customer && (
        <MeasurementForm customer={customer} onCancel={() => setFormOpen(false)} onSubmit={handleSubmit as any} />
      )}
    </main>
  );
}

/* ── SummaryCard ── */
function SummaryCard({ label, value, unit, level, delta, deltaInverted }: {
  label: string; value: number; unit: string;
  level?: import("@/lib/medical-status").StatusLevel;
  delta?: number | null; deltaInverted?: boolean;
}) {
  const deltaSign = delta == null ? null : delta > 0 ? "+" : "";
  const deltaGood = delta == null ? false : deltaInverted ? delta > 0 : delta < 0;

  return (
    <div className="rounded-2xl border border-ink-10 bg-white px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-40">{label}</div>
        {level && <StatusPill level={level} className="scale-90 origin-right" />}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <div className="font-head text-[32px] font-extrabold leading-none tracking-tight text-ink">{value}</div>
        <div className="text-sm text-ink-40">{unit}</div>
      </div>
      {delta != null && (
        <div className={`mt-1 font-mono text-[11px] ${deltaGood ? "text-status-optimal" : "text-status-warning"}`}>
          {deltaSign}{delta} {unit} since last
        </div>
      )}
    </div>
  );
}
