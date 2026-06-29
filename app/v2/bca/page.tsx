"use client";

/**
 * UP Labs v2 · ★ BCA Tracker (SPEC §7.4)
 * ──────────────────────────────────────
 * Customer picker (or ?customer=<id>) → reuses /api/customers/[id]/360 for customer
 * info (incl. height) and /api/customers/[id]/measurements for the series.
 * Mandatory identity block (§4) incl. height at the top. Measurement form POSTs to
 * /measurements. 6 gauges + trend charts. BMI computed from weight+height; metrics
 * classified via /api/bca/classify.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  Search, Scale, Plus, X, ChevronRight, Save, Loader2, ArrowRight, Users, Calendar,
} from "lucide-react";
import { Shell } from "../_components/Shell";
import { IdentityBlock } from "@/lib/v2/IdentityBlock";
import { Card, LoadingState, EmptyState, ErrorState, MetricGauge } from "@/lib/v2/ui";
import { initials, genderLabel, resolveAge } from "@/lib/v2/identity";
import { statusHex, STATUS_LABEL_TH, type StatusLevel } from "@/lib/medical-status";
import { deriveBMI, deriveChronoAge } from "@/lib/bca-derive";
import { classifyBMI, classifyVisceralFat, classifyBodyFat, classifyMusclePct, classifyBodyAge } from "@/lib/medical-status";
import type { Customer, Measurement } from "@/lib/types";

interface ListRow {
  id: string;
  name: string;
  gender: string | null;
  birth_year: number | null;
  birth_date: string | null;
  height: number | null;
  stats: { bca: number };
}

export default function V2BcaPage() {
  return (
    <Suspense fallback={<Shell breadcrumb={[{ label: "หน้าแรก", href: "/v2" }, { label: "BCA" }]}><Card><LoadingState /></Card></Shell>}>
      <BcaInner />
    </Suspense>
  );
}

function BcaInner() {
  const search = useSearchParams();
  const router = useRouter();
  const customerId = search.get("customer");

  const breadcrumb = [{ label: "หน้าแรก", href: "/v2" }, { label: "ลูกค้า", href: "/v2/customers" }, { label: "BCA" }];

  if (!customerId) {
    return (
      <Shell breadcrumb={breadcrumb}>
        <PickCustomer onPick={(id) => router.push(`/v2/bca?customer=${id}`)} />
      </Shell>
    );
  }
  return (
    <Shell breadcrumb={breadcrumb}>
      <BcaWorkspace customerId={customerId} onChange={(id) => router.push(`/v2/bca?customer=${id}`)} onClear={() => router.push("/v2/bca")} />
    </Shell>
  );
}

/* ─────────────────────────── Customer picker ─────────────────────────── */

