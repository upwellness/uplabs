"use client";

import Link from "next/link";
import { Phone, MessageCircle, PlusCircle, Activity, FlaskConical, ArrowUpRight, LineChart, Pill, Network } from "lucide-react";
import type { StatusResult } from "@/lib/customers/status-classifier";
import { ShareLabLinkButton } from "./ShareLabLinkButton";

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
    hasMedMap?:     boolean;
    hasLabReport?:  boolean;
    labReportToken?: string | null;
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

          {/* Recency chips · flat (not nested glass) */}
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 font-mono text-[10.5px] text-ink-60 border border-ink/8">
              <Activity size={11} strokeWidth={2.25} aria-hidden="true" />
              {lapseLabel(meta.bcaLapseDays, "BCA")}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 font-mono text-[10.5px] text-ink-60 border border-ink/8">
              <FlaskConical size={11} strokeWidth={2.25} aria-hidden="true" />
              {lapseLabel(meta.labLapseDays, "Lab")}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 font-mono text-[10.5px] text-ink-60 border border-ink/8">
              <MessageCircle size={11} strokeWidth={2.25} aria-hidden="true" />
              {lapseLabel(meta.orderLapseDays, "ทัก")}
            </span>
          </div>
        </div>

        {/* Action bar */}
        <div className="mt-3 flex flex-wrap gap-2">
          {phone && (
            <a href={`tel:${phone}`} aria-label={`โทรหา ${customer.name}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-rose transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
              <Phone size={14} strokeWidth={2.25} aria-hidden="true" /> โทร
            </a>
          )}
          {(customer.line_id || phone) && (
            <a
              href={customer.line_id ? `https://line.me/R/ti/p/${encodeURIComponent(customer.line_id)}` : `https://line.me/R/ti/p/~${phone}`}
              target="_blank" rel="noopener"
              aria-label="ส่งข้อความผ่าน LINE"
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ background: "#06C755" }}>
              <MessageCircle size={14} strokeWidth={2.25} aria-hidden="true" /> LINE
            </a>
          )}
          <Link href={`/customers/${customer.id}/records/new`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-ink/8 px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-white transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
            <PlusCircle size={14} strokeWidth={2.25} aria-hidden="true" /> เพิ่มผลตรวจ
          </Link>
          <Link href={`/bca`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-ink/8 px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-white transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
            <LineChart size={14} strokeWidth={2.25} aria-hidden="true" /> BCA
          </Link>
          <Link href={`/customers/${customer.id}/allergies/new`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-ink/8 px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-white transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
            <Pill size={14} strokeWidth={2.25} aria-hidden="true" /> Allergy
          </Link>
          {meta.hasMedMap && (
            <a href={`/api/customers/${customer.id}/med-map`} target="_blank" rel="noopener"
              aria-label="เปิดแผนผังยาและอาหารเสริม"
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-ultra border border-rose/20 px-3.5 py-1.5 text-[12px] font-semibold text-rose hover:bg-rose hover:text-white transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
              <Network size={14} strokeWidth={2.25} aria-hidden="true" /> แผนผังยา &amp; อาหารเสริม
            </a>
          )}
          {meta.hasLabReport && (
            <a href={`/api/customers/${customer.id}/lab-report`} target="_blank" rel="noopener"
              aria-label="เปิดรายงานสุขภาพ Longevity"
              className="inline-flex items-center gap-1.5 rounded-full bg-wellness-ultra border border-wellness/20 px-3.5 py-1.5 text-[12px] font-semibold text-wellness hover:bg-wellness hover:text-white transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2">
              <FlaskConical size={14} strokeWidth={2.25} aria-hidden="true" /> Longevity Report
            </a>
          )}
          {meta.hasLabReport && meta.labReportToken && (
            <ShareLabLinkButton token={meta.labReportToken} />
          )}
          <Link href={`/customers/${customer.id}?legacy=1`}
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-ink/8 px-3 py-1.5 text-[11px] font-mono text-ink-60 hover:bg-ink/15 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
            title="Switch to legacy view">
            <ArrowUpRight size={12} strokeWidth={2.25} aria-hidden="true" /> มุมมองเดิม
          </Link>
        </div>
      </div>
    </div>
  );
}
