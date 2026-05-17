"use client";

/**
 * LabTrendCharts — แสดงกราฟแนวโน้มผลเลือดของ customer
 * ─────────────────────────────────────────────────────
 * Pattern follows app/bca/_components/TrendCharts.tsx (monotone smooth · tight Y · 2-col paired)
 * แต่ scale-up เพราะมี metric เยอะ → group by category + select 1 category at a time
 *
 * Data flow:
 *   /api/customers/{id}/lab-values/series → all values asc by recorded_at
 *   → group by category → group by metric_key → only keep numeric metrics with ≥2 points
 *   → category chips at top · charts (2-col) in selected category
 *
 * Each chart:
 *   - Line in status color (from latest value)
 *   - Reference band (green) for ref_low..ref_high (if numeric range)
 *   - Reference dashed lines for one-sided refs (e.g. LDL ref_high only)
 *   - Trend line (linear regression) in gray
 *   - Tight Y-domain (~12% padding of data range)
 */

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, ReferenceLine, ReferenceArea,
  XAxis, YAxis, Tooltip, CartesianGrid, LabelList, Legend,
} from "recharts";
import { CATEGORY_LABEL, type Category } from "@/lib/records/catalog";

interface LabValue {
  metric_key:      string;
  metric_label_th: string | null;
  metric_label_en: string | null;
  value:           string | null;
  value_num:       number | null;
  unit:            string | null;
  status:          string | null;   // normal / low / high / borderline / critical / unknown
  category:        string;
  recorded_at:     string;
  ref_low:         number | null;
  ref_high:        number | null;
  ref_text:        string | null;
  record_id:       string;
}

const PERIODS = [
  { key: 90,    label: "3 เดือน" },
  { key: 180,   label: "6 เดือน" },
  { key: 365,   label: "1 ปี" },
  { key: 1095,  label: "3 ปี" },
  { key: 9999,  label: "ทั้งหมด" },
] as const;
type PeriodKey = typeof PERIODS[number]["key"];

const STATUS_COLOR: Record<string, string> = {
  normal:     "#16A34A",
  low:        "#F97316",
  high:       "#DC2626",
  borderline: "#EAB308",
  critical:   "#7F1D1D",
  unknown:    "#64748B",
};

const TREND_COLOR = "#9CA3AF";
const REF_BAND_FILL   = "#16A34A";  // green band for normal range
const REF_LINE_COLOR  = "#16A34A";

const TOOLTIP_STYLE = {
  background: "#18151A",
  border: "none",
  borderRadius: 10,
  color: "white",
  fontSize: 12,
  fontFamily: "var(--font-jetbrains, monospace)",
};

/* ── helpers ───────────────────────────────────────── */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function linearRegression(values: (number | null)[]): (number | null)[] {
  const clean = values.map((v, i) => ({ x: i, y: v })).filter((p) => p.y != null) as { x: number; y: number }[];
  const n = clean.length;
  if (n < 2) return values.map(() => null);
  const sumX  = clean.reduce((a, p) => a + p.x, 0);
  const sumY  = clean.reduce((a, p) => a + p.y, 0);
  const sumXY = clean.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = clean.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) {
    const mean = sumY / n;
    return values.map(() => +mean.toFixed(2));
  }
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return values.map((_, i) => +(slope * i + intercept).toFixed(2));
}

function tightDomain(values: (number | null | undefined)[], opts?: { floor?: number; ref_low?: number; ref_high?: number }): [number, number] {
  const clean = values.filter((v): v is number => v != null && !isNaN(v));
  if (clean.length === 0) return [0, 1];
  // Include ref range in domain calc so reference band/lines are visible
  const all = [...clean];
  if (opts?.ref_low  != null) all.push(opts.ref_low);
  if (opts?.ref_high != null) all.push(opts.ref_high);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || Math.abs(max) * 0.2 || 1;
  const pad = Math.max(range * 0.12, 0.5);
  const lo = opts?.floor != null ? Math.max(opts.floor, min - pad) : min - pad;
  const hi = max + pad;
  return [+lo.toFixed(2), +hi.toFixed(2)];
}

