"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { MetricGauge } from "./_components/MetricGauge";
import { TrendChart } from "./_components/TrendChart";
import { CustomerPicker } from "./_components/CustomerPicker";
import { MeasurementForm } from "./_components/MeasurementForm";
import { MeasurementTable } from "./_components/MeasurementTable";
import {
  classifyBodyFat,
  classifyMusclePct,
  classifyVisceralFat,
  classifyBMI,
  classifyBodyAge,
} from "@/lib/medical-status";
import { deriveBMI, deriveFatMass, deriveMuscleMass, deriveChronoAge } from "@/lib/bca-derive";
import type { Customer, MeasurementWithDerived } from "@/lib/types";

/* ── Demo seed (replace with /api fetch in prod) ── */
const DEMO_CUSTOMER: Customer = {
  id: "demo-1",
  coach_id: "demo",
  name: "คุณนัท ทดสอบ",
  gender: "female",
  birth_year: 1992,
  height: 162,
  created_at: "2026-01-01",
};

const DEMO_MEASUREMENTS: MeasurementWithDerived[] = [
  { id: "m1", customer_id: "demo-1", recorded_at: "2026-05-10", weight: 61.2, fat_pct: 26.4, visceral: 6,  muscle_pct: 32.1, body_age: 31, bmr: 1340, bmi: 23.3, fat_mass: 16.2, muscle_mass: 19.6, chrono_age: 34 },
  { id: "m2", customer_id: "demo-1", recorded_at: "2026-04-26", weight: 62.8, fat_pct: 28.1, visceral: 7,  muscle_pct: 31.4, body_age: 33, bmr: 1325, bmi: 23.9, fat_mass: 17.6, muscle_mass: 19.7, chrono_age: 34 },
  { id: "m3", customer_id: "demo-1", recorded_at: "2026-04-12", weight: 64.1, fat_pct: 29.8, visceral: 8,  muscle_pct: 30.9, body_age: 35, bmr: 1318, bmi: 24.4, fat_mass: 19.1, muscle_mass: 19.8, chrono_age: 34 },
  { id: "m4", customer_id: "demo-1", recorded_at: "2026-03-29", weight: 65.3, fat_pct: 31.2, visceral: 9,  muscle_pct: 30.2, body_age: 37, bmr: 1305, bmi: 24.9, fat_mass: 20.4, muscle_mass: 19.7, chrono_age: 34 },
  { id: "m5", customer_id: "demo-1", recorded_at: "2026-03-15", weight: 66.8, fat_pct: 32.4, visceral: 10, muscle_pct: 29.5, body_age: 39, bmr: 1295, bmi: 25.5, fat_mass: 21.6, muscle_mass: 19.7, chrono_age: 34 },
];

