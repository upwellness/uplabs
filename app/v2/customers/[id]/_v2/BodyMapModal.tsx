"use client";

/**
 * UP Labs v2 · Body Map link + modal (Customer 360, Labs tab)
 * ──────────────────────────────────────────────────────────
 * Reuses the v1 visualization read-only: imports `BodyView` from the legacy
 * record page and `BODY_REGIONS` / `findMetric` for mapping + ref ranges.
 * The trigger reveals an anatomical figure with the customer's LATEST lab
 * values placed on the organ they relate to (dots colored by worst status,
 * abnormal-count badges, callouts) — exactly the v1 body map.
 *
 * BodyView is a client component with its own state + a large inline SVG, so we
 * lazy-load it via next/dynamic (no SSR) — the figure only mounts once opened.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { PersonStanding, X } from "lucide-react";
import { BODY_REGIONS } from "@/lib/records/body-map";
import { findMetric } from "@/lib/records/catalog";

// Lazy — keeps the SVG body + detail panel out of the Labs-tab bundle until used.
const BodyView = dynamic(
  () => import("@/app/customers/[id]/records/[recordId]/BodyView").then((m) => m.BodyView),
  { ssr: false, loading: () => <BodyViewSkeleton /> },
);

/** Shape BodyView expects (mirrors its internal LabValue interface). */
interface BodyLabValue {
  id: string;
  category: string;
  metric_key: string;
  metric_label_th: string | null;
  metric_label_en: string | null;
  value: string | null;
  value_num: number | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string | null;
  status: string | null;
}

/** Loose shape of what the Labs tab already holds (from /lab-values/latest). */
export interface SourceLabValue {
  metric_key: string;
  metric_label_th: string | null;
  metric_label_en: string | null;
  value: string | null;
  value_num: number | null;
  unit: string | null;
  status: string | null;
  category: string | null;
  ref_low?: number | null;
  ref_high?: number | null;
  ref_text?: string | null;
}

/** metric_keys that BODY_REGIONS can actually place on the figure. */
const MAPPABLE_KEYS = new Set<string>(BODY_REGIONS.flatMap((r) => r.metrics));

/**
 * Adapt the v2 lab rows → the v1 `LabValue[]` BodyView consumes.
 * - `id`: synthesized from metric_key (BodyView only uses it as a React key).
 * - `category`: coerced to "" (v1 wants string; v2 may be null).
 * - ref range: prefer the value's own ref_*; otherwise fall back to the static
 *   catalog so the detail panel can still show "ปกติ: …".
 */
export function toBodyValues(rows: SourceLabValue[]): BodyLabValue[] {
  return rows.map((v) => {
    const cat = findMetric(v.metric_key);
    return {
      id: v.metric_key,
      category: v.category ?? "",
      metric_key: v.metric_key,
      metric_label_th: v.metric_label_th,
      metric_label_en: v.metric_label_en,
      value: v.value,
      value_num: v.value_num,
      unit: v.unit,
      ref_low: v.ref_low ?? cat?.ref_low ?? null,
      ref_high: v.ref_high ?? cat?.ref_high ?? null,
      ref_text: v.ref_text ?? cat?.ref_text ?? null,
      status: v.status,
    };
  });
}

/** True if at least one row maps onto the body figure. */
export function hasMappableLabs(rows: SourceLabValue[]): boolean {
  return rows.some((v) => MAPPABLE_KEYS.has(v.metric_key));
}

/* ── Trigger button (place inside the Labs tab) ── */
export function BodyMapButton({
  values,
  gender,
}: {
  values: SourceLabValue[];
  gender?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const mappable = useMemo(() => hasMappableLabs(values), [values]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!mappable}
        title={
          mappable
            ? "เปิดภาพร่างกาย พร้อมจุดที่ผลแล็บแต่ละค่าเกี่ยวข้อง"
            : "ยังไม่มีผลแล็บที่จับคู่กับอวัยวะได้"
        }
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-2 text-[12px] font-semibold text-ink-80 transition-colors hover:border-rose hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-ink-10 disabled:hover:text-ink-80"
      >
        <PersonStanding size={15} strokeWidth={2.25} aria-hidden />
        ดูภาพร่างกาย · จุดที่ผลแล็บเกิดขึ้น
      </button>

      {open && (
        <BodyMapModal values={values} gender={gender} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/* ── Modal ── */
function BodyMapModal({
  values,
  gender,
  onClose,
}: {
  values: SourceLabValue[];
  gender?: string | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyValues = useMemo(() => toBodyValues(values), [values]);
  const mappableCount = useMemo(
    () => values.filter((v) => MAPPABLE_KEYS.has(v.metric_key)).length,
    [values],
  );

  // Escape to close + focus the panel when opened (a11y, matches v2 modals).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ภาพร่างกาย — จุดที่ผลแล็บเกี่ยวข้อง"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="my-8 w-full max-w-5xl overflow-hidden rounded-2xl border border-ink-10 bg-white shadow-[0_24px_60px_-24px_rgba(24,21,26,0.45)] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-ink-10 bg-surface px-5 py-4 lg:px-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-rose">
              <PersonStanding size={14} strokeWidth={2.25} aria-hidden /> Visual Body Map
            </div>
            <h2 className="mt-0.5 font-head text-[22px] font-extrabold tracking-tight text-ink">
              จุดที่ผลแล็บเกี่ยวข้องในร่างกาย
            </h2>
            <p className="mt-0.5 font-thai text-[12px] text-ink-60">
              แต่ละจุด = ระบบ/อวัยวะ · สีบอกสถานะค่าล่าสุด · ป้ายแดง = จำนวนค่าที่ผิดปกติ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-ink-60 transition-colors hover:bg-ink-5 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            <X size={18} strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 lg:px-6">
          {mappableCount === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-5 text-ink-40">
                <PersonStanding size={22} strokeWidth={2} aria-hidden />
              </span>
              <div className="mt-1 font-head text-[16px] font-bold text-ink">ยังจับคู่กับร่างกายไม่ได้</div>
              <p className="max-w-sm font-thai text-[13px] leading-[1.6] text-ink-60">
                ผลแล็บที่มียังไม่ตรงกับรายการที่ระบบจับคู่กับอวัยวะได้ — เพิ่มค่าอย่างไขมัน น้ำตาล ตับ ไต หรือ CBC แล้วจุดจะปรากฏบนรูป
              </p>
            </div>
          ) : (
            <BodyView values={bodyValues} gender={gender} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton shown while the body figure chunk loads ── */
function BodyViewSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <PersonStanding size={26} className="animate-pulse text-rose" aria-hidden />
      <div className="font-thai text-[13px] text-ink-60">กำลังเตรียมภาพร่างกาย…</div>
    </div>
  );
}
