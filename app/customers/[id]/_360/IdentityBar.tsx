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
    <div className="liquid-header sticky top-0 z-30">
      <div className="mx-auto max-w-content px-6 py-4">
        {/* Top row: avatar + name + status badge */}
        <div className="flex flex-wrap items-center gap-4">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-2xl border border-white/60 shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${status.bg}, rgba(255,255,255,0.4))`,
              color: status.color,
              backdropFilter: "blur(12px)",
            }}>
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
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider border"
                style={{
                  background: `${status.bg}aa`,
                  color: status.color,
                  borderColor: `${status.color}30`,
                  backdropFilter: "blur(8px)",
                }}>
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
            <div className="mt-1 font-thai text-[11px] text-ink-60 italic leading-snug">
              {status.reason}
            </div>
          </div>

          {/* Recency chips · glass mini-cards */}
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white/50 backdrop-blur-md px-2.5 py-1 font-mono text-[10px] text-ink-60 border border-white/60">
              📊 {lapseLabel(meta.bcaLapseDays, "BCA ล่าสุด")}
            </span>
            <span className="rounded-full bg-white/50 backdrop-blur-md px-2.5 py-1 font-mono text-[10px] text-ink-60 border border-white/60">
              🧾 {lapseLabel(meta.labLapseDays, "Lab ล่าสุด")}
            </span>
            <span className="rounded-full bg-white/50 backdrop-blur-md px-2.5 py-1 font-mono text-[10px] text-ink-60 border border-white/60">
              💬 {lapseLabel(meta.orderLapseDays, "ทักล่าสุด")}
            </span>
          </div>
        </div>

        {/* Action bar */}
        <div className="mt-3 flex flex-wrap gap-2">
          {phone && (
            <a href={`tel:${phone}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-rose transition-all hover:shadow-md">
              📞 โทร
            </a>
          )}
          {customer.line_id ? (
            <a href={`https://line.me/R/ti/p/${encodeURIComponent(customer.line_id)}`} target="_blank" rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 transition-all hover:shadow-md"
              style={{ background: "#06C755" }}>
              𝐋 LINE
            </a>
          ) : phone && (
            <a href={`https://line.me/R/ti/p/~${phone}`} target="_blank" rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 transition-all hover:shadow-md"
              style={{ background: "#06C755" }}>
              𝐋 LINE
            </a>
          )}
          <Link href={`/customers/${customer.id}/records/new`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/60 backdrop-blur-md border border-white/70 px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-white/85 transition-all">
            ➕ บันทึก
          </Link>
          <Link href={`/bca`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/60 backdrop-blur-md border border-white/70 px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-white/85 transition-all">
            📊 BCA
          </Link>
          <Link href={`/customers/${customer.id}/allergies/new`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/60 backdrop-blur-md border border-white/70 px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-white/85 transition-all">
            🧪 Allergy
          </Link>
          <Link href={`/customers/${customer.id}?legacy=1`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-ink/8 backdrop-blur-md px-3 py-1.5 text-[11px] font-mono text-ink-60 hover:bg-ink/15 transition-all"
            title="Switch to legacy view">
            ⤴ มุมมองเดิม
          </Link>
        </div>
      </div>
    </div>
  );
}
