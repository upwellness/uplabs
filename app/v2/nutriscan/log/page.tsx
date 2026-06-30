"use client";

/**
 * UP Labs v2 · Food Log (SPEC §7.9)
 * ──────────────────────────────────
 * Daily food diary for self or a customer. GET /api/nutriscan?date&customer_id → group by
 * meal, day totals (C:P:F + % energy + avg glucose/health). Optional ?customer=<id> prefill.
 *
 * Reuse (no contract change):
 *   - API:   GET /api/nutriscan (date + customer_id filters — same as v1 FoodLogClient)
 *   - calc:  aggregateDay + macroBreakdown (lib/nutriscan/macros)
 *   - chart: CPFPie (lazy via next/dynamic)
 *
 * Clinical-warm: lib/v2/ui primitives, Lucide icons, status TEXT via statusTextHex,
 * empty/loading/error states, ≥44px touch, keyboard-accessible.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  CalendarDays, Plus, Sunrise, Sun, Moon, Apple, UtensilsCrossed, Loader2, Leaf,
} from "lucide-react";
import { Shell } from "../../_components/Shell";
import { Card, SectionLabel, LoadingState, EmptyState, ErrorState, IconChip } from "@/lib/v2/ui";
import { aggregateDay, macroBreakdown } from "@/lib/nutriscan/macros";
import { statusTextHex, type StatusLevel } from "@/lib/v2/status";

const CPFPie = dynamic(() => import("@/components/CPFPie").then((m) => m.CPFPie), {
  ssr: false,
  loading: () => <div className="flex h-[190px] w-[190px] items-center justify-center"><Loader2 size={22} className="animate-spin text-rose" aria-hidden /></div>,
});

interface CustomerOpt { id: string; name: string }

interface ScanRow {
  id: string;
  food_identified: string | null;
  meal_type: string | null;
  calories_estimate: number | null;
  carb_g: number | null;
  protein_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  glucose_impact_score: number | null;
  health_score: number | null;
  created_at: string;
  customer_id: string | null;
  notes: string | null;
}

const MEAL_ORDER: Record<string, number> = { breakfast: 1, lunch: 2, dinner: 3, snack: 4 };
const MEAL_META: Record<string, { label: string; icon: typeof Sun }> = {
  breakfast: { label: "เช้า", icon: Sunrise },
  lunch: { label: "กลางวัน", icon: Sun },
  dinner: { label: "เย็น", icon: Moon },
  snack: { label: "ของว่าง", icon: Apple },
  other: { label: "อื่นๆ", icon: UtensilsCrossed },
};

/** Today in Asia/Bangkok (UTC+7) as yyyy-mm-dd. */
function today() {
  const d = new Date();
  d.setHours(d.getHours() + 7);
  return d.toISOString().slice(0, 10);
}
function healthLevel(score: number): StatusLevel { return score >= 7 ? "optimal" : score >= 4 ? "caution" : "danger"; }
function glucoseLevel(score: number): StatusLevel { return score >= 7 ? "danger" : score >= 4 ? "caution" : "optimal"; }

export default function V2FoodLogPage() {
  return (
    <Suspense
      fallback={
        <Shell breadcrumb={[{ label: "หน้าแรก", href: "/v2" }, { label: "NutriScan", href: "/v2/nutriscan" }, { label: "บันทึกรายวัน" }]}>
          <Card><LoadingState /></Card>
        </Shell>
      }
    >
      <FoodLogInner />
    </Suspense>
  );
}

