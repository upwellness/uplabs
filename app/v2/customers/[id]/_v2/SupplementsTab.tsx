"use client";

/**
 * UP Labs v2 · Supplements tab (Customer 360, SPEC §7.5)
 * ──────────────────────────────────────────────────────
 * Reuses the existing allergy API: GET /api/customers/[id]/allergies → `.safety`
 * (Nutrilite supplement-safety mapping). The 360 payload's `supplementSafety`
 * omits reason / alternative_product / conflict_severity, so we fetch the full
 * record here. Grouped by status with avoid-first ordering so the clearest
 * warnings sit at the top. Clinical-warm · one status system.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pill, AlertTriangle, ArrowDownRight, ShieldQuestion, CheckCircle2, Lightbulb, PlusCircle } from "lucide-react";
import { LoadingState, ErrorState, EmptyState } from "@/lib/v2/ui";
import { statusTextClass } from "@/lib/v2/status";
import { statusHex, STATUS_LABEL_TH, type StatusLevel } from "@/lib/medical-status";

interface SafetyEntry {
  product_key: string;
  product_th: string | null;
  product_en: string | null;
  sku_id: string | null;
  status: string; // 'safe' | 'caution' | 'reduce_freq' | 'avoid'
  conflicting_ingredients: string[] | null;
  conflict_severity: string[] | null;
  reason: string | null;
  alternative_product: string | null;
  verified_at?: string;
}

type SafetyStatus = "avoid" | "reduce_freq" | "caution" | "safe";

/** Each supplement-safety status maps onto the single v2 status token scale. */
const STATUS_META: Record<SafetyStatus, { level: StatusLevel; label: string; icon: typeof AlertTriangle }> = {
  avoid:       { level: "danger",  label: "ควรหลีกเลี่ยง",  icon: AlertTriangle },
  reduce_freq: { level: "warning", label: "ลดความถี่ลง",    icon: ArrowDownRight },
  caution:     { level: "caution", label: "ใช้อย่างระวัง",   icon: ShieldQuestion },
  safe:        { level: "optimal", label: "ใช้ได้ตามปกติ",   icon: CheckCircle2 },
};
const ORDER: SafetyStatus[] = ["avoid", "reduce_freq", "caution", "safe"];

export function SupplementsTab({ customerId }: { customerId: string }) {
  const [items, setItems] = useState<SafetyEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setItems(null);
    fetch(`/api/customers/${customerId}/allergies`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setItems(d.safety ?? []); })
      .catch((e) => setError(e.message ?? "load failed"));
  };
  useEffect(load, [customerId]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <LoadingState label="กำลังโหลดรายการอาหารเสริม…" />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Pill}
        title="ยังไม่มีรายการอาหารเสริมที่จับคู่ไว้"
        hint="เพิ่มผลตรวจ allergy แล้วระบบจะแนะนำ Nutrilite ที่เหมาะกับลูกค้า พร้อมธงเตือนตัวที่ควรเลี่ยงให้อัตโนมัติ"
        action={
          <Link
            href={`/customers/${customerId}/allergies/new`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-4 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-rose-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            <PlusCircle size={13} strokeWidth={2.25} aria-hidden /> เพิ่มผล Allergy
          </Link>
        }
      />
    );
  }

  const grouped: Record<SafetyStatus, SafetyEntry[]> = {
    avoid:       items.filter((i) => i.status === "avoid"),
    reduce_freq: items.filter((i) => i.status === "reduce_freq"),
    caution:     items.filter((i) => i.status === "caution"),
    safe:        items.filter((i) => i.status === "safe"),
  };

  const avoidCount = grouped.avoid.length;

  return (
    <div className="space-y-4">
      {/* Prominent avoid banner — safety first */}
      {avoidCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-status-danger/25 bg-status-bg-danger p-3.5">
          <AlertTriangle size={18} strokeWidth={2.25} className="mt-0.5 shrink-0 text-status-danger" aria-hidden />
          <div>
            <div className={`text-[13px] font-bold ${statusTextClass.danger}`}>
              มี {avoidCount} รายการที่ควรหลีกเลี่ยงสำหรับลูกค้าคนนี้
            </div>
            <p className={`mt-0.5 text-[12px] leading-snug ${statusTextClass.danger} opacity-90`}>
              ตรวจสอบส่วนผสมที่ชนกับผล allergy ก่อนแนะนำทุกครั้ง
            </p>
          </div>
        </div>
      )}

      {/* Summary chips */}
      <div className="flex flex-wrap gap-1.5">
        {ORDER.map((status) => {
          const m = STATUS_META[status];
          const Icon = m.icon;
          return (
            <span
              key={status}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                grouped[status].length > 0 ? statusTextClass[m.level] : "text-ink-40"
              }`}
              style={grouped[status].length > 0 ? { backgroundColor: `${statusHex[m.level]}1a` } : { backgroundColor: "#F2F0F3" }}
            >
              <Icon size={12} strokeWidth={2.25} aria-hidden /> {m.label} {grouped[status].length}
            </span>
          );
        })}
      </div>

      {/* Grouped lists */}
      {ORDER.map((status) => {
        const list = grouped[status];
        if (list.length === 0) return null;
        const m = STATUS_META[status];
        const Icon = m.icon;
        return (
          <section key={status} aria-label={m.label}>
            <div
              className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${statusTextClass[m.level]}`}
              style={{ backgroundColor: `${statusHex[m.level]}1a` }}
            >
              <Icon size={13} strokeWidth={2.25} aria-hidden /> {m.label}
              <span className="font-mono opacity-70">· {list.length}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((p) => (
                <div key={p.product_key} className="rounded-xl border border-ink-10 bg-white p-3.5 transition-colors hover:border-ink-20">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: statusHex[m.level] }} aria-label={STATUS_LABEL_TH[m.level]} />
                    <div className="min-w-0 flex-1">
                      <div className="font-thai text-[13px] font-semibold text-ink">{p.product_th ?? p.product_en ?? p.product_key}</div>
                      {(p.product_en || p.sku_id) && (
                        <div className="truncate font-mono text-[10.5px] text-ink-60">
                          {[p.product_en, p.sku_id].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                  </div>

                  {p.conflicting_ingredients && p.conflicting_ingredients.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.conflicting_ingredients.map((ing) => (
                        <span
                          key={ing}
                          className={`inline-flex items-center gap-1 rounded-full bg-status-bg-danger px-2 py-0.5 text-[10.5px] font-medium ${statusTextClass.danger}`}
                        >
                          <AlertTriangle size={10} strokeWidth={2.5} aria-hidden /> {ing}
                        </span>
                      ))}
                    </div>
                  )}

                  {p.reason && <p className="mt-2 text-[12px] leading-snug text-ink-60">{p.reason}</p>}

                  {p.alternative_product && (
                    <div className={`mt-2 flex items-center gap-1.5 rounded-lg bg-status-bg-optimal px-2.5 py-1.5 text-[11px] font-medium ${statusTextClass.optimal}`}>
                      <Lightbulb size={12} strokeWidth={2.25} aria-hidden /> ทางเลือก: {p.alternative_product}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
