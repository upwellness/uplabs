"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { aggregateDay, macroBreakdown } from "@/lib/nutriscan/macros";

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
const MEAL_LABEL: Record<string, string> = {
  breakfast: "เช้า 🌅", lunch: "กลางวัน ☀️", dinner: "เย็น 🌙", snack: "ของว่าง 🍎",
};

function today() {
  const d = new Date();
  d.setHours(d.getHours() + 7); // approximate Bangkok TZ
  return d.toISOString().slice(0, 10);
}

export function FoodLogClient() {
  const [date,       setDate]       = useState<string>(today());
  const [customerId, setCustomerId] = useState<string>("");
  const [scans,      setScans]      = useState<ScanRow[]>([]);
  const [customers,  setCustomers]  = useState<CustomerOpt[]>([]);
  const [loading,    setLoading]    = useState(true);

  const loadCustomers = async () => {
    try {
      const res = await fetch("/api/customers/list");
      const json = await res.json();
      setCustomers((json.customers ?? []).map((c: any) => ({ id: c.id, name: c.name })));
    } catch {}
  };

  const loadScans = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date, limit: "200" });
      if (customerId) params.set("customer_id", customerId);
      else params.set("customer_id_is_null", "1");  // hint (server ignores for now)
      const res = await fetch(`/api/nutriscan?${params}`);
      const json = await res.json();
      let rows: ScanRow[] = json.scans ?? [];
      if (!customerId) rows = rows.filter((r) => !r.customer_id);
      setScans(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCustomers(); }, []);
  useEffect(() => { loadScans(); }, [date, customerId]);

  const aggregate = useMemo(() => aggregateDay(scans), [scans]);

  const sortedScans = useMemo(() => {
    return [...scans].sort((a, b) => {
      const ma = MEAL_ORDER[a.meal_type ?? ""] ?? 99;
      const mb = MEAL_ORDER[b.meal_type ?? ""] ?? 99;
      if (ma !== mb) return ma - mb;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [scans]);

  const grouped = useMemo(() => {
    const m = new Map<string, ScanRow[]>();
    for (const r of sortedScans) {
      const k = r.meal_type ?? "other";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [sortedScans]);

  return (
    <div className="mt-6 space-y-6">
      {/* Filters */}
      <section className="rounded-3xl border border-ink-10 bg-white p-5">
        <div className="grid gap-3 sm:grid-cols-[200px,1fr,auto] items-end">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">วันที่</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm focus:border-rose focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">Profile</span>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm focus:border-rose focus:outline-none"
            >
              <option value="">👤 ตัวเอง</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>👥 {c.name}</option>
              ))}
            </select>
          </label>
          <Link href="/nutriscan" className="rounded-full bg-rose px-5 py-2.5 font-thai text-[13px] font-semibold text-white hover:bg-rose-mid">
            + บันทึกมื้อใหม่
          </Link>
        </div>
      </section>

      {/* Day summary */}
      <DaySummary aggregate={aggregate} />

      {/* Meals by group */}
      {loading ? (
        <div className="rounded-3xl border border-ink-10 bg-white p-12 text-center font-thai text-sm text-ink-40">
          กำลังโหลด...
        </div>
      ) : sortedScans.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-ink-10 bg-white p-12 text-center">
          <div className="text-4xl mb-3">🍽️</div>
          <div className="font-thai text-[15px] font-semibold text-ink">ยังไม่มีบันทึกในวันนี้</div>
          <div className="mt-1 font-thai text-[12px] text-ink-60">
            ลองบันทึกมื้อแรกที่ <Link href="/nutriscan" className="text-rose underline">/nutriscan</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([meal, rows]) => (
            <MealGroup key={meal} meal={meal} rows={rows} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ──────────────────────────── */

function DaySummary({ aggregate }: { aggregate: ReturnType<typeof aggregateDay> }) {
  const a = aggregate;
  return (
    <section className="rounded-3xl border border-ink-10 bg-white p-6">
      <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">Day total</div>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCell label="Calories" value={a.total_kcal.toLocaleString()} unit="kcal" big />
        <SummaryCell label="มื้อ" value={String(a.count)} unit="มื้อ" />
        <SummaryCell label="Avg Glucose Impact" value={a.avg_glucose_impact ? a.avg_glucose_impact.toFixed(1) : "—"} unit="/ 10" color={a.avg_glucose_impact >= 7 ? "danger" : a.avg_glucose_impact >= 4 ? "warning" : "optimal"} />
        <SummaryCell label="Avg Health Score" value={a.avg_health_score ? a.avg_health_score.toFixed(1) : "—"} unit="/ 10" color={a.avg_health_score >= 7 ? "optimal" : a.avg_health_score >= 4 ? "warning" : "danger"} />
      </div>

      {a.total_kcal > 0 && (
        <>
          <div className="mt-5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">C : P : F (% of energy)</div>
            <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-ink-5">
              <div style={{ width: `${a.carb_pct}%` }} className="bg-rose"></div>
              <div style={{ width: `${a.protein_pct}%` }} className="bg-wellness"></div>
              <div style={{ width: `${a.fat_pct}%` }} className="bg-amber"></div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <MacroSummary label="Carb" g={a.total_carb_g} pct={a.carb_pct} color="rose" />
            <MacroSummary label="Protein" g={a.total_protein_g} pct={a.protein_pct} color="wellness" />
            <MacroSummary label="Fat" g={a.total_fat_g} pct={a.fat_pct} color="amber" />
          </div>

          {a.total_fiber_g > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-science-pale bg-science-ultra px-3 py-2 font-mono text-[11px] text-science">
              <span>🌱</span>
              <span><b>Fiber {a.total_fiber_g}g</b> · ไม่นับใน energy</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function SummaryCell({ label, value, unit, big, color }: {
  label: string; value: string; unit?: string; big?: boolean;
  color?: "optimal" | "warning" | "danger";
}) {
  const textColor = color === "optimal" ? "text-status-optimal"
    : color === "warning" ? "text-status-warning"
    : color === "danger" ? "text-status-danger"
    : "text-ink";
  return (
    <div className="rounded-2xl border border-ink-10 bg-surface px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">{label}</div>
      <div className={`mt-1 font-head font-extrabold ${textColor} ${big ? "text-[28px]" : "text-[22px]"}`}>
        {value}<span className="ml-1 text-[11px] font-normal text-ink-40">{unit}</span>
      </div>
    </div>
  );
}

function MacroSummary({ label, g, pct, color }: { label: string; g: number; pct: number; color: string }) {
  const styles = {
    rose:     { dot: "bg-rose",     text: "text-rose",     bg: "bg-rose-ultra"     },
    wellness: { dot: "bg-wellness", text: "text-wellness", bg: "bg-wellness-ultra" },
    amber:    { dot: "bg-amber",    text: "text-amber",    bg: "bg-amber-ultra"    },
  }[color] ?? { dot: "bg-ink", text: "text-ink", bg: "bg-surface" };
  return (
    <div className={`rounded-xl border border-ink-10 ${styles.bg} px-3 py-2.5`}>
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${styles.dot}`}></span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-60">{label}</span>
        <span className="ml-auto font-mono text-[11px] font-bold text-ink">{pct}%</span>
      </div>
      <div className={`mt-0.5 font-head text-[16px] font-bold ${styles.text}`}>{g}<span className="text-[11px] font-normal text-ink-40">g</span></div>
    </div>
  );
}

function MealGroup({ meal, rows }: { meal: string; rows: ScanRow[] }) {
  const label = MEAL_LABEL[meal] ?? meal;
  const totalKcal = rows.reduce((s, r) => s + (r.calories_estimate ?? 0), 0);
  return (
    <section className="rounded-3xl border border-ink-10 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-head text-[16px] font-extrabold text-ink">{label}</h3>
        <div className="font-mono text-[12px] text-ink-40">{rows.length} มื้อ · {totalKcal} kcal</div>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((r) => <MealCard key={r.id} row={r} />)}
      </div>
    </section>
  );
}

function MealCard({ row }: { row: ScanRow }) {
  const b = macroBreakdown({
    carb_g: row.carb_g ?? 0,
    protein_g: row.protein_g ?? 0,
    fat_g: row.fat_g ?? 0,
  });
  const time = new Date(row.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const gi = row.glucose_impact_score;
  const giColor = (gi ?? 0) >= 7 ? "text-status-danger" : (gi ?? 0) >= 4 ? "text-status-warning" : "text-status-optimal";
  return (
    <div className="rounded-2xl border border-ink-10 bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-thai text-[14px] font-bold text-ink">{row.food_identified ?? "—"}</div>
          <div className="mt-0.5 font-mono text-[10px] text-ink-40">{time}</div>
          {row.notes && (
            <div className="mt-1.5 font-thai text-[11px] italic text-ink-60">"{row.notes}"</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-head text-[18px] font-extrabold text-ink">{row.calories_estimate ?? "—"}<span className="text-[10px] font-normal text-ink-40 ml-0.5">kcal</span></div>
          {gi != null && (
            <div className={`font-mono text-[10px] font-bold ${giColor}`}>GI {gi}/10</div>
          )}
        </div>
      </div>

      {/* Macro mini-bar */}
      {b.total_kcal > 0 && (
        <div className="mt-3">
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-ink-5">
            <div style={{ width: `${b.carb_pct}%` }} className="bg-rose"></div>
            <div style={{ width: `${b.protein_pct}%` }} className="bg-wellness"></div>
            <div style={{ width: `${b.fat_pct}%` }} className="bg-amber"></div>
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
