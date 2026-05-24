"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SafetyEntry {
  product_key:              string;
  product_th:               string | null;
  product_en:               string | null;
  sku_id:                   string | null;
  status:                   string;
  conflicting_ingredients:  string[] | null;
  reason:                   string | null;
  alternative_product:      string | null;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: string; label: string }> = {
  safe:        { bg: "liquid-info",     text: "#14532D", icon: "✅", label: "Approved Stack" },
  caution:     { bg: "liquid-watch",    text: "#92400E", icon: "🟡", label: "ใช้ระวัง" },
  reduce_freq: { bg: "liquid-watch",    text: "#92400E", icon: "🟠", label: "ลดความถี่" },
  avoid:       { bg: "liquid-critical", text: "#991B1B", icon: "🔴", label: "หลีกเลี่ยง" },
};

export function SupplementsTab({ customerId }: { customerId: string }) {
  const [items, setItems] = useState<SafetyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/customers/${customerId}/allergies`)
      .then(r => r.json())
      .then(d => setItems(d.safety ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) return <div className="h-32 animate-pulse rounded-2xl liquid" />;

  if (items.length === 0) {
    return (
      <div className="liquid rounded-2xl p-8 text-center border-dashed">
        <div className="text-2xl">💊</div>
        <p className="mt-2 font-thai text-[13px] text-ink-60">ยังไม่มี supplement mapping</p>
        <p className="mt-1 font-mono text-[10px] text-ink-40">เพิ่ม allergy test → ระบบจะ generate stack ตามผล</p>
        <Link href={`/customers/${customerId}/allergies/new`} className="mt-3 inline-block rounded-full bg-rose px-4 py-1.5 text-[12px] font-semibold text-white">
          + เพิ่ม Allergy Test
        </Link>
      </div>
    );
  }

  const grouped: Record<string, SafetyEntry[]> = {
    safe:        items.filter(i => i.status === "safe"),
    caution:     items.filter(i => i.status === "caution"),
    reduce_freq: items.filter(i => i.status === "reduce_freq"),
    avoid:       items.filter(i => i.status === "avoid"),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-[11px] font-mono">
        <span className="rounded-full bg-green-100 text-green-700 px-2.5 py-0.5">✅ Safe {grouped.safe.length}</span>
        <span className="rounded-full bg-amber-100 text-amber-700 px-2.5 py-0.5">🟡 Caution {grouped.caution.length}</span>
        <span className="rounded-full bg-orange-100 text-orange-700 px-2.5 py-0.5">🟠 Reduce {grouped.reduce_freq.length}</span>
        <span className="rounded-full bg-red-100 text-red-700 px-2.5 py-0.5">🔴 Avoid {grouped.avoid.length}</span>
      </div>

      {(["safe", "caution", "reduce_freq", "avoid"] as const).map(status => {
        const list = grouped[status];
        if (list.length === 0) return null;
        const s = STATUS_STYLE[status];
        return (
          <div key={status}>
            <div className={`mb-2 inline-flex items-center gap-2 rounded-full ${s.bg} px-3 py-1 text-[11px] font-bold tracking-wider`}>
              <span style={{ color: s.text }}>{s.icon} {s.label}</span>
              <span className="font-mono opacity-60" style={{ color: s.text }}>· {list.length}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map(item => (
                <div key={item.product_key} className="liquid rounded-xl p-3">
                  <div className="font-thai text-[13px] font-semibold text-ink">{item.product_th}</div>
                  <div className="font-mono text-[10px] text-ink-40">{item.product_en} · {item.sku_id}</div>
                  {item.conflicting_ingredients && item.conflicting_ingredients.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.conflicting_ingredients.map(ing => (
                        <span key={ing} className="rounded-full bg-red-50 text-red-700 px-2 py-0.5 text-[10px] font-mono">⚠ {ing}</span>
                      ))}
                    </div>
                  )}
                  {item.reason && <p className="mt-1.5 text-[11px] text-ink-60 leading-relaxed">{item.reason}</p>}
                  {item.alternative_product && (
                    <div className="mt-1.5 text-[10px] font-thai text-green-700 bg-green-50 rounded px-2 py-1">
                      💡 ทางเลือก: {item.alternative_product}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
