"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { ProfilePicker } from "./_components/ProfilePicker";
import { GlucoseChart } from "./_components/GlucoseChart";
import { MealForm } from "./_components/MealForm";
import { MealTable } from "./_components/MealTable";
import { ReportBuilder } from "./_components/ReportBuilder";
import { MealAnalyzer } from "./_components/MealAnalyzer";
import { CompareChart } from "./_components/CompareChart";
import { computeStats } from "@/lib/glucose-status";
import { analyzeMeals } from "@/lib/cgm-analyze";
import type { CGMProfile, CGMReading, CGMMeal } from "@/lib/types-cgm";

const PERIODS = [
  { key: 6,    label: "6 ชม.",  h: 6      },
  { key: 12,   label: "12 ชม.", h: 12     },
  { key: 24,   label: "1 วัน",  h: 24     },
  { key: 72,   label: "3 วัน",  h: 72     },
  { key: 168,  label: "7 วัน",  h: 168    },
  { key: 336,  label: "14 วัน", h: 336    },
  { key: 9999, label: "ทั้งหมด", h: null  },
] as const;

type PeriodKey = typeof PERIODS[number]["key"];

export default function CGMPage() {
  const [profile,    setProfile]    = useState<CGMProfile | null>(null);
  const [readings,   setReadings]   = useState<CGMReading[]>([]);
  const [meals,      setMeals]      = useState<CGMMeal[]>([]);
  const [period,     setPeriod]     = useState<PeriodKey>(24);
  const [formOpen,   setFormOpen]   = useState(false);
  const [editing,    setEditing]    = useState<CGMMeal | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const loadData = useCallback(async (p: CGMProfile, pKey: PeriodKey) => {
    setLoading(true);
    setError(null);
    try {
      const def = PERIODS.find((x) => x.key === pKey);
      const qs  = def?.h ? `?from=${Date.now() - def.h * 60 * 60 * 1000}` : "";
      const res = await fetch(`/api/cgm/profiles/${encodeURIComponent(p.name)}${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "โหลดข้อมูลไม่สำเร็จ");
      setReadings(json.readings ?? []);
      setMeals(json.meals ?? []);
    } catch (e: any) {
      setError(e.message);
      setReadings([]); setMeals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectProfile = useCallback((p: CGMProfile) => {
    setProfile(p);
    loadData(p, period);
  }, [period, loadData]);

  // Reload when period changes
  useEffect(() => {
    if (profile) loadData(profile, period);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const stats = useMemo(() => computeStats(readings), [readings]);

  const analyzedMeals = useMemo(() => analyzeMeals(readings, meals)
    .sort((a, b) => b.meal_timestamp - a.meal_timestamp), [readings, meals]);

  const [compareIds, setCompareIds] = useState<Set<number>>(new Set());
  const toggleCompare = useCallback((id: number) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 6) next.add(id);
      return next;
    });
  }, []);
  const comparingMeals = useMemo(
    () => analyzedMeals.filter((m) => m.valid && compareIds.has(m.id)),
    [analyzedMeals, compareIds],
  );

  const currentPeriodLabel = PERIODS.find((p) => p.key === period)?.label ?? "";

  const handleMealSubmit = useCallback(async (data: { meal_timestamp: number; description: string; carbs: number | null; protein: number | null; fat: number | null }) => {
    if (!profile) return;
    try {
      if (editing) {
        const res = await fetch(`/api/cgm/meals/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "แก้ไขไม่สำเร็จ");
        setMeals((prev) => prev.map((m) => (m.id === editing.id ? json.meal : m))
          .sort((a, b) => a.meal_timestamp - b.meal_timestamp));
      } else {
        const res = await fetch(`/api/cgm/profiles/${encodeURIComponent(profile.name)}/meals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ");
        setMeals((prev) => [...prev, json.meal].sort((a, b) => a.meal_timestamp - b.meal_timestamp));
      }
      setFormOpen(false);
      setEditing(null);
    } catch (e: any) {
      alert(e.message);
    }
  }, [profile, editing]);

  const handleEdit = useCallback((m: CGMMeal) => {
    setEditing(m);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback(async (m: CGMMeal) => {
    try {
      const res = await fetch(`/api/cgm/meals/${m.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ลบไม่สำเร็จ");
      setMeals((prev) => prev.filter((x) => x.id !== m.id));
    } catch (e: any) {
      alert(e.message);
    }
  }, []);

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-10">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-ink-40 hover:text-ink transition-colors text-sm">← Hub</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-rose">CGM Analyzer</span>
          </div>
          <ProfilePicker current={profile} onChange={handleSelectProfile} />
        </div>
      </header>

      <div className="mx-auto max-w-content px-10 py-10">

        {!profile && (
          <section className="flex flex-col items-center justify-center py-40 text-center">
            <div className="mb-4 text-5xl">📈</div>
            <h2 className="font-head text-2xl font-extrabold text-ink">เลือก Profile เพื่อเริ่มต้น</h2>
            <p className="mt-3 font-thai text-sm text-ink-60">คลิก "เลือก Profile" ที่มุมขวาบน</p>
          </section>
        )}

        {profile && (
          <section className="rounded-3xl border border-ink-10 bg-white p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Profile</div>
                <h1 className="mt-2 font-head text-[32px] font-extrabold tracking-tight text-ink">{profile.name}</h1>
                <div className="mt-2 flex items-center gap-5 font-thai text-sm text-ink-60">
                  <span>{profile.readings_count.toLocaleString()} total readings</span>
                  <span className="h-1 w-1 rounded-full bg-ink-20" />
                  {loading ? <span className="animate-pulse text-ink-40">กำลังโหลด...</span> : <span>{readings.length.toLocaleString()} ในช่วง {currentPeriodLabel}</span>}
                </div>
                {error && <p className="mt-2 text-xs text-status-warning">{error}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setReportOpen(true)} disabled={readings.length === 0}>
                  📄 สร้างรายงาน
                </Button>
                <Button variant="rose" onClick={() => { setEditing(null); setFormOpen(true); }}>
                  + บันทึกมื้ออาหาร
                </Button>
              </div>
            </div>

            {/* Period filter */}
            <div className="mt-6 flex flex-wrap gap-1.5">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`rounded-full border px-3.5 py-1 text-[11px] font-semibold transition-all ${
                    period === p.key
                      ? "border-rose bg-rose text-white"
                      : "border-ink-10 bg-white text-ink-60 hover:border-ink-20"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Stats */}
            {stats && (
              <div className="mt-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
                <StatCard label="Time in Range" value={`${stats.tir}%`}     hint="70-110 mg/dL" color="#16A34A" />
                <StatCard label="ค่าเฉลี่ย"   value={`${stats.avg}`}      hint="mg/dL" />
                <StatCard label="GMI"          value={`${stats.gmi}%`}     hint="est. HbA1c" color="#9333EA" />
                <StatCard label="Std Dev"      value={`${stats.stdDev}`}   hint="variability" />
              </div>
            )}
          </section>
        )}

        {/* Chart */}
        {profile && (
          <section className="mt-6 rounded-3xl border border-ink-10 bg-white p-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-40">Glucose Trace</div>
                <h2 className="mt-1 font-head text-2xl font-extrabold tracking-tight text-ink">กราฟระดับน้ำตาล</h2>
              </div>
              <div className="flex gap-4 text-[11px] font-medium text-ink-60">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#14B8A6" }} />
                  Glucose
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-3 rounded-sm" style={{ background: "#10B981", opacity: 0.25 }} />
                  Optimal 70-110
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#FB7185" }} />
                  มื้ออาหาร
                </span>
              </div>
            </div>
            {loading ? (
              <div className="h-96 animate-pulse rounded-2xl bg-surface" />
            ) : (
              <GlucoseChart readings={readings} meals={meals} height={380} />
            )}
          </section>
        )}

        {/* Compare chart (when 1+ meal selected) */}
        {profile && comparingMeals.length > 0 && (
          <section className="mt-6 rounded-3xl border border-ink-10 bg-white p-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-40">Comparison</div>
                <h2 className="mt-1 font-head text-2xl font-extrabold tracking-tight text-ink">
                  เปรียบเทียบการตอบสนอง (0-3 ชม.)
                </h2>
                <p className="mt-1 font-thai text-[12px] text-ink-40">เลือก {comparingMeals.length} มื้อ · กด checkbox ที่การ์ดเพื่อเพิ่ม/ลบ</p>
              </div>
              <button
                onClick={() => setCompareIds(new Set())}
                className="rounded-full border border-ink-10 px-3 py-1 text-[11px] font-semibold text-ink-60 hover:border-ink-20"
              >
                ล้างการเลือก
              </button>
            </div>
            <CompareChart meals={comparingMeals} />
          </section>
        )}

        {/* Meal Analyzer cards */}
        {profile && analyzedMeals.length > 0 && (
          <section className="mt-6 rounded-3xl border border-ink-10 bg-white p-8">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-40">Meal Response Analysis</div>
                <h2 className="mt-1 font-head text-2xl font-extrabold tracking-tight text-ink">
                  วิเคราะห์การตอบสนองแต่ละมื้อ
                </h2>
                <p className="mt-1 font-thai text-[12px] text-ink-40">
                  Peak · Lag · Δ Delta · +1h / +2h / +3h · curve shape · grade
                </p>
              </div>
            </div>
            <MealAnalyzer meals={analyzedMeals} selected={compareIds} onToggleSelect={toggleCompare} />
          </section>
        )}

        {/* Meal Log (raw table) */}
        {profile && (
          <section className="mt-6 rounded-3xl border border-ink-10 bg-white p-8">
            <div className="mb-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-40">Meal Log</div>
              <h2 className="mt-1 font-head text-2xl font-extrabold tracking-tight text-ink">รายการมื้อ (Edit / Delete)</h2>
            </div>
            <MealTable meals={meals} onEdit={handleEdit} onDelete={handleDelete} />
          </section>
        )}

        <footer className="mt-12 pb-8 text-center font-mono text-[11px] text-ink-40">
          UPLABS CGM Analyzer · v2.0 · ADA reference ranges · GMI per ADA formula
        </footer>
      </div>

      {formOpen && profile && (
        <MealForm
          profileName={profile.name}
          initial={editing ?? undefined}
          onCancel={() => { setFormOpen(false); setEditing(null); }}
          onSubmit={handleMealSubmit}
        />
      )}

      {reportOpen && profile && (
        <ReportBuilder
          profile={profile}
          readings={readings}
          meals={meals}
          stats={stats}
          periodLabel={currentPeriodLabel}
          onClose={() => setReportOpen(false)}
        />
      )}
    </main>
  );
}

function StatCard({ label, value, hint, color }: { label: string; value: string; hint: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-ink-10 bg-white px-5 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-40">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <div className="font-head text-[28px] font-extrabold leading-none tracking-tight" style={{ color: color ?? "#1F1A1B" }}>{value}</div>
      </div>
      <div className="mt-1 font-mono text-[10px] text-ink-40">{hint}</div>
    </div>
  );
}
