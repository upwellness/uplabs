"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CATEGORY_LABEL, type Category } from "@/lib/records/catalog";

interface LabValue {
  metric_key:      string;
  metric_label_th: string;
  metric_label_en: string;
  value:           string | null;
  value_num:       number | null;
  unit:            string;
  status:          string;
  category:        string;
  recorded_at:     string;
  record_id:       string;
}

const STATUS_COLOR: Record<string, string> = {
  normal:     "#16A34A",
  low:        "#F97316",
  high:       "#DC2626",
  borderline: "#EAB308",
  critical:   "#7F1D1D",
  unknown:    "#64748B",
};

export function LatestLabsCard({ customerId }: { customerId: string }) {
  const [values, setValues] = useState<LabValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCat, setOpenCat] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/customers/${customerId}/lab-values/latest`)
      .then(r => r.json())
      .then(d => setValues(d.values ?? []))
      .finally(() => setLoading(false));
  }, [customerId]);

  // Group by category
  const grouped = new Map<string, LabValue[]>();
  for (const v of values) {
    if (!grouped.has(v.category)) grouped.set(v.category, []);
    grouped.get(v.category)!.push(v);
  }

  const abnormalCount = values.filter((v) => v.status === "low" || v.status === "high" || v.status === "critical").length;

  if (loading) {
    return <div className="h-24 animate-pulse rounded-2xl bg-surface" />;
  }

  if (values.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-10 bg-surface p-6 text-center">
        <div className="text-2xl">🧾</div>
        <p className="mt-2 font-thai text-[13px] text-ink-60">ยังไม่มีระเบียนผลตรวจ</p>
        <Link href={`/customers/${customerId}/records/new`} className="mt-3 inline-block rounded-full bg-rose px-4 py-1.5 text-[12px] font-semibold text-white">
          + เพิ่มผลตรวจ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-thai text-[12px] text-ink-60">
          {values.length} ค่าจาก {grouped.size} หมวด
          {abnormalCount > 0 && <span className="ml-2 font-semibold text-amber-700">· {abnormalCount} ผิดปกติ</span>}
        </p>
        <Link href={`/customers/${customerId}/records`} className="text-[11px] font-semibold text-rose hover:underline">
          ดูทั้งหมด →
        </Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from(grouped.entries()).map(([cat, items]) => {
          const abnormalInCat = items.filter((v) => v.status === "low" || v.status === "high" || v.status === "critical").length;
          const isOpen = openCat === cat;
          return (
            <div key={cat} className={`rounded-2xl border bg-white transition-all ${abnormalInCat > 0 ? "border-amber-300" : "border-ink-10"}`}>
              <button
                onClick={() => setOpenCat(isOpen ? null : cat)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-head text-[13px] font-bold text-ink truncate">
                    {CATEGORY_LABEL[cat as Category] ?? cat}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-ink-40">
                    {items.length} ค่า {abnormalInCat > 0 && <span className="ml-1 text-amber-700">· {abnormalInCat} ผิด</span>}
                  </div>
                </div>
                <span className={`text-ink-40 transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
              </button>

              {isOpen && (
                <div className="border-t border-ink-5 px-4 py-2 max-h-80 overflow-y-auto">
                  {items.map((v) => (
                    <div key={v.metric_key} className="flex items-baseline justify-between gap-3 border-b border-ink-5 py-2 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <div className="font-thai text-[12px] text-ink truncate">{v.metric_label_th || v.metric_key}</div>
                        <Link href={`/customers/${customerId}/records/${v.record_id}`}
                          className="mt-0.5 inline-block font-mono text-[9px] text-ink-40 hover:text-rose">
                          📅 {new Date(v.recorded_at).toLocaleDateString("th-TH")}
                        </Link>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-[13px] font-bold" style={{ color: STATUS_COLOR[v.status] ?? STATUS_COLOR.unknown }}>
                          {v.value ?? "—"} {v.unit && <span className="text-[10px] font-normal text-ink-40">{v.unit}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