function FoodLogInner() {
  const search = useSearchParams();
  const presetCustomer = search.get("customer") ?? "";

  const [date, setDate] = useState<string>(today());
  const [customerId, setCustomerId] = useState<string>(presetCustomer);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/customers/list");
      const json = await res.json();
      setCustomers((json.customers ?? []).map((c: any) => ({ id: c.id, name: c.name })));
    } catch { /* non-fatal */ }
  }, []);

  const loadScans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ date, limit: "200" });
      if (customerId) params.set("customer_id", customerId);
      const res = await fetch(`/api/nutriscan?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "โหลดบันทึกไม่สำเร็จ");
      let rows: ScanRow[] = json.scans ?? [];
      // "ตัวเอง" = scans with no customer_id (server returns all this user's scans for the day).
      if (!customerId) rows = rows.filter((r) => !r.customer_id);
      setScans(rows);
    } catch (e: any) {
      setError(e.message ?? "โหลดบันทึกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [date, customerId]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { loadScans(); }, [loadScans]);
  useEffect(() => { setCustomerId(presetCustomer); }, [presetCustomer]);

  const aggregate = useMemo(() => aggregateDay(scans), [scans]);

  const grouped = useMemo(() => {
    const sorted = [...scans].sort((a, b) => {
      const ma = MEAL_ORDER[a.meal_type ?? ""] ?? 99;
      const mb = MEAL_ORDER[b.meal_type ?? ""] ?? 99;
      if (ma !== mb) return ma - mb;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    const m = new Map<string, ScanRow[]>();
    for (const r of sorted) {
      const k = r.meal_type ?? "other";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [scans]);

  const selectedName = customers.find((c) => c.id === customerId)?.name;

  return (
    <Shell breadcrumb={[{ label: "หน้าแรก", href: "/v2" }, { label: "NutriScan", href: "/v2/nutriscan" }, { label: "บันทึกรายวัน" }]}>
      {/* Page header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconChip icon={CalendarDays} tone="rose" size={20} className="mt-0.5 h-10 w-10" />
          <div>
            <h1 className="font-head text-[23px] font-extrabold tracking-tight text-ink">บันทึกอาหารรายวัน</h1>
            <p className="mt-1 max-w-2xl font-thai text-[13px] leading-[1.6] text-ink-60">
              ดูว่ากินอะไรไปในวันหนึ่ง — macros · สัดส่วนพลังงาน · glucose impact ของ{selectedName ? <> {selectedName}</> : <>ตัวเอง</>}
            </p>
          </div>
        </div>
        <Link
          href="/v2/nutriscan"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-rose-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
        >
          <Plus size={15} strokeWidth={2.25} aria-hidden /> บันทึกมื้อใหม่
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-5 p-4">
        <div className="grid items-end gap-3 sm:grid-cols-[200px,1fr]">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-ink-60">วันที่</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-rose focus:ring-2 focus:ring-rose-ultra"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-ink-60">โปรไฟล์</span>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-rose focus:ring-2 focus:ring-rose-ultra"
            >
              <option value="">ตัวเอง</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
      </Card>

      {error ? (
        <Card><ErrorState message={error} onRetry={loadScans} /></Card>
      ) : (
        <div className="space-y-5">
          {/* Day summary */}
          <DaySummary aggregate={aggregate} loading={loading} />

          {/* Meals */}
          {loading ? (
            <Card><LoadingState label="กำลังโหลดบันทึก…" /></Card>
          ) : scans.length === 0 ? (
            <Card>
              <EmptyState
                icon={UtensilsCrossed}
                title="ยังไม่มีบันทึกในวันนี้"
                hint="บันทึกมื้อแรกของวันด้วย NutriScan แล้วมาดูสรุปที่นี่"
                action={
                  <Link href="/v2/nutriscan" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-mid">
                    <Plus size={15} strokeWidth={2.25} aria-hidden /> ไปบันทึกมื้อแรก
                  </Link>
                }
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {Array.from(grouped.entries()).map(([meal, rows]) => <MealGroup key={meal} meal={meal} rows={rows} />)}
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

/* ───────────────────────── Sub-components ───────────────────────── */

function DaySummary({ aggregate: a, loading }: { aggregate: ReturnType<typeof aggregateDay>; loading: boolean }) {
  return (
    <Card className="p-4 lg:p-5">
      <SectionLabel>รวมทั้งวัน</SectionLabel>
      <div className="mt-4 grid items-start gap-6 sm:grid-cols-[200px,1fr]">
        <div className="flex justify-center">
          {loading ? (
            <div className="flex h-[190px] w-[190px] items-center justify-center"><Loader2 size={22} className="animate-spin text-rose" aria-hidden /></div>
          ) : (
            <CPFPie carb_pct={a.carb_pct} protein_pct={a.protein_pct} fat_pct={a.fat_pct} total_kcal={a.total_kcal} size={190} />
          )}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <SummaryCell label="จำนวนมื้อ" value={String(a.count)} unit="มื้อ" />
            <SummaryCell label="Glucose เฉลี่ย" value={a.avg_glucose_impact ? a.avg_glucose_impact.toFixed(1) : "—"} unit="/10" level={a.avg_glucose_impact ? glucoseLevel(a.avg_glucose_impact) : undefined} />
            <SummaryCell label="Health เฉลี่ย" value={a.avg_health_score ? a.avg_health_score.toFixed(1) : "—"} unit="/10" level={a.avg_health_score ? healthLevel(a.avg_health_score) : undefined} />
          </div>
          {a.total_kcal > 0 && (
            <div className="space-y-2">
              <MacroSummaryRow label="คาร์โบไฮเดรต (Carb)" g={a.total_carb_g} pct={a.carb_pct} color="rose" />
              <MacroSummaryRow label="โปรตีน (Protein)" g={a.total_protein_g} pct={a.protein_pct} color="wellness" />
              <MacroSummaryRow label="ไขมัน (Fat)" g={a.total_fat_g} pct={a.fat_pct} color="amber" />
            </div>
          )}
          {a.total_fiber_g > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-science-pale bg-science-ultra px-3 py-2 font-mono text-[11px] text-science">
              <Leaf size={13} strokeWidth={2.25} aria-hidden />
              <span><b>ไฟเบอร์ {a.total_fiber_g}g</b> · ไม่นับในพลังงาน</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function SummaryCell({ label, value, unit, level }: { label: string; value: string; unit?: string; level?: StatusLevel }) {
  return (
    <div className="rounded-xl border border-ink-10 bg-surface px-3 py-2.5 text-center">
      <div className="text-[10px] font-semibold text-ink-60">{label}</div>
      <div className="mt-1 font-head text-[18px] font-extrabold" style={{ color: level ? statusTextHex[level] : "#18151A" }}>
        {value}<span className="ml-0.5 text-[10px] font-normal text-ink-40">{unit}</span>
      </div>
    </div>
  );
}

function MacroSummaryRow({ label, g, pct, color }: { label: string; g: number; pct: number; color: "rose" | "wellness" | "amber" }) {
  const dot = { rose: "bg-rose", wellness: "bg-wellness", amber: "bg-amber" }[color];
  const text = { rose: "text-rose", wellness: "text-wellness", amber: "text-amber" }[color];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-10 bg-surface px-3 py-2">
      <span className={`h-3 w-3 shrink-0 rounded-full ${dot}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-thai text-[12px] font-semibold text-ink">{label}</div>
        <div className="font-mono text-[10px] text-ink-40">{pct}% ของพลังงาน</div>
      </div>
      <div className={`font-head text-[18px] font-bold ${text}`}>
        {g}<span className="ml-0.5 text-[10px] font-normal text-ink-40">g</span>
      </div>
    </div>
  );
}