export default function BCAPage() {
  const [customer, setCustomer] = useState<Customer>(DEMO_CUSTOMER);
  const [measurements, setMeasurements] = useState<MeasurementWithDerived[]>(DEMO_MEASUREMENTS);
  const [formOpen, setFormOpen] = useState(false);

  const latest = measurements[0];
  const previous = measurements[1];

  const stats = useMemo(() => {
    if (!latest) return null;
    return {
      bmi: latest.bmi != null ? { value: latest.bmi, level: classifyBMI(latest.bmi) } : null,
      fat: latest.fat_pct != null ? { value: latest.fat_pct, level: classifyBodyFat(latest.fat_pct, customer.gender) } : null,
      muscle: latest.muscle_pct != null ? { value: latest.muscle_pct, level: classifyMusclePct(latest.muscle_pct, customer.gender) } : null,
      visceral: latest.visceral != null ? { value: latest.visceral, level: classifyVisceralFat(latest.visceral) } : null,
      bodyAge: latest.body_age != null && latest.chrono_age != null
        ? { value: latest.body_age, level: classifyBodyAge(latest.body_age, latest.chrono_age) }
        : null,
    };
  }, [latest, customer.gender]);

  const handleSubmit = (m: Omit<MeasurementWithDerived, "id" | "customer_id" | "bmi" | "fat_mass" | "muscle_mass" | "chrono_age">) => {
    const enriched: MeasurementWithDerived = {
      ...m,
      id: `m-${Date.now()}`,
      customer_id: customer.id,
      bmi: deriveBMI(m.weight, customer.height),
      fat_mass: deriveFatMass(m.weight, m.fat_pct),
      muscle_mass: deriveMuscleMass(m.weight, m.muscle_pct),
      chrono_age: deriveChronoAge(customer.birth_year, m.recorded_at),
    };
    setMeasurements((prev) => [enriched, ...prev]);
    setFormOpen(false);
  };

  return (
    <main className="min-h-screen bg-surface">
      {/* ── Header ────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-10">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-ink-40 hover:text-ink transition-colors text-sm">← Hub</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-rose">BCA Tracker</span>
          </div>
          <div className="flex items-center gap-3">
            <CustomerPicker current={customer} onChange={setCustomer} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-content px-10 py-10">

        {/* ── Patient Card ─────────────────────────────── */}
        <section className="rounded-3xl border border-ink-10 bg-white p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Patient · ID {customer.id}</div>
              <h1 className="mt-2 font-head text-[32px] font-extrabold tracking-tight text-ink">{customer.name}</h1>
              <div className="mt-2 flex items-center gap-5 font-thai text-sm text-ink-60">
                <span>{customer.gender === "male" ? "ชาย" : "หญิง"}</span>
                <span className="h-1 w-1 rounded-full bg-ink-20" />
                <span>{customer.birth_year ? `${new Date().getFullYear() - customer.birth_year} ปี` : "—"}</span>
                <span className="h-1 w-1 rounded-full bg-ink-20" />
                <span>สูง {customer.height} cm</span>
                <span className="h-1 w-1 rounded-full bg-ink-20" />
                <span>{measurements.length} measurements</span>
              </div>
            </div>
            <Button variant="rose" onClick={() => setFormOpen(true)}>+ บันทึกการวัดใหม่</Button>
          </div>

          {/* ── Latest measurement summary ── */}
          {latest && stats && (
            <div className="mt-8 grid gap-3 grid-cols-2 lg:grid-cols-5">
              <SummaryCard label="น้ำหนัก" value={latest.weight ?? 0} unit="kg" delta={previous ? +((latest.weight ?? 0) - (previous.weight ?? 0)).toFixed(1) : null} />
              {stats.fat &&    <SummaryCard label="Body Fat" value={stats.fat.value}   unit="%"   level={stats.fat.level}    delta={previous?.fat_pct ? +(stats.fat.value - previous.fat_pct).toFixed(1) : null} />}
              {stats.muscle && <SummaryCard label="Muscle"   value={stats.muscle.value} unit="%"   level={stats.muscle.level} delta={previous?.muscle_pct ? +(stats.muscle.value - previous.muscle_pct).toFixed(1) : null} deltaInverted />}
              {stats.visceral && <SummaryCard label="Visceral Fat" value={stats.visceral.value} unit="lv" level={stats.visceral.level} delta={previous?.visceral ? stats.visceral.value - previous.visceral : null} />}
              {stats.bodyAge && <SummaryCard label="Body Age"     value={stats.bodyAge.value}  unit="yr" level={stats.bodyAge.level}  delta={previous?.body_age ? stats.bodyAge.value - previous.body_age : null} />}
            </div>
          )}
        </section>

        {/* ── Gauges ────────────────────────────────── */}
        {latest && stats && (
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            {stats.fat && (
              <MetricGauge
                title="Body Fat Percentage"
                subtitle={`เทียบกับเกณฑ์ ACE สำหรับเพศ${customer.gender === "male" ? "ชาย" : "หญิง"}`}
                value={stats.fat.value}
                unit="%"
                min={5} max={45}
                markers={customer.gender === "male"
                  ? [{ v: 13, label: "Athletic" }, { v: 17, label: "Fitness" }, { v: 24, label: "Average" }, { v: 29, label: "Obese" }]
                  : [{ v: 20, label: "Athletic" }, { v: 24, label: "Fitness" }, { v: 31, label: "Average" }, { v: 36, label: "Obese" }]}
                level={stats.fat.level}
                sub={`Fat Mass · ${latest.fat_mass} kg`}
              />
            )}
            {stats.muscle && (
              <MetricGauge
                title="Muscle Mass Percentage"
                subtitle="ค่าสูง = มัดกล้ามเนื้อแข็งแรง"
                value={stats.muscle.value}
                unit="%"
                min={20} max={50}
                markers={customer.gender === "male"
                  ? [{ v: 33, label: "Low" }, { v: 40, label: "Normal" }, { v: 44, label: "High" }]
                  : [{ v: 24, label: "Low" }, { v: 31, label: "Normal" }, { v: 35, label: "High" }]}
                level={stats.muscle.level}
                sub={`Muscle Mass · ${latest.muscle_mass} kg`}
                higherIsBetter
              />
            )}
            {stats.bmi && (
              <MetricGauge
                title="BMI"
                subtitle="เกณฑ์ Asian-Pacific (WHO)"
                value={stats.bmi.value}
                unit=""
                min={15} max={40}
                markers={[
                  { v: 18.5, label: "Under" },
                  { v: 23,   label: "Normal" },
                  { v: 25,   label: "Over" },
                  { v: 30,   label: "Obese" },
                ]}
                level={stats.bmi.level}
                sub="WHO Asian standards"
              />
            )}
            {stats.visceral && (
              <MetricGauge
                title="Visceral Fat"
                subtitle="Tanita scale (1–59) · เป้าหมาย ≤ 9"
                value={stats.visceral.value}
                unit=""
                min={1} max={20}
                markers={[{ v: 9, label: "Optimal" }, { v: 12, label: "High" }, { v: 14, label: "Very High" }]}
                level={stats.visceral.level}
                sub="ค่าต่ำกว่า 10 = ปลอดภัย"
              />
            )}
          </section>
        )}

        {/* ── Trend Chart ───────────────────────────── */}
        <section className="mt-6 rounded-3xl border border-ink-10 bg-white p-8">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-40">Progress</div>
              <h2 className="mt-1 font-head text-2xl font-extrabold tracking-tight text-ink">แนวโน้มย้อนหลัง</h2>
            </div>
            <div className="flex gap-2 text-[11px] font-semibold text-ink-60">
              <Legend color="#8C4C4C" label="น้ำหนัก" />
              <Legend color="#DC2626" label="Fat %" />
              <Legend color="#16A34A" label="Muscle %" />
            </div>
          </div>
          <TrendChart measurements={measurements} />
        </section>

        {/* ── Table ─────────────────────────────────── */}
        <section className="mt-6 rounded-3xl border border-ink-10 bg-white p-8">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-40">History</div>
              <h2 className="mt-1 font-head text-2xl font-extrabold tracking-tight text-ink">ประวัติการวัด</h2>
            </div>
          </div>
          <MeasurementTable measurements={measurements} gender={customer.gender} />
        </section>

        {/* ── Footer ───────────────────────────────── */}
        <footer className="mt-12 pb-8 text-center font-mono text-[11px] text-ink-40">
          UPLABS BCA Tracker · v2.0 · Powered by clinical reference standards (ACE · WHO · Tanita)
        </footer>
      </div>

      {/* ── Modal: New Measurement ──────────────────── */}
      {formOpen && (
        <MeasurementForm
          customer={customer}
          onCancel={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </main>
  );
}

/* ────────────────────────────────────────────────── */

function SummaryCard({ label, value, unit, level, delta, deltaInverted }: {
  label: string;
  value: number;
  unit: string;
  level?: import("@/lib/medical-status").StatusLevel;
  delta?: number | null;
  deltaInverted?: boolean;
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

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
