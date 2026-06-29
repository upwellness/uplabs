"use client";

/**
 * UP Labs v2 · Labs + Trends tabs (Customer 360, SPEC §7.5)
 * ────────────────────────────────────────────────────────
 * Reuses the existing lab-values APIs:
 *   - /api/customers/[id]/lab-values/latest  → latest value per metric
 *   - /api/customers/[id]/lab-values/series  → full time-series for charts
 * Clinical-warm: value + ref range + status dot. Charts via recharts with token colors.
 */

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceArea, CartesianGrid,
} from "recharts";
import { FlaskConical } from "lucide-react";
import { LoadingState, EmptyState, ErrorState } from "@/lib/v2/ui";
import { classifyMetric } from "@/lib/v2/labs";
import { statusClasses, statusHex, STATUS_LABEL_TH, type StatusLevel } from "@/lib/medical-status";

interface LabValue {
  metric_key: string;
  metric_label_th: string | null;
  metric_label_en: string | null;
  value: string | null;
  value_num: number | null;
  unit: string | null;
  status: string | null;
  category: string | null;
  recorded_at: string;
  ref_low?: number | null;
  ref_high?: number | null;
  ref_text?: string | null;
}

const CAT_LABEL: Record<string, string> = {
  lipid: "ไขมัน (Lipid)",
  glucose: "น้ำตาล (Glucose)",
  liver: "ตับ (Liver)",
  kidney: "ไต (Kidney)",
  inflammation: "การอักเสบ (Inflammation)",
  cbc: "ความสมบูรณ์เม็ดเลือด (CBC)",
  other: "อื่นๆ",
};

function metricLabel(v: { metric_label_th: string | null; metric_label_en: string | null; metric_key: string }): string {
  return v.metric_label_th || v.metric_label_en || v.metric_key.toUpperCase();
}

function refText(v: LabValue): string | null {
  if (v.ref_text) return v.ref_text;
  if (v.ref_low != null && v.ref_high != null) return `${v.ref_low}–${v.ref_high}`;
  if (v.ref_high != null) return `< ${v.ref_high}`;
  if (v.ref_low != null) return `> ${v.ref_low}`;
  return null;
}

