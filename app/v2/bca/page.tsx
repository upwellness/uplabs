"use client";

/**
 * UP Labs v2 · ★ BCA Tracker (SPEC §7.4)
 * ──────────────────────────────────────
 * Customer picker (or ?customer=<id>) → reuses /api/customers/[id]/360 for customer
 * info (incl. height) and /api/customers/[id]/measurements for the series.
 * Mandatory identity block (§4) incl. height at the top. Measurement form POSTs to
 * /measurements. 6 gauges + trend charts. BMI computed from weight+height; metrics
 * classified via /api/bca/classify.
 *
 * Parity with v1 /bca (SPEC §7.4): measurement HISTORY table/card-list · EDIT
 * (PATCH /api/measurements/[id]) · DELETE (DELETE /api/measurements/[id]) · report
 * builder (reuses the v1 ReportBuilder, lazy-loaded so its recharts/html-to-image
 * deps stay out of this route's First-Load JS).
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Search, Scale, Plus, X, ChevronRight, Save, Loader2, ArrowRight, Users, Calendar,
  FileText, Pencil, Trash2, History, Sparkles,
} from "lucide-react";
import { Shell } from "../_components/Shell";
import { IdentityBlock } from "@/lib/v2/IdentityBlock";
import { Card, LoadingState, EmptyState, ErrorState, MetricGauge } from "@/lib/v2/ui";
import { initials, genderLabelWithGlyph, resolveAge } from "@/lib/v2/identity";
import { statusHex, STATUS_LABEL_TH, type StatusLevel } from "@/lib/medical-status";
import { statusTextHex } from "@/lib/v2/status";
import { deriveBMI, deriveChronoAge, enrichMeasurement } from "@/lib/bca-derive";
import { classifyBMI, classifyVisceralFat, classifyBodyFat, classifyMusclePct, classifyBodyAge } from "@/lib/medical-status";
import type { Customer, Measurement, MeasurementWithDerived } from "@/lib/types";
import { buildScanData, type ScanRevealData } from "./_scan-data";

/**
 * Trends (recharts) + ReportBuilder (recharts + html-to-image) are loaded on demand
 * (SPEC §8 "กราฟ lazy/conditional"). Trends only renders with ≥2 points; the report
 * only mounts when the user opens it — so neither pulls its heavy deps into the
 * route's First-Load JS.
 */
