"use client";

/**
 * UP Labs v2 · CGM + Pulse tabs (Customer 360, SPEC §7.5–7.6)
 * ───────────────────────────────────────────────────────────
 * Both are prop-driven from the /api/customers/[id]/360 payload — no extra fetch,
 * no recharts — so they stay out of the route's First-Load JS until opened and
 * mirror the v1 tabs (CgmTab / PulseTab) field-for-field in clinical-warm.
 */

import Link from "next/link";
import {
  Wifi, Activity, ArrowRight, ExternalLink, ShieldAlert, CheckCircle2,
  FileText, ClipboardList, Target, Wallet, Smartphone, Upload, Eye,
} from "lucide-react";
import { EmptyState } from "@/lib/v2/ui";
import { statusTextClass } from "@/lib/v2/status";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

/* ─────────────────────────── CGM tab ─────────────────────────── */

export function CgmTab({ customerId, profiles }: { customerId: string; profiles: string[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-ink-10 bg-white p-4 lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-science-ultra text-science">
              <Wifi size={18} strokeWidth={2} aria-hidden />
            </span>
            <div>
              <h3 className="font-head text-[15px] font-bold text-ink">CGM Profile ที่เชื่อมไว้</h3>
              <p className="mt-0.5 text-[12px] text-ink-60">
                {profiles.length === 0 ? "ยังไม่มีการเชื่อมต่อ" : `${profiles.length} profile`}
              </p>
            </div>
          </div>
          <Link
            href="/cgm"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-4 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-rose-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            <Activity size={14} strokeWidth={2.25} aria-hidden /> เปิด CGM Analyzer
            <ArrowRight size={13} strokeWidth={2.5} aria-hidden />
          </Link>
        </div>

        {profiles.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {profiles.map((p) => (
              <li
                key={p}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-10 bg-surface px-3 py-1.5 font-mono text-[12px] text-ink-80"
              >
                <Wifi size={12} strokeWidth={2.25} className="text-science" aria-hidden /> {p}
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState
              icon={Wifi}
              title="ยังไม่ได้เชื่อม CGM profile ของลูกค้าคนนี้"
              hint="เชื่อม profile ได้จากหน้าโปรไฟล์ (มุมมองเดิม) แล้วค่าจะมาแสดงที่นี่"
              action={
                <Link
                  href={`/customers/${customerId}`}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-1.5 text-[12px] font-semibold text-ink-80 transition-colors hover:border-rose hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
                >
                  <ExternalLink size={13} strokeWidth={2.25} aria-hidden /> เปิดในมุมมองเดิม
                </Link>
              }
            />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-status-optimal/20 bg-status-bg-optimal p-4">
        <div className={`flex items-center gap-1.5 text-[13px] font-semibold ${statusTextClass.optimal}`}>
          <CheckCircle2 size={15} strokeWidth={2.25} aria-hidden /> ฟีเจอร์ CGM ที่กำลังพัฒนา
        </div>
        <p className={`mt-1 text-[12px] leading-[1.6] ${statusTextClass.optimal} opacity-90`}>
          เร็วๆ นี้: เวลาที่น้ำตาลอยู่ในเกณฑ์ดี (Time-in-Range) · จับ pattern น้ำตาลพุ่ง · เชื่อมกับมื้ออาหาร · ตรวจ dawn phenomenon
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── Pulse tab ─────────────────────────── */

interface PulseAssessment {
  id: string;
  status: string;
  blocked: boolean;
  share_token: string | null;
  sent_at: string | null;
  created_at: string;
  ai_output: any;
}

interface PulseIntake {
  submitted_at: string;
  goal: string | null;
  budget_range: string | null;
}

function assessmentState(a: PulseAssessment): { label: string; icon: typeof CheckCircle2; cls: string; bg: string; border: string } {
  if (a.blocked)
    return { label: "ติด Red Flag — แนะนำพบแพทย์", icon: ShieldAlert, cls: statusTextClass.danger, bg: "bg-status-bg-danger", border: "border-status-danger/20" };
  if (a.sent_at)
    return { label: "ส่งให้ลูกค้าแล้ว", icon: CheckCircle2, cls: statusTextClass.optimal, bg: "bg-status-bg-optimal", border: "border-status-optimal/20" };
  return { label: "ฉบับร่าง", icon: FileText, cls: "text-ink-60", bg: "bg-surface", border: "border-ink-10" };
}

export function PulseTab({
  customerId,
  assessments,
  intake,
}: {
  customerId: string;
  assessments: PulseAssessment[];
  intake: PulseIntake | null;
}) {
  return (
    <div className="space-y-4">
      {/* Manage / import entry — links to the existing master page (full merge is a later iteration) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-10 bg-surface/60 px-4 py-3">
        <div className="flex items-center gap-2 text-[12px] text-ink-60">
          <Smartphone size={14} strokeWidth={2.25} className="text-rose" aria-hidden />
          นำเข้า/จัดการข้อมูล wearable ของลูกค้าคนนี้
        </div>
        <Link
          href={`/pulse/master/${customerId}`}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink-80 transition-colors hover:border-rose hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
        >
          <Upload size={13} strokeWidth={2.25} aria-hidden /> นำเข้า / จัดการ Pulse
        </Link>
      </div>

      {/* Latest intake questionnaire */}
      {intake && (
        <div className="rounded-xl border border-ink-10 bg-white p-4 lg:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-1.5 font-head text-[15px] font-bold text-ink">
              <ClipboardList size={15} strokeWidth={2.25} className="text-rose" aria-hidden /> แบบสอบถามล่าสุด
            </h3>
            <span className="font-mono text-[11px] text-ink-60">{fmtDate(intake.submitted_at)}</span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-xl border border-ink-10 bg-surface/60 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-60">
                <Target size={12} strokeWidth={2.25} aria-hidden /> เป้าหมาย
              </div>
              <div className="mt-1 font-thai text-[13px] text-ink">{intake.goal ?? "—"}</div>
            </div>
            <div className="rounded-xl border border-ink-10 bg-surface/60 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-60">
                <Wallet size={12} strokeWidth={2.25} aria-hidden /> งบประมาณ
              </div>
              <div className="mt-1 font-thai text-[13px] text-ink">{intake.budget_range ?? "—"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Assessments list */}
      <div className="rounded-xl border border-ink-10 bg-white p-4 lg:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-1.5 font-head text-[15px] font-bold text-ink">
            <Activity size={15} strokeWidth={2.25} className="text-rose" aria-hidden /> ผลประเมิน Pulse
          </h3>
          <span className="font-mono text-[11px] text-ink-60">{assessments.length} รายการ</span>
        </div>

        {assessments.length === 0 ? (
          <EmptyState
            icon={Smartphone}
            title="ยังไม่มีผลประเมิน Pulse"
            hint="ส่งแบบประเมินให้ลูกค้าทำ หรือ นำเข้าข้อมูล wearable ได้จากหน้า Pulse"
            action={
              <Link
                href={`/pulse/master/${customerId}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-4 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-rose-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
              >
                <Upload size={13} strokeWidth={2.25} aria-hidden /> ไปหน้า Pulse
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {assessments.slice(0, 5).map((a) => {
              const st = assessmentState(a);
              const StIcon = st.icon;
              return (
                <li key={a.id} className={`rounded-xl border ${st.border} ${st.bg} px-4 py-3`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${st.cls}`}>
                          <StIcon size={14} strokeWidth={2.25} aria-hidden /> {st.label}
                        </span>
                        <span className="font-mono text-[11px] text-ink-60">{fmtDate(a.created_at)}</span>
                      </div>
                      {a.ai_output?.summary && (
                        <p className="mt-1 line-clamp-2 font-thai text-[12px] leading-snug text-ink-60">{a.ai_output.summary}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Link
                        href={`/pulse/report/${a.id}` as any}
                        target="_blank"
                        rel="noopener"
                        aria-label="เปิดรายงาน wearable"
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-wellness/20 bg-wellness-ultra px-2.5 py-1 text-[11px] font-semibold text-wellness transition-colors hover:bg-wellness hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2"
                      >
                        <FileText size={12} strokeWidth={2.25} aria-hidden /> รายงาน
                      </Link>
                      <Link
                        href={`/pulse/assessments/${a.id}` as any}
                        target="_blank"
                        rel="noopener"
                        aria-label="ดูผลประเมินฉบับเต็ม"
                        className="inline-flex min-h-[36px] w-9 items-center justify-center rounded-full border border-ink-10 bg-white text-ink-60 transition-colors hover:border-ink-20 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
                      >
                        <Eye size={13} strokeWidth={2.25} aria-hidden />
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
            {assessments.length > 5 && (
              <li className="pt-1 text-center font-mono text-[11px] text-ink-60">
                แสดง 5 จาก {assessments.length} ·{" "}
                <Link href={`/pulse/master/${customerId}`} className="font-semibold text-rose hover:underline">
                  ดูทั้งหมด
                </Link>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