/** Best-effort status level: prefer our classifier, fall back to stored string status. */
function levelOf(v: LabValue, chronoAge: number | null): StatusLevel | null {
  if (v.value_num != null) {
    const lv = classifyMetric(v.metric_key, v.value_num, { chronoAge });
    if (lv) return lv;
  }
  const s = (v.status || "").toLowerCase();
  if (s === "optimal" || s === "good" || s === "caution" || s === "warning" || s === "danger") return s as StatusLevel;
  if (s === "normal") return "optimal";
  if (s === "high" || s === "low") return "caution";
  return null;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

/* ── Labs tab ── */
export function LabsTab({ customerId, chronoAge }: { customerId: string; chronoAge: number | null }) {
  const [values, setValues] = useState<LabValue[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setValues(null);
    fetch(`/api/customers/${customerId}/lab-values/latest`)
      .then((r) => r.json())
      .then((j) => { if (j.error) setError(j.error); else setValues(j.values ?? []); })
      .catch((e) => setError(e.message ?? "load failed"));
  };
  useEffect(load, [customerId]);

  const byCategory = useMemo(() => {
    const map = new Map<string, LabValue[]>();
    for (const v of values ?? []) {
      const cat = v.category || "other";
      const arr = map.get(cat) ?? [];
      arr.push(v);
      map.set(cat, arr);
    }
    return Array.from(map.entries());
  }, [values]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!values) return <LoadingState label="กำลังโหลดผลแล็บ…" />;
  if (values.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="ยังไม่มีผลแล็บ"
        hint="เพิ่มผลตรวจได้จากปุ่ม “เพิ่มผลตรวจ” ด้านบน — v2 อ่านผลชุดเดียวกับเวอร์ชันปัจจุบัน"
      />
    );
  }

  return (
    <div className="space-y-5">
      {byCategory.map(([cat, items]) => (
        <div key={cat}>
          <div className="mb-2 text-[12px] font-semibold text-ink-60">{CAT_LABEL[cat] ?? cat}</div>
          <div className="overflow-hidden rounded-xl border border-ink-10">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-surface text-left text-[11px] font-semibold text-ink-40">
                  <th className="px-3 py-2">รายการ</th>
                  <th className="px-3 py-2">ค่า</th>
                  <th className="hidden px-3 py-2 sm:table-cell">ช่วงอ้างอิง</th>
                  <th className="px-3 py-2">สถานะ</th>
                  <th className="hidden px-3 py-2 md:table-cell">วันที่</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-5">
                {items.map((v, i) => {
                  const lv = levelOf(v, chronoAge);
                  return (
                    <tr key={i} className="hover:bg-surface/60">
                      <td className="px-3 py-2 font-medium text-ink">{metricLabel(v)}</td>
                      <td className="px-3 py-2 font-mono text-ink-80">
                        {v.value ?? v.value_num ?? "—"} {v.unit && <span className="text-ink-40">{v.unit}</span>}
                      </td>
                      <td className="hidden px-3 py-2 font-mono text-[12px] text-ink-40 sm:table-cell">{refText(v) ?? "—"}</td>
                      <td className="px-3 py-2">
                        {lv ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses.bg[lv]} ${statusClasses.text[lv]}`}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusHex[lv] }} aria-hidden />
                            {STATUS_LABEL_TH[lv]}
                          </span>
                        ) : (
                          <span className="text-ink-30">—</span>
                        )}
                      </td>
                      <td className="hidden px-3 py-2 font-mono text-[11px] text-ink-40 md:table-cell">{fmtDate(v.recorded_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Trends tab ── */
export function TrendsTab({ customerId, chronoAge }: { customerId: string; chronoAge: number | null }) {
  const [values, setValues] = useState<LabValue[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setValues(null);
    fetch(`/api/customers/${customerId}/lab-values/series`)
      .then((r) => r.json())
      .then((j) => { if (j.error) setError(j.error); else setValues(j.values ?? []); })
      .catch((e) => setError(e.message ?? "load failed"));
  };
  useEffect(load, [customerId]);

  const series = useMemo(() => {
    const map = new Map<string, { v: LabValue; points: { date: string; value: number }[] }>();
    for (const row of values ?? []) {
      if (row.value_num == null) continue;
      const cur = map.get(row.metric_key) ?? { v: row, points: [] };
      cur.points.push({ date: fmtDate(row.recorded_at), value: row.value_num });
      cur.v = row; // keep latest meta (rows asc → last wins)
      map.set(row.metric_key, cur);
    }
    return Array.from(map.values()).filter((s) => s.points.length >= 2);
  }, [values]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!values) return <LoadingState label="กำลังโหลดแนวโน้ม…" />;
  if (series.length === 0) {
    return (
      <EmptyState
        title="ยังไม่พอสำหรับกราฟแนวโน้ม"
        hint="ต้องมีผลแล็บอย่างน้อย 2 ครั้งต่อรายการ จึงจะเห็นแนวโน้ม"
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {series.map(({ v, points }) => {
        const lv = levelOf(v, chronoAge);
        const color = lv ? statusHex[lv] : "#2A7B8F";
        return (
          <div key={v.metric_key} className="rounded-xl border border-ink-10 bg-white p-3">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[13px] font-semibold text-ink">{metricLabel(v)}</span>
              <span className="font-mono text-[11px] text-ink-40">{v.unit ?? ""}</span>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="#F2F0F3" vertical={false} />
                  {v.ref_low != null && v.ref_high != null && (
                    <ReferenceArea y1={v.ref_low} y2={v.ref_high} fill="#16A34A" fillOpacity={0.06} />
                  )}
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8A838E" }} tickLine={false} axisLine={{ stroke: "#DDD9DF" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#8A838E" }} tickLine={false} axisLine={false} width={36} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #DDD9DF", fontSize: 12 }}
                    labelStyle={{ color: "#5C5660" }}
                  />
                  <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.25} dot={{ r: 2.5, fill: color }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {refText(v) && <div className="mt-1 font-mono text-[10px] text-ink-40">ช่วงอ้างอิง {refText(v)}</div>}
          </div>
        );
      })}
    </div>
  );
}