const TrendPanel = dynamic(() => import("./_trends").then((m) => m.TrendPanel), {
  ssr: false,
  loading: () => <Card className="p-4 lg:p-5"><LoadingState label="กำลังโหลดกราฟแนวโน้ม…" /></Card>,
});
const ReportBuilder = dynamic(() => import("@/app/bca/_components/ReportBuilder").then((m) => m.ReportBuilder), {
  ssr: false,
  loading: () => null,
});
// Cinematic body-scan reveal (self-contained ~40KB HTML in an iframe). Lazy so
// it stays out of this route's First-Load JS until a scan is actually shown.
const BcaScanReveal = dynamic(() => import("./_scan-reveal").then((m) => m.BcaScanReveal), {
  ssr: false,
  loading: () => null,
});

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
                    className="group flex min-h-[44px] w-full items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-surface focus:outline-none focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-5 text-[12px] font-bold text-ink-60">{initials(r.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-head text-[14px] font-bold text-ink">{r.name}</span>
                      <span className="block font-thai text-[11px] text-ink-60">
                        {genderLabelWithGlyph(r.gender)} {age != null ? `· ${age} ปี` : ""} {r.height != null ? `· ${r.height} ซม.` : ""} {r.stats?.bca ? `· BCA ${r.stats.bca} ครั้ง` : "· ยังไม่มี BCA"}
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
  const [editing, setEditing] = useState<Measurement | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportFocus, setReportFocus] = useState<MeasurementWithDerived | null>(null);
  const [reveal, setReveal] = useState<ScanRevealData | null>(null);
  const revealAfterSave = useRef(false);

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

  // Sorted newest-first + enriched (bmi / fat-mass / muscle-mass / chrono-age) for
  // the history table, gauges and the report builder.
  const enriched = useMemo<MeasurementWithDerived[]>(() => {
    if (!customer) return [];
    return [...measurements]
      .sort((a, b) => +new Date(b.recorded_at) - +new Date(a.recorded_at))
      .map((m) => enrichMeasurement(m, customer));
  }, [measurements, customer]);

  const latest = enriched[0];

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

  // After a NEW measurement is saved and the series refetches, auto-play the scan.
  useEffect(() => {
    if (revealAfterSave.current && customer && enriched.length > 0) {
      revealAfterSave.current = false;
      setReveal(buildScanData(customer, enriched));
    }
  }, [enriched, customer]);

  const handleEdit = (m: MeasurementWithDerived) => {
    setEditing(m);
    setFormOpen(true);
  };

  const handleDelete = async (m: MeasurementWithDerived) => {
    if (!confirm(`ยืนยันการลบผลวัดวันที่ ${new Date(m.recorded_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}?`)) return;
    try {
      const res = await fetch(`/api/measurements/${m.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "ลบไม่สำเร็จ");
      await load();
    } catch (e: any) {
      alert(e.message ?? "ลบไม่สำเร็จ");
    }
  };

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
          <Link href={`/v2/customers/${customerId}`} className="inline-flex min-h-[44px] items-center gap-1 text-[12px] font-semibold text-ink-60 hover:text-rose">
            ดูโปรไฟล์ 360 <ArrowRight size={12} strokeWidth={2.5} aria-hidden />
          </Link>
          <button type="button" onClick={onClear} className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink">
            <X size={13} strokeWidth={2.25} aria-hidden /> เปลี่ยนลูกค้า
          </button>
        </div>
      </div>

      {/* ★ Identity block (SPEC §4) — incl. height for BMI */}
      <IdentityBlock customer={customer} editHref={`/customers/${customerId}`} />

      {/* Quick actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-thai text-[13px] text-ink-60">
          {measurements.length > 0 ? `มีผลวัด ${measurements.length} ครั้ง` : "ยังไม่มีผลวัด"}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => { if (latest) setReveal(buildScanData(customer, enriched)); }}
            disabled={measurements.length === 0}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-2 text-[13px] font-semibold text-ink-80 transition-colors hover:border-wellness hover:text-wellness disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2"
          >
            <Sparkles size={15} strokeWidth={2.25} aria-hidden /> ดูผลแบบสแกน
          </button>
          <button
            type="button"
            onClick={() => { setReportFocus(null); setReportOpen(true); }}
            disabled={measurements.length === 0}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-2 text-[13px] font-semibold text-ink-80 transition-colors hover:border-rose hover:text-rose disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            <FileText size={15} strokeWidth={2.25} aria-hidden /> สร้างรายงาน
          </button>
          <button
            type="button"
            onClick={() => { setEditing(null); setFormOpen((v) => !v); }}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-rose-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            {formOpen && !editing ? <X size={15} strokeWidth={2.25} aria-hidden /> : <Plus size={15} strokeWidth={2.25} aria-hidden />}
            {formOpen && !editing ? "ปิดฟอร์ม" : "บันทึกค่าใหม่"}
          </button>
        </div>
      </div>

      {formOpen && (
        <MeasurementForm
          customer={customer}
          initial={editing ?? undefined}
          onSaved={() => { const created = !editing; setFormOpen(false); setEditing(null); if (created) revealAfterSave.current = true; load(); }}
          onCancel={() => { setFormOpen(false); setEditing(null); }}
        />
      )}

      {/* Gauges + BMI */}
      {latest ? (
        <GaugePanel customer={customer} latest={latest} classified={classified} />
      ) : (
        <Card><EmptyState icon={Scale} title="ยังไม่มีผลวัด BCA" hint="กด “บันทึกค่าใหม่” เพื่อเริ่มบันทึกครั้งแรก" /></Card>
      )}

      {/* Trends (lazy) */}
      {enriched.length >= 2 && <TrendPanel measurements={enriched} />}

      {/* History (table desktop · card list mobile) */}
      {enriched.length > 0 && (
        <HistoryPanel
          measurements={enriched}
          gender={customer.gender}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Report builder (reuses v1 component · lazy-loaded) */}
      {reportOpen && (
        <ReportBuilder
          customer={customer}
          measurements={enriched}
          highlight={reportFocus}
          onClose={() => { setReportOpen(false); setReportFocus(null); }}
        />
      )}

      {/* ★ Cinematic body-scan reveal — auto-plays after a new save · replay via "ดูผลแบบสแกน" */}
      {reveal && <BcaScanReveal data={reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}

/* ── Measurement form (inline, clinical-warm) — handles create (POST) + edit (PATCH) ── */

const todayISO = () => new Date().toISOString().slice(0, 10);
const toDateInput = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : todayISO());

function MeasurementForm({ customer, initial, onSaved, onCancel }: { customer: Customer; initial?: Partial<Measurement>; onSaved: () => void; onCancel: () => void }) {
  const isEdit = Boolean(initial?.id);
  const [date, setDate] = useState(toDateInput(initial?.recorded_at));
  const [weight, setWeight] = useState(initial?.weight != null ? String(initial.weight) : "");
  const [fat, setFat] = useState(initial?.fat_pct != null ? String(initial.fat_pct) : "");
  const [visceral, setVisceral] = useState(initial?.visceral != null ? String(initial.visceral) : "");
  const [muscle, setMuscle] = useState(initial?.muscle_pct != null ? String(initial.muscle_pct) : "");
  const [bodyAge, setBodyAge] = useState(initial?.body_age != null ? String(initial.body_age) : "");
  const [bmr, setBmr] = useState(initial?.bmr != null ? String(initial.bmr) : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const num = (v: string) => (v === "" ? null : Number(v));
  const livePreviewBMI = weight ? deriveBMI(Number(weight), customer.height) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weight) { setErr("กรุณากรอกน้ำหนัก"); return; }
    setSaving(true); setErr(null);
    const payload = {
      recorded_at: new Date(date).toISOString(),
      weight: Number(weight),
      fat_pct: num(fat),
      visceral: num(visceral),
      muscle_pct: num(muscle),
      body_age: num(bodyAge),
      bmr: num(bmr),
    };
    try {
      const res = isEdit
        ? await fetch(`/api/measurements/${initial!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/customers/${customer.id}/measurements`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
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
          <h2 className="font-head text-[15px] font-bold text-ink">{isEdit ? "แก้ไขค่าการวัด" : "บันทึกค่าการวัด"}</h2>
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
            <span className="font-mono font-bold text-ink">{livePreviewBMI} <span className="font-semibold" style={{ color: statusTextHex[classifyBMI(livePreviewBMI)] }}>· {STATUS_LABEL_TH[classifyBMI(livePreviewBMI)]}</span></span>
          ) : (
            <span className="text-ink-60">กรอกน้ำหนักเพื่อดู BMI</span>
          )}
        </div>

        {err && <div className="mt-3 rounded-xl bg-status-bg-danger px-3 py-2 text-[13px] text-status-danger">{err}</div>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="min-h-[44px] rounded-full bg-surface px-4 py-2 text-[13px] font-semibold text-ink-60 hover:bg-ink-5">ยกเลิก</button>
          <button type="submit" disabled={saving} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-rose-mid disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
            {saving ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Save size={15} strokeWidth={2.25} aria-hidden />}
            {saving ? "กำลังบันทึก…" : isEdit ? "บันทึกการแก้ไข" : "บันทึกการวัด"}
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
        className="min-h-[44px] w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] font-medium text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:ring-2 focus:ring-rose-ultra"
      />
    </label>
  );
}

/* ── Gauges ── */

function GaugePanel({ customer, latest, classified }: { customer: Customer; latest: MeasurementWithDerived; classified: any | null }) {
  const bmi = latest.bmi ?? deriveBMI(latest.weight, customer.height);
  const chrono = latest.chrono_age ?? deriveChronoAge(customer.birth_date ?? customer.birth_year, latest.recorded_at);
  const knownGender = customer.gender === "male" || customer.gender === "female";

  // Prefer server classification; fall back to local libs so the panel never blanks.
  const bmiLevel: StatusLevel | null = classified?.bmi?.level ?? (bmi != null ? classifyBMI(bmi) : null);
  const fatLevel: StatusLevel | null = classified?.fat?.level ?? (latest.fat_pct != null && knownGender ? classifyBodyFat(latest.fat_pct, customer.gender, chrono ?? undefined) : null);
  const muscleLevel: StatusLevel | null = classified?.muscle?.level ?? (latest.muscle_pct != null && knownGender ? classifyMusclePct(latest.muscle_pct, customer.gender) : null);
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
        <span className="font-mono text-[11px] text-ink-60">{new Date(latest.recorded_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</span>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {gauges.map((g) => (
          <div key={g.label}>
            <MetricGauge value={g.value} display={g.display} unit={g.unit} label={g.label} level={g.level ?? "caution"} size={88} />
            {g.level && <div className="mt-0.5 text-center text-[10px] font-semibold" style={{ color: statusTextHex[g.level] }}>{STATUS_LABEL_TH[g.level]}</div>}
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

/* ── History (parity with v1 · table desktop / card list mobile · edit + delete) ── */

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
const numOr = (v: number | null, digits = 1, suffix = "") => (v != null ? `${v.toFixed(digits)}${suffix}` : "—");

function HistoryPanel({ measurements, gender, onEdit, onDelete }: {
  measurements: MeasurementWithDerived[];
  gender: string | null;
  onEdit: (m: MeasurementWithDerived) => void;
  onDelete: (m: MeasurementWithDerived) => void;
}) {
  const knownGender = gender === "male" || gender === "female";
  return (
    <Card className="p-4 lg:p-5">
      <div className="mb-3 flex items-center gap-1.5">
        <History size={15} strokeWidth={2.25} className="text-rose" aria-hidden />
        <h2 className="font-head text-[15px] font-bold text-ink">ประวัติการวัด</h2>
        <span className="ml-auto font-mono text-[10px] text-ink-60">ใหม่ → เก่า</span>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-ink-10 text-left text-[11px] font-semibold text-ink-60">
              <th className="px-3 py-2">วันที่</th>
              <th className="px-3 py-2 text-right">น้ำหนัก</th>
              <th className="px-3 py-2 text-right">BMI</th>
              <th className="px-3 py-2 text-right">Fat %</th>
              <th className="px-3 py-2 text-right">Muscle %</th>
              <th className="px-3 py-2 text-right">Visceral</th>
              <th className="px-3 py-2 text-right">Body age</th>
              <th className="px-3 py-2 text-right">BMR</th>
              <th className="px-3 py-2 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-5">
            {measurements.map((m) => (
              <tr key={m.id} className="hover:bg-surface/60">
                <td className="px-3 py-2.5 font-thai text-ink">{fmtDay(m.recorded_at)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-ink">{numOr(m.weight, 1)} <span className="text-ink-60">kg</span></td>
                <ColoredCell value={m.bmi} level={m.bmi != null ? classifyBMI(m.bmi) : null} />
                <ColoredCell value={m.fat_pct} level={m.fat_pct != null && knownGender ? classifyBodyFat(m.fat_pct, gender as any, m.chrono_age ?? undefined) : null} suffix="%" />
                <ColoredCell value={m.muscle_pct} level={m.muscle_pct != null && knownGender ? classifyMusclePct(m.muscle_pct, gender as any) : null} suffix="%" />
                <ColoredCell value={m.visceral} level={m.visceral != null ? classifyVisceralFat(m.visceral) : null} digits={0} />
                <td className="px-3 py-2.5 text-right font-mono text-ink">{numOr(m.body_age, 0)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-ink">{numOr(m.bmr, 0)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <RowActions m={m} onEdit={onEdit} onDelete={onDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <ul className="space-y-2.5 sm:hidden">
        {measurements.map((m) => (
          <li key={m.id} className="rounded-xl border border-ink-10 bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="font-thai text-[13px] font-bold text-ink">{fmtDay(m.recorded_at)}</span>
              <RowActions m={m} onEdit={onEdit} onDelete={onDelete} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[12px]">
              <MiniStat label="นน." value={numOr(m.weight, 1)} unit="kg" />
              <MiniStat label="BMI" value={numOr(m.bmi, 1)} level={m.bmi != null ? classifyBMI(m.bmi) : null} />
              <MiniStat label="Fat" value={numOr(m.fat_pct, 1)} unit="%" level={m.fat_pct != null && knownGender ? classifyBodyFat(m.fat_pct, gender as any, m.chrono_age ?? undefined) : null} />
              <MiniStat label="Muscle" value={numOr(m.muscle_pct, 1)} unit="%" level={m.muscle_pct != null && knownGender ? classifyMusclePct(m.muscle_pct, gender as any) : null} />
              <MiniStat label="Visceral" value={numOr(m.visceral, 0)} level={m.visceral != null ? classifyVisceralFat(m.visceral) : null} />
              <MiniStat label="Body age" value={numOr(m.body_age, 0)} unit="ปี" />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function RowActions({ m, onEdit, onDelete }: { m: MeasurementWithDerived; onEdit: (m: MeasurementWithDerived) => void; onDelete: (m: MeasurementWithDerived) => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => onEdit(m)}
        aria-label={`แก้ไขผลวัดวันที่ ${fmtDay(m.recorded_at)}`}
        className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-lg text-rose transition-colors hover:bg-rose-ultra focus:outline-none focus-visible:ring-2 focus-visible:ring-rose"
      >
        <Pencil size={15} strokeWidth={2.25} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onDelete(m)}
        aria-label={`ลบผลวัดวันที่ ${fmtDay(m.recorded_at)}`}
        className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-lg text-status-danger transition-colors hover:bg-status-bg-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-status-danger"
      >
        <Trash2 size={15} strokeWidth={2.25} aria-hidden />
      </button>
    </span>
  );
}

function ColoredCell({ value, level, suffix = "", digits = 1 }: { value: number | null; level: StatusLevel | null; suffix?: string; digits?: number }) {
  return (
    <td className="px-3 py-2.5 text-right font-mono">
      <span style={{ color: level ? statusTextHex[level] : "#5C5660", fontWeight: level ? 700 : 400 }}>
        {numOr(value, digits, suffix)}
      </span>
    </td>
  );
}

function MiniStat({ label, value, unit, level }: { label: string; value: string; unit?: string; level?: StatusLevel | null }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-ink-60">{label}</div>
      <div className="font-bold" style={{ color: level ? statusTextHex[level] : "#18151A" }}>
        {value}{unit && value !== "—" && <span className="ml-0.5 font-normal text-ink-60">{unit}</span>}
      </div>
    </div>
  );
}
