/**
 * UP Labs v2 · ★ Customer Identity Block (SPEC §4 — MANDATORY)
 * ───────────────────────────────────────────────────────────
 * Shown prominently on BOTH the Customer Profile 360 and the BCA page.
 * Fields: ชื่อ (+ ชื่อเล่น) · วันเกิด ค.ศ. · อายุ · เพศ · ส่วนสูง.
 * Any null field renders "—" and never breaks. When key fields are missing,
 * shows an "เพิ่มข้อมูล" link to the existing edit-customer flow.
 *
 * Pure presentational — safe in server or client trees.
 */
import * as React from "react";
import { CalendarDays, Ruler, User2, PencilLine, type LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  type IdentityInput,
  displayName,
  birthDateLabel,
  birthDateBuddhist,
  ageLabel,
  genderLabel,
  genderGlyph,
  genderLabelWithGlyph,
  heightLabel,
  initials,
  resolveAge,
  genderKey,
} from "./identity";
import { cn } from "@/lib/utils";

function Field({
  icon: Icon,
  label,
  value,
  sub,
  muted,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-5 text-ink-40">
        <Icon size={15} strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">{label}</div>
        <div className={cn("font-head text-[15px] font-bold leading-tight", muted ? "text-ink-60" : "text-ink")}>
          {value}
        </div>
        {sub && <div className="font-mono text-[10px] text-ink-60">{sub}</div>}
      </div>
    </div>
  );
}

export interface IdentityBlockProps {
  customer: IdentityInput & { id: string };
  /** Compact = inline single-row chips (used inside the sticky 360 bar header). */
  variant?: "panel" | "compact";
  /** Where the "เพิ่มข้อมูล" link points (existing edit-customer flow). */
  editHref?: string;
  className?: string;
  /** Slot rendered inline next to the name (e.g. status badge). panel variant only. */
  headerExtra?: React.ReactNode;
  /** Slot rendered under the name (e.g. recency chips). panel variant only. */
  chips?: React.ReactNode;
  /** Italic reason line under the chips (e.g. status reason). panel variant only. */
  reason?: React.ReactNode;
  /** Action bar rendered below the field grid (e.g. โทร / LINE / actions). panel variant only. */
  actions?: React.ReactNode;
  /** Avatar to render instead of initials (e.g. an icon). Defaults to initials(). */
  avatar?: React.ReactNode;
}

export function IdentityBlock({ customer, variant = "panel", editHref, className, headerExtra, chips, reason, actions, avatar }: IdentityBlockProps) {
  const ageMissing = resolveAge(customer) == null;
  const dobMissing = !customer.birth_date && customer.birth_year == null;
  const genderMissing = genderKey(customer.gender) == null;
  const heightMissing = customer.height == null;
  const anyMissing = ageMissing || dobMissing || genderMissing || heightMissing;
  const buddhist = birthDateBuddhist(customer);

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-60", className)}>
        <span className={dobMissing ? "text-ink-60" : ""}>
          <CalendarDays size={12} strokeWidth={2.25} className="mr-1 inline -translate-y-px" aria-hidden />
          {birthDateLabel(customer)}
        </span>
        <span className="text-ink-20" aria-hidden>·</span>
        <span className={ageMissing ? "text-ink-60" : ""}>{ageLabel(customer)}</span>
        <span className="text-ink-20" aria-hidden>·</span>
        <span className={genderMissing ? "text-ink-60" : ""}>
          {genderLabelWithGlyph(customer.gender)}
        </span>
        <span className="text-ink-20" aria-hidden>·</span>
        <span className={heightMissing ? "text-ink-60" : ""}>
          <Ruler size={12} strokeWidth={2.25} className="mr-1 inline -translate-y-px" aria-hidden />
          {heightLabel(customer.height)}
        </span>
        {anyMissing && editHref && (
          <Link href={editHref as any} className="inline-flex items-center gap-1 text-rose hover:underline">
            <PencilLine size={11} strokeWidth={2.25} aria-hidden /> เพิ่มข้อมูล
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-ink-10 bg-white p-4 lg:p-5", className)}>
      <div className="flex flex-wrap items-start gap-4">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-ultra to-amber-ultra font-head text-[18px] font-extrabold text-rose ring-1 ring-rose-pale/60">
          {avatar ?? initials(customer.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-head text-[22px] font-extrabold leading-tight tracking-tight text-ink">
              {displayName(customer)}
            </h2>
            {headerExtra}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-thai text-[13px] text-ink-60">
            <span className={ageMissing ? "text-ink-40" : ""}>{ageLabel(customer)}</span>
            <span className="text-ink-20" aria-hidden>·</span>
            <span className={genderMissing ? "text-ink-40" : ""}>{genderLabelWithGlyph(customer.gender)}</span>
          </div>
          {chips && <div className="mt-2 flex flex-wrap gap-1.5">{chips}</div>}
          {reason && <div className="mt-1.5 font-thai text-[11.5px] italic leading-snug text-ink-60">{reason}</div>}
        </div>
        {anyMissing && editHref && (
          <Link
            href={editHref as any}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-rose/30 bg-rose-ultra px-3 py-1.5 text-[12px] font-semibold text-rose transition-colors hover:bg-rose hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            <PencilLine size={13} strokeWidth={2.25} aria-hidden /> เพิ่มข้อมูลที่ยังว่าง
          </Link>
        )}
      </div>

      {/* ★ Prominent identity grid (SPEC §4): DOB ค.ศ. · อายุ · เพศ · ส่วนสูง */}
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-5 pt-4 sm:grid-cols-4">
        <Field
          icon={CalendarDays}
          label="วันเกิด (ค.ศ.)"
          value={birthDateLabel(customer)}
          sub={buddhist || undefined}
          muted={dobMissing}
        />
        <Field icon={CalendarDays} label="อายุ" value={ageLabel(customer)} muted={ageMissing} />
        <Field icon={User2} label="เพศ" value={genderLabelWithGlyph(customer.gender)} muted={genderMissing} />
        <Field icon={Ruler} label="ส่วนสูง" value={heightLabel(customer.height)} muted={heightMissing} />
      </div>

      {actions && <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-5 pt-3.5">{actions}</div>}
    </div>
  );
}
