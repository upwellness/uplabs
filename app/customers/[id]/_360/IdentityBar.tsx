"use client";

import Link from "next/link";
import type { StatusResult } from "@/lib/customers/status-classifier";

interface IdentityBarProps {
  customer: {
    id:          string;
    name:        string;
    nickname?:   string | null;
    gender?:     string | null;
    chrono_age?: number | null;
    phone?:      string | null;
    line_id?:    string | null;
  };
  status: StatusResult;
  meta: {
    bcaLapseDays:   number | null;
    labLapseDays:   number | null;
    orderLapseDays: number | null;
    lastTouch:      string | null;
  };
}

const ageStr = (age: number | null | undefined) => age != null ? `${age} ปี` : "—";
const genderIcon = (g?: string | null) => g === "male" ? "♂" : g === "female" ? "♀" : "○";

function lapseLabel(days: number | null, prefix: string): string {
  if (days == null) return `${prefix} —`;
  if (days < 7)  return `${prefix} ${days} วัน`;
  if (days < 30) return `${prefix} ${days} วัน`;
  if (days < 90) return `${prefix} ${Math.floor(days / 7)} สัปดาห์`;
  return `${prefix} ${Math.floor(days / 30)} เดือน`;
}

export function IdentityBar({ customer, status, meta }: IdentityBarProps) {
  const phone = customer.phone?.replace(/[^0-9+]/g, "");

  return (
    <div className="sticky top-0 z-30 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto max-w-content px-6 py-4">
        {/* Top row: name + status badge */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-shrink-0 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
            style={{ background: status.bg, color: status.color }}>
            {genderIcon(customer.gender)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-head text-[22px] font-extrabold tracking-tight text-ink truncate">
                {customer.name}
              </h1>
              {customer.nickname && (
                <span className="text-ink-40 text-sm">({customer.nickname})</span>
              )}
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
                style={{ background: status.bg, color: status.color }}
              >
                {status.icon} {status.label}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-60">
              <span>{ageStr(customer.chrono_age)}</span>
              <span className="text-ink-20">·</span>
              <span>{customer.gender === "male" ? "ชาย" : customer.gender === "female" ? "หญิง" : "—"}</span>
              {customer.phone && (
                <>
                  <span className="text-ink-20">·</span>
                  <a href={`tel:${phone}`} className="hover:text-rose">{customer.phone}</a>
                </>
              )}
            </div>
            <div className="mt-1 font-mono text-[10px] text-ink-40 italic">
              {status.reason}
            </div>
          </div>

          {/* Recency chips */}
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-surface px-2.5 py-1 font-mono text-[10px] text-ink-60">
              📊 {lapseLabel(meta.bcaLapseDays, "BCA")}
            </span>
            <span className="rounded-full bg-surface px-2.5 py-1 font-mono text-[10px] text-ink-60">
              🧾 {lapseLabel(meta.labLapseDays, "Lab")}
            </span>
            <span className="rounded-full bg-surface px-2.5 py-1 font-mono text-[10px] text-ink-60">
              💬 {lapseLabel(meta.orderLapseDays, "Touch")}
            </span>
          </div>
        </div>

        {/* Action bar */}
        <div className="mt-3 flex flex-wrap gap-2">
          {phone && (
            <a href={`tel:${phone}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-rose transition">
              📞 Call
            </a>
          )}
          {customer.line_id ? (
            <a href={`https://line.me/R/ti/p/${encodeURIComponent(customer.line_id)}`} target="_blank" rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 transition"
              style={{ background: "#06C755" }}>
              𝐋 LINE
            </a>
          ) : phone && (
            <a href={`https://line.me/R/ti/p/~${phone}`} target="_blank" rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 transition"
              style={{ background: "#06C755" }}>
              𝐋 LINE
            </a>
          )}
          <Link href={`/customers/${customer.id}/records/new`}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:border-ink-20 transition">
            ➕ Record
          </Link>
          <Link href={`/bca`}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:border-ink-20 transition">
            📊 BCA
          </Link>
          <Link href={`/customers/${customer.id}/allergies/new`}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:border-ink-20 transition">
            🧪 Allergy
          </Link>
          <Link href={`/customers/${customer.id}?legacy=1`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-ink-10 px-3 py-1.5 text-[11px] font-mono text-ink-60 hover:bg-ink-20 transition"
            title="Switch to legacy view">
            ⤴ Legacy
          </Link>
        </div>
      </div>
    </div>
  );
}