function PickCustomer({ onPick }: { onPick: (id: string) => void }) {
  const [rows, setRows] = useState<ListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = () => {
    setError(null);
    setRows(null);
    fetch("/api/customers/list")
      .then((r) => r.json())
      .then((j) => { if (j.error) setError(j.error); else setRows(j.customers ?? []); })
      .catch((e) => setError(e.message ?? "load failed"));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !s || r.name.toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-5 text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-ultra text-rose">
          <Scale size={22} strokeWidth={2} aria-hidden />
        </span>
        <h1 className="mt-3 font-head text-[22px] font-extrabold tracking-tight text-ink">BCA Tracker</h1>
        <p className="mt-1 font-thai text-[13px] text-ink-60">เลือกลูกค้าเพื่อบันทึก/ดูผลองค์ประกอบร่างกาย</p>
      </div>

      <Card className="p-3">
        <div className="relative mb-2">
          <Search size={16} strokeWidth={2.25} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-30" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อลูกค้า…"
            aria-label="ค้นหาชื่อลูกค้า"
            className="w-full rounded-full border border-ink-10 bg-white py-2.5 pl-10 pr-4 text-[14px] outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:ring-2 focus:ring-rose-ultra"
          />
        </div>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !rows ? (
          <LoadingState label="กำลังโหลดรายชื่อ…" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title={q ? "ไม่พบลูกค้า" : "ยังไม่มีลูกค้า"} hint={q ? "ลองเปลี่ยนคำค้น" : undefined} />
        ) : (
          <ul className="max-h-[60vh] divide-y divide-ink-5 overflow-y-auto">
            {filtered.map((r) => {
              const age = resolveAge(r);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onPick(r.id)}
                    className="group flex w-full items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-surface focus:outline-none focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-5 text-[12px] font-bold text-ink-60">{initials(r.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-head text-[14px] font-bold text-ink">{r.name}</span>
                      <span className="block font-thai text-[11px] text-ink-60">
                        {genderLabel(r.gender)} {age != null ? `· ${age} ปี` : ""} {r.height != null ? `· ${r.height} ซม.` : ""} {r.stats?.bca ? `· BCA ${r.stats.bca} ครั้ง` : "· ยังไม่มี BCA"}
                      </span>
                    </span>
                    <ChevronRight size={16} strokeWidth={2.25} className="text-ink-20 group-hover:text-rose" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ─────────────────────────── Workspace ─────────────────────────── */

function BcaWorkspace({ customerId, onChange, onClear }: { customerId: string; onChange: (id: string) => void; onClear: () => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c360, ms] = await Promise.all([
        fetch(`/api/customers/${customerId}/360`).then((r) => r.json()),
        fetch(`/api/customers/${customerId}/measurements`).then((r) => r.json()),
      ]);
      if (c360.error) throw new Error(c360.error);
      if (ms.error) throw new Error(ms.error);
      setCustomer(c360.customer as Customer);
      setMeasurements((ms.measurements ?? []) as Measurement[]);
    } catch (e: any) {
      setError(e.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const latest = measurements[0];

  // Classify latest via the server endpoint (keeps thresholds server-side · SPEC §7.4)
  const [classified, setClassified] = useState<any | null>(null);
  useEffect(() => {
    if (!latest || !customer) { setClassified(null); return; }
    const chrono = deriveChronoAge(customer.birth_date ?? customer.birth_year, latest.recorded_at);
    fetch("/api/bca/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gender: customer.gender, weight: latest.weight, height: customer.height,
        fat_pct: latest.fat_pct, muscle_pct: latest.muscle_pct, visceral: latest.visceral,
        body_age: latest.body_age, chrono_age: chrono,
      }),
    })
      .then((r) => r.json())
      .then((j) => setClassified(j.error ? null : j))
      .catch(() => setClassified(null));
  }, [latest, customer]);

  if (loading) return <Card><LoadingState label="กำลังโหลดข้อมูลลูกค้า…" /></Card>;
  if (error) return <Card><ErrorState message={error} onRetry={load} /></Card>;
  if (!customer) return <Card><EmptyState title="ไม่พบลูกค้า" /></Card>;

  return (
    <div className="space-y-5">
      {/* Header: switch customer */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-ultra text-rose"><Scale size={16} strokeWidth={2} aria-hidden /></span>
          <h1 className="font-head text-[20px] font-extrabold tracking-tight text-ink">BCA Tracker</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/v2/customers/${customerId}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-60 hover:text-rose">
            ดูโปรไฟล์ 360 <ArrowRight size={12} strokeWidth={2.5} aria-hidden />
          </Link>
          <button type="button" onClick={onClear} className="inline-flex items-center gap-1 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink">
            <X size={13} strokeWidth={2.25} aria-hidden /> เปลี่ยนลูกค้า
          </button>
        </div>
      </div>

      {/* ★ Identity block (SPEC §4) — incl. height for BMI */}
      <IdentityBlock customer={customer} editHref={`/customers/${customerId}`} />

      {/* Quick add */}
      <div className="flex items-center justify-between">
        <span className="font-thai text-[13px] text-ink-60">
          {measurements.length > 0 ? `มีผลวัด ${measurements.length} ครั้ง` : "ยังไม่มีผลวัด"}
        </span>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-rose px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-rose-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
        >
          {formOpen ? <X size={15} strokeWidth={2.25} aria-hidden /> : <Plus size={15} strokeWidth={2.25} aria-hidden />}
          {formOpen ? "ปิดฟอร์ม" : "บันทึกค่าใหม่"}
        </button>
      </div>

      {formOpen && (
        <MeasurementForm
          customer={customer}
          onSaved={() => { setFormOpen(false); load(); }}
          onCancel={() => setFormOpen(false)}
        />
      )}

      {/* Gauges + BMI */}
      {latest ? (
        <GaugePanel customer={customer} latest={latest} classified={classified} />
      ) : (
        <Card><EmptyState icon={Scale} title="ยังไม่มีผลวัด BCA" hint="กด “บันทึกค่าใหม่” เพื่อเริ่มบันทึกครั้งแรก" /></Card>
      )}

      {/* Trends */}
      {measurements.length >= 2 && <TrendPanel measurements={measurements} />}
    </div>
  );
}

/* ── Measurement form (inline, clinical-warm) ── */

const todayISO = () => new Date().toISOString().slice(0, 10);

function MeasurementForm({ customer, onSaved, onCancel }: { customer: Customer; onSaved: () => void; onCancel: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState("");
  const [fat, setFat] = useState("");
  const [visceral, setVisceral] = useState("");
  const [muscle, setMuscle] = useState("");
  const [bodyAge, setBodyAge] = useState("");
  const [bmr, setBmr] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const num = (v: string) => (v === "" ? null : Number(v));
  const livePreviewBMI = weight ? deriveBMI(Number(weight), customer.height) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weight) { setErr("กรุณากรอกน้ำหนัก"); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/customers/${customer.id}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recorded_at: new Date(date).toISOString(),
          weight: Number(weight),
          fat_pct: num(fat),
          visceral: num(visceral),
          muscle_pct: num(muscle),
          body_age: num(bodyAge),
          bmr: num(bmr),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ");
      onSaved();
    } catch (e: any) {
      setErr(e.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 lg:p-5">
      <form onSubmit={submit}>
        <div className="mb-3 flex items-center gap-1.5">
          <Calendar size={15} strokeWidth={2.25} className="text-rose" aria-hidden />
          <h2 className="font-head text-[15px] font-bold text-ink">บันทึกค่าการวัด</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <FormField label="วันที่วัด" type="date" value={date} onChange={setDate} full />
          <FormField label="น้ำหนัก (kg)" value={weight} onChange={setWeight} placeholder="65.0" required />
          <FormField label="Body fat %" value={fat} onChange={setFat} placeholder="22.0" />
          <FormField label="Visceral (ระดับ)" value={visceral} onChange={setVisceral} placeholder="6" />
          <FormField label="Muscle %" value={muscle} onChange={setMuscle} placeholder="32.0" />
          <FormField label="Body age (ปี)" value={bodyAge} onChange={setBodyAge} placeholder="32" />
          <FormField label="BMR (kcal)" value={bmr} onChange={setBmr} placeholder="1340" />
        </div>

        {/* Live BMI from weight + height (SPEC §7.4) */}
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-ink-5 bg-surface/60 px-3 py-2 text-[12px]">
          <span className="font-semibold text-ink-60">BMI (คำนวณจากส่วนสูง {customer.height != null ? `${customer.height} ซม.` : "—"})</span>
          {customer.height == null ? (
            <span className="text-status-caution">ต้องมีส่วนสูงก่อนจึงคำนวณ BMI ได้</span>
          ) : livePreviewBMI != null ? (
            <span className="font-mono font-bold text-ink">{livePreviewBMI} <span className="font-semibold" style={{ color: statusHex[classifyBMI(livePreviewBMI)] }}>· {STATUS_LABEL_TH[classifyBMI(livePreviewBMI)]}</span></span>
          ) : (
            <span className="text-ink-40">กรอกน้ำหนักเพื่อดู BMI</span>
          )}
        </div>

        {err && <div className="mt-3 rounded-xl bg-status-bg-danger px-3 py-2 text-[13px] text-status-danger">{err}</div>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full bg-surface px-4 py-2 text-[13px] font-semibold text-ink-60 hover:bg-ink-5">ยกเลิก</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-full bg-rose px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-rose-mid disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
            {saving ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Save size={15} strokeWidth={2.25} aria-hidden />}
            {saving ? "กำลังบันทึก…" : "บันทึกการวัด"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function FormField({ label, value, onChange, placeholder, type = "text", required, full }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; full?: boolean;
}) {
  return (
    <label className={`block ${full ? "col-span-2 sm:col-span-1" : ""}`}>
      <span className="mb-1 block text-[11px] font-semibold text-ink-60">
        {label} {required && <span className="text-rose">*</span>}
      </span>
      <input
        type={type}
        inputMode={type === "text" ? "decimal" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="min-h-[44px] w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] font-medium text-ink outline-none transition-colors placeholder:text-ink-20 focus:border-rose focus:ring-2 focus:ring-rose-ultra"
      />
    </label>
  );
}

/* ── Gauges ── */

function GaugePanel({ customer, latest, classified }: { customer: Customer; latest: Measurement; classified: any | null }) {
  const bmi = deriveBMI(latest.weight, customer.height);
  const chrono = deriveChronoAge(customer.birth_date ?? customer.birth_year, latest.recorded_at);

  // Prefer server classification; fall back to local libs so the panel never blanks.
  const bmiLevel: StatusLevel | null = classified?.bmi?.level ?? (bmi != null ? classifyBMI(bmi) : null);
  const fatLevel: StatusLevel | null = classified?.fat?.level ?? (latest.fat_pct != null && (customer.gender === "male" || customer.gender === "female") ? classifyBodyFat(latest.fat_pct, customer.gender) : null);
  const muscleLevel: StatusLevel | null = classified?.muscle?.level ?? (latest.muscle_pct != null && (customer.gender === "male" || customer.gender === "female") ? classifyMusclePct(latest.muscle_pct, customer.gender) : null);
  const visceralLevel: StatusLevel | null = classified?.visceral?.level ?? (latest.visceral != null ? classifyVisceralFat(latest.visceral) : null);
  const bodyAgeLevel: StatusLevel | null = classified?.body_age?.level ?? (latest.body_age != null && chrono != null ? classifyBodyAge(latest.body_age, chrono) : null);

  const gauges = [
    { label: "BMI", value: clamp(bmi, 15, 40), display: bmi != null ? String(bmi) : "—", unit: "", level: bmiLevel },
    { label: "น้ำหนัก", value: clamp(latest.weight, 40, 120), display: latest.weight != null ? String(latest.weight) : "—", unit: "kg", level: bmiLevel },
    { label: "Body fat", value: pct(latest.fat_pct, 50), display: latest.fat_pct != null ? `${latest.fat_pct}` : "—", unit: "%", level: fatLevel },
    { label: "Muscle", value: pct(latest.muscle_pct, 60), display: latest.muscle_pct != null ? `${latest.muscle_pct}` : "—", unit: "%", level: muscleLevel },
    { label: "Visceral", value: clamp(latest.visceral, 1, 20), display: latest.visceral != null ? String(latest.visceral) : "—", unit: "lv", level: visceralLevel },
    { label: "Body age", value: pct(latest.body_age, 90), display: latest.body_age != null ? String(latest.body_age) : "—", unit: "ปี", level: bodyAgeLevel },
  ];

  return (
    <Card className="p-4 lg:p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-head text-[15px] font-bold text-ink">ผลล่าสุด</h2>
        <span className="font-mono text-[11px] text-ink-40">{new Date(latest.recorded_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</span>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {gauges.map((g) => (
          <div key={g.label}>
            <MetricGauge value={g.value} display={g.display} unit={g.unit} label={g.label} level={g.level ?? "caution"} size={88} />
            {g.level && <div className="mt-0.5 text-center text-[10px] font-semibold" style={{ color: statusHex[g.level] }}>{STATUS_LABEL_TH[g.level]}</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}

function clamp(v: number | null, min: number, max: number): number {
  if (v == null) return 0;
  return Math.max(0, Math.min(1, (v - min) / (max - min)));
}
function pct(v: number | null, max: number): number {
  if (v == null) return 0;
  return Math.max(0, Math.min(1, v / max));
}

/* ── Trends ── */

const TREND_METRICS: { key: keyof Measurement; label: string; color: string; unit: string }[] = [
  { key: "weight", label: "น้ำหนัก (kg)", color: "#8C4C4C", unit: "kg" },
  { key: "fat_pct", label: "Body fat %", color: "#C47A2A", unit: "%" },
  { key: "muscle_pct", label: "Muscle %", color: "#396755", unit: "%" },
  { key: "visceral", label: "Visceral", color: "#2A7B8F", unit: "lv" },
];

function TrendPanel({ measurements }: { measurements: Measurement[] }) {
  const asc = useMemo(() => [...measurements].sort((a, b) => +new Date(a.recorded_at) - +new Date(b.recorded_at)), [measurements]);
  const labelOf = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

  return (
    <Card className="p-4 lg:p-5">
      <h2 className="mb-3 font-head text-[15px] font-bold text-ink">แนวโน้ม</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {TREND_METRICS.map((m) => {
          const points = asc
            .map((x) => ({ date: labelOf(x.recorded_at), value: x[m.key] as number | null }))
            .filter((p) => p.value != null);
          if (points.length < 2) return null;
          return (
            <div key={String(m.key)} className="rounded-xl border border-ink-10 bg-white p-3">
              <div className="mb-1 text-[13px] font-semibold text-ink">{m.label}</div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke="#F2F0F3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8A838E" }} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#8A838E" }} tickLine={false} axisLine={false} width={36} domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #DDD9DF", fontSize: 12 }} labelStyle={{ color: "#5C5660" }} />
                    <Line type="monotone" dataKey="value" stroke={m.color} strokeWidth={2.25} dot={{ r: 2.5, fill: m.color }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