const labelFmt = (v: any) => {
  if (v == null || v === 0) return "";
  const n = Number(v);
  if (isNaN(n)) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
};

/* ── component ─────────────────────────────────────── */

export function LabTrendCharts({ customerId }: { customerId: string }) {
  const [values, setValues]   = useState<LabValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState<PeriodKey>(365);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/customers/${customerId}/lab-values/series`)
      .then((r) => r.json())
      .then((d) => setValues(d.values ?? []))
      .finally(() => setLoading(false));
  }, [customerId]);

  /* ── filter by period ── */
  const filtered = useMemo(() => {
    if (period === 9999) return values;
    const cutoff = Date.now() - period * 24 * 60 * 60 * 1000;
    return values.filter((v) => new Date(v.recorded_at).getTime() >= cutoff);
  }, [values, period]);

  /* ── group: category → metric_key → series ── */
  const byCategory = useMemo(() => {
    const map = new Map<string, Map<string, LabValue[]>>();
    for (const v of filtered) {
      if (v.value_num == null) continue; // numeric only
      if (!map.has(v.category)) map.set(v.category, new Map());
      const inner = map.get(v.category)!;
      if (!inner.has(v.metric_key)) inner.set(v.metric_key, []);
      inner.get(v.metric_key)!.push(v);
    }
    // keep only metrics with ≥2 datapoints
    const filteredMap = new Map<string, Map<string, LabValue[]>>();
    for (const [cat, metrics] of map.entries()) {
      const kept = new Map<string, LabValue[]>();
      for (const [mk, series] of metrics.entries()) {
        if (series.length >= 2) kept.set(mk, series);
      }
      if (kept.size > 0) filteredMap.set(cat, kept);
    }
    return filteredMap;
  }, [filtered]);

  const catKeys = Array.from(byCategory.keys());

  // Auto-select first category when data first loads (or period changes wipes out current)
  useEffect(() => {
    if (catKeys.length === 0) {
      setActiveCat(null);
    } else if (!activeCat || !byCategory.has(activeCat)) {
      setActiveCat(catKeys[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catKeys.join("|")]);

  if (loading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-surface" />;
  }

  if (values.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-10 bg-surface p-6 text-center">
        <div className="text-2xl">📈</div>
        <p className="mt-2 font-thai text-[13px] text-ink-60">ยังไม่มีผลตรวจในระบบ · ต้องมีอย่างน้อย 2 รอบเพื่อแสดงกราฟแนวโน้ม</p>
      </div>
    );
  }

  const activeMetrics = activeCat ? byCategory.get(activeCat) : null;

  return (
    <div>
      {/* Period filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
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

      {/* Category chips */}
      {catKeys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-10 bg-surface p-6 text-center">
          <p className="font-thai text-[13px] text-ink-60">ไม่มีหมวดที่มีข้อมูล ≥ 2 จุดในช่วงนี้</p>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-1.5 border-b border-ink-5 pb-4">
            {catKeys.map((cat) => {
              const count = byCategory.get(cat)!.size;
              const active = cat === activeCat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-ink-10 bg-white text-ink-60 hover:border-ink-20"
                  }`}
                >
                  {CATEGORY_LABEL[cat as Category] ?? cat}
                  <span className={`ml-1.5 font-mono text-[9px] ${active ? "text-white/70" : "text-ink-40"}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Charts in selected category */}
          {activeMetrics && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {Array.from(activeMetrics.entries()).map(([mk, series], i, arr) => {
                const isOrphan = arr.length % 2 === 1 && i === arr.length - 1;
                return (
                  <div key={mk} className={isOrphan ? "lg:col-span-2" : ""}>
                    <MetricChart series={series} />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── single metric chart ───────────────────────────── */

function MetricChart({ series }: { series: LabValue[] }) {
  const head = series[series.length - 1];  // latest (series asc)
  const label = head.metric_label_th || head.metric_label_en || head.metric_key;
  const unit  = head.unit ?? "";
  const ref_low  = head.ref_low  ?? null;
  const ref_high = head.ref_high ?? null;

  // Build chart rows
  const rows = series.map((v) => ({
    date:  fmtDate(v.recorded_at),
    value: v.value_num,
    raw:   v.value,
    status: v.status,
  }));
  const trend = linearRegression(rows.map((r) => r.value));
  const data = rows.map((r, i) => ({ ...r, trend: trend[i] }));

  const lineColor = STATUS_COLOR[head.status ?? "unknown"] ?? STATUS_COLOR.unknown;
  const domain = tightDomain(rows.map((r) => r.value), {
    ref_low:  ref_low  ?? undefined,
    ref_high: ref_high ?? undefined,
  });

  // Format latest value chip
  const latestText = head.value_num != null
    ? Number.isInteger(head.value_num) ? String(head.value_num) : head.value_num.toFixed(2).replace(/\.?0+$/, "")
    : (head.value ?? "—");

  // Ref text for footer
  let refText = "";
  if (ref_low != null && ref_high != null) refText = `${ref_low} – ${ref_high}`;
  else if (ref_low != null)                refText = `≥ ${ref_low}`;
  else if (ref_high != null)               refText = `≤ ${ref_high}`;

  return (
    <div className="rounded-2xl border border-ink-10 bg-white p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-thai text-[14px] font-bold text-ink truncate">{label}</div>
          {refText && (
            <div className="mt-0.5 font-mono text-[10px] text-ink-40">
              เกณฑ์ปกติ {refText} {unit}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="font-mono text-[16px] font-extrabold leading-none" style={{ color: lineColor }}>
            {latestText}
          </div>
          {unit && <div className="mt-0.5 font-mono text-[9px] text-ink-40">{unit}</div>}
        </div>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 24, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="#F2F0F3" strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#8A838E" fontSize={10} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
            <YAxis stroke="#8A838E" fontSize={10} tickLine={false} axisLine={false} domain={domain} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "rgba(255,255,255,0.6)", marginBottom: 4 }}
              formatter={(val: any) => [val, label]}
            />

            {/* Reference range (green band) */}
            {ref_low != null && ref_high != null && (
              <ReferenceArea
                y1={ref_low} y2={ref_high}
                fill={REF_BAND_FILL} fillOpacity={0.06}
                stroke={REF_BAND_FILL} strokeOpacity={0.25} strokeDasharray="2 4"
                ifOverflow="extendDomain"
              />
            )}
            {/* One-sided ref lines */}
            {ref_low != null && ref_high == null && (
              <ReferenceLine y={ref_low} stroke={REF_LINE_COLOR} strokeDasharray="4 4" strokeOpacity={0.4}
                label={{ value: `≥ ${ref_low}`, position: "right", fontSize: 9, fill: REF_LINE_COLOR }} />
            )}
            {ref_high != null && ref_low == null && (
              <ReferenceLine y={ref_high} stroke={REF_LINE_COLOR} strokeDasharray="4 4" strokeOpacity={0.4}
                label={{ value: `≤ ${ref_high}`, position: "right", fontSize: 9, fill: REF_LINE_COLOR }} />
            )}

            {/* Trend (regression) */}
            <Line type="monotone" dataKey="trend" name="แนวโน้ม"
              stroke={TREND_COLOR} strokeWidth={1} strokeDasharray="5 5"
              dot={false} isAnimationActive={false} legendType="none" />

            {/* Actual values */}
            <Line type="monotone" dataKey="value" name={label}
              stroke={lineColor} strokeWidth={2.5}
              dot={{ r: 4, fill: lineColor, strokeWidth: 0 }} activeDot={{ r: 6 }}
              connectNulls legendType="none">
              <LabelList dataKey="value" position="top" formatter={labelFmt} fontSize={10} fill={lineColor} />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