function MealGroup({ meal, rows }: { meal: string; rows: ScanRow[] }) {
  const meta = MEAL_META[meal] ?? MEAL_META.other;
  const totalKcal = rows.reduce((s, r) => s + (r.calories_estimate ?? 0), 0);
  return (
    <Card className="p-4 lg:p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconChip icon={meta.icon} tone="rose" size={15} className="h-7 w-7" />
          <h2 className="font-head text-[15px] font-bold text-ink">{meta.label}</h2>
        </div>
        <div className="font-mono text-[11px] text-ink-60">{rows.length} มื้อ · {totalKcal} kcal</div>
      </div>
      <div className="mt-3 space-y-2.5">
        {rows.map((r) => <MealCard key={r.id} row={r} />)}
      </div>
    </Card>
  );
}

function MealCard({ row }: { row: ScanRow }) {
  const b = macroBreakdown({ carb_g: row.carb_g ?? 0, protein_g: row.protein_g ?? 0, fat_g: row.fat_g ?? 0 });
  const time = new Date(row.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const gi = row.glucose_impact_score;
  return (
    <div className="rounded-xl border border-ink-10 bg-surface px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-thai text-[14px] font-bold text-ink">{row.food_identified ?? "—"}</div>
          <div className="mt-0.5 font-mono text-[10px] text-ink-40">{time}</div>
          {row.notes && <div className="mt-1.5 font-thai text-[11px] italic text-ink-60">“{row.notes}”</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-head text-[18px] font-extrabold text-ink">
            {row.calories_estimate ?? "—"}<span className="ml-0.5 text-[10px] font-normal text-ink-40">kcal</span>
          </div>
          {gi != null && <div className="font-mono text-[10px] font-bold" style={{ color: statusTextHex[glucoseLevel(gi)] }}>GI {gi}/10</div>}
        </div>
      </div>

      {b.total_kcal > 0 && (
        <div className="mt-3">
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-ink-5" aria-hidden>
            <div style={{ width: `${b.carb_pct}%` }} className="bg-rose" />
            <div style={{ width: `${b.protein_pct}%` }} className="bg-wellness" />
            <div style={{ width: `${b.fat_pct}%` }} className="bg-amber" />
          </div>
          <div className="mt-1 grid grid-cols-3 gap-2 font-mono text-[10px]">
            <span className="text-rose">C {row.carb_g}g <span className="text-ink-40">({b.carb_pct}%)</span></span>
            <span className="text-wellness">P {row.protein_g}g <span className="text-ink-40">({b.protein_pct}%)</span></span>
            <span className="text-amber">F {row.fat_g}g <span className="text-ink-40">({b.fat_pct}%)</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
