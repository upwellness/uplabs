"use client";

/**
 * UP Labs v2 · ★ Customer Profile 360 (SPEC §7.3)
 * ───────────────────────────────────────────────
 * Fetches /api/customers/[id]/360 (same contract as v1) and renders the full
 * profile in clinical-warm: mandatory identity block (§4), status + recency chips,
 * action bar, Vital Dashboard (health-score gauge + 6 metric cards), insights,
 * 90-day timeline, and 8 accessible tabs (Body/Labs/Trends full; the rest tracked
 * placeholders with a Legacy fallback link).
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Phone, MessageCircle, PlusCircle, Scale, Pill, Network, FlaskConical, Link2, Check,
  Activity, Heart, TrendingUp, AlertTriangle, Target, Sparkles, Clock, Inbox,
  Wifi, Smartphone, NotebookPen, ExternalLink, ArrowRight, Droplet, Weight, CalendarClock,
} from "lucide-react";
import { Shell } from "../../_components/Shell";
import { Card, LoadingState, ErrorState, EmptyState, MetricGauge, TrendArrow } from "@/lib/v2/ui";
import { IdentityBlock } from "@/lib/v2/IdentityBlock";
import {
  displayName, resolveAge, genderKey,
} from "@/lib/v2/identity";
import { scoreLevel, customerStatusLevel, statusTextHex, statusTextClass } from "@/lib/v2/status";
import {
  classifyHbA1c, classifyLDL, classifyFBS, classifyVisceralFat, classifyBodyAge, classifyBMI, trendDir,
} from "@/lib/v2/labs";
import { statusClasses, statusHex, STATUS_LABEL_TH, type StatusLevel } from "@/lib/medical-status";
import { deriveBMI } from "@/lib/bca-derive";

/**
 * Labs/Trends tabs are loaded on demand (SPEC §8 "กราฟ lazy/conditional").
 * They live in one module that statically imports recharts (~100kB); the initial
 * 360 tab is "body" (no charts), so deferring both keeps recharts out of the
 * route's First-Load JS until the user opens Labs/Trends.
 */
const LabsTab = dynamic(() => import("./_v2/LabTabs").then((m) => m.LabsTab), {
  ssr: false,
  loading: () => <LoadingState label="กำลังโหลดผลแล็บ…" />,
});
const TrendsTab = dynamic(() => import("./_v2/LabTabs").then((m) => m.TrendsTab), {
  ssr: false,
  loading: () => <LoadingState label="กำลังโหลดแนวโน้ม…" />,
});

/**
 * The remaining detail tabs are also loaded on demand: each owns its own fetch
 * and/or client state, so deferring them keeps page.tsx lean and their code out
 * of the route's First-Load JS until the matching tab is opened.
 */
const AllergyTab = dynamic(() => import("./_v2/AllergyTab").then((m) => m.AllergyTab), {
  ssr: false,
  loading: () => <LoadingState label="กำลังโหลดผลตรวจภูมิแพ้…" />,
});
const SupplementsTab = dynamic(() => import("./_v2/SupplementsTab").then((m) => m.SupplementsTab), {
  ssr: false,
  loading: () => <LoadingState label="กำลังโหลดรายการอาหารเสริม…" />,
});
const NotesTab = dynamic(() => import("./_v2/NotesTab").then((m) => m.NotesTab), {
  ssr: false,
  loading: () => <LoadingState label="กำลังโหลดบันทึก…" />,
});
const CgmTab = dynamic(() => import("./_v2/PulseCgmTabs").then((m) => m.CgmTab), {
  ssr: false,
  loading: () => <LoadingState label="กำลังโหลด CGM…" />,
});
const PulseTab = dynamic(() => import("./_v2/PulseCgmTabs").then((m) => m.PulseTab), {
  ssr: false,
  loading: () => <LoadingState label="กำลังโหลด Pulse…" />,
});

/* ── 360 response shape (subset we render) ── */
interface Customer360 {
  customer: any;
  score: { total: number | null; bca: number | null; lab: number | null; recency: number | null; delta: number | null; deltaReason: string | null };
  status: { status: string; label: string; icon: string; color: string; bg: string; reason: string };
  insights: { alerts: any[]; trends: any[]; actions: any[]; hasCriticalAlert: boolean };
  labVals: { hba1c: number | null; fbs: number | null; ldl: number | null; hdl: number | null; triglyceride: number | null; alt: number | null; ast: number | null };
  bcaLatest: any | null;
  bcaHistory?: any[];
  bcaCount: number;
  pulseCount: number;
  allergyTests: any[];
  timeline: { type: string; icon: string; date: string; title: string; href?: string }[];
  meta: { bcaLapseDays: number | null; labLapseDays: number | null; orderLapseDays: number | null; lastTouch: string | null; hasMedMap?: boolean; hasLabReport?: boolean; labReportToken?: string | null };
  cgmProfiles: string[];
  pulseAssessments: any[];
  pulseIntake: any;
}

export default function V2Customer360Page({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<Customer360 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setData(null);
    fetch(`/api/customers/${id}/360`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d); })
      .catch((e) => setError(e.message ?? "load failed"));
  };
  useEffect(load, [id]);

  const name = data ? displayName(data.customer) : "ลูกค้า";
  const breadcrumb = [{ label: "หน้าแรก", href: "/v2" }, { label: "ลูกค้า", href: "/v2/customers" }, { label: data ? name : "โปรไฟล์" }];

  if (error) {
    return (
      <Shell breadcrumb={breadcrumb}>
        <Card><ErrorState message={error} onRetry={load} /></Card>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell breadcrumb={breadcrumb}>
        <Card><LoadingState label="กำลังโหลดโปรไฟล์ลูกค้า…" /></Card>
      </Shell>
    );
  }

  return (
    <Shell breadcrumb={breadcrumb}>
      <div className="space-y-5">
        <IdentityBar data={data} customerId={id} />

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <VitalDashboard data={data} />
            <TimelinePanel events={data.timeline} />
          </div>
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-20">
              <InsightsPanel insights={data.insights} />
            </div>
          </div>
        </div>

        <DetailTabs data={data} customerId={id} />
      </div>
    </Shell>
  );
}

/* ─────────────────────────── Identity Bar ─────────────────────────── */

function recencyLabel(days: number | null, prefix: string): string {
  if (days == null) return `${prefix} —`;
  if (days < 7) return `${prefix} ${days} วัน`;
  if (days < 30) return `${prefix} ${days} วัน`;
  if (days < 90) return `${prefix} ${Math.floor(days / 7)} สัปดาห์`;
  return `${prefix} ${Math.floor(days / 30)} เดือน`;
}

function IdentityBar({ data, customerId }: { data: Customer360; customerId: string }) {
  const c = data.customer;
  const st = data.status;
  const stLevel = customerStatusLevel(st.status as any);
  const phone = c.phone ? String(c.phone).replace(/[^0-9+]/g, "") : null;

  // Status badge shown inline with the name (same prominent IdentityBlock as BCA · SPEC §4).
  const statusBadge = (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusClasses.bg[stLevel]} ${statusTextClass[stLevel]}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusHex[stLevel] }} aria-hidden />
      {st.label}
    </span>
  );

  const chips = (
    <>
      <RecencyChip icon={Activity} text={recencyLabel(data.meta.bcaLapseDays, "BCA")} />
      <RecencyChip icon={FlaskConical} text={recencyLabel(data.meta.labLapseDays, "แล็บ")} />
      <RecencyChip icon={MessageCircle} text={recencyLabel(data.meta.orderLapseDays, "ทักล่าสุด")} />
      {c.phone && (
        <a href={`tel:${phone}`} className="inline-flex min-h-[28px] items-center gap-1 rounded-full border border-ink-10 bg-surface px-2.5 py-1 font-mono text-[10.5px] text-ink-60 hover:text-rose">
          <Phone size={11} strokeWidth={2.25} aria-hidden /> {c.phone}
        </a>
      )}
    </>
  );

  const actions = (
    <>
      {phone && (
        <a href={`tel:${phone}`} aria-label={`โทรหา ${c.name}`} className="btn-primary"><Phone size={14} strokeWidth={2.25} aria-hidden /> โทร</a>
      )}
      {(c.line_id || phone) && (
        <a
          href={c.line_id ? `https://line.me/R/ti/p/${encodeURIComponent(c.line_id)}` : `https://line.me/R/ti/p/~${phone}`}
          target="_blank" rel="noopener" aria-label="ส่งข้อความผ่าน LINE"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ background: "#06C755" }}
        >
          <MessageCircle size={14} strokeWidth={2.25} aria-hidden /> LINE
        </a>
      )}
      <Link href={`/customers/${customerId}/records/new`} className="btn-ghost"><PlusCircle size={14} strokeWidth={2.25} aria-hidden /> เพิ่มผลตรวจ</Link>
      <Link href={`/v2/bca?customer=${customerId}`} className="btn-ghost"><Scale size={14} strokeWidth={2.25} aria-hidden /> BCA</Link>
      <Link href={`/customers/${customerId}/allergies/new`} className="btn-ghost"><Pill size={14} strokeWidth={2.25} aria-hidden /> Allergy</Link>
      {data.meta.hasMedMap && (
        <a href={`/api/customers/${customerId}/med-map`} target="_blank" rel="noopener" aria-label="เปิดแผนผังยาและอาหารเสริม"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-rose/20 bg-rose-ultra px-3.5 py-1.5 text-[12px] font-semibold text-rose transition-colors hover:bg-rose hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
          <Network size={14} strokeWidth={2.25} aria-hidden /> แผนผังยา &amp; อาหารเสริม
        </a>
      )}
      {data.meta.hasLabReport && (
        <a href={`/api/customers/${customerId}/lab-report`} target="_blank" rel="noopener" aria-label="เปิดรายงานสุขภาพ Longevity"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-wellness/20 bg-wellness-ultra px-3.5 py-1.5 text-[12px] font-semibold text-wellness transition-colors hover:bg-wellness hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2">
          <FlaskConical size={14} strokeWidth={2.25} aria-hidden /> Longevity Report
        </a>
      )}
      {data.meta.hasLabReport && data.meta.labReportToken && (
        <CopyLinkButton token={data.meta.labReportToken} />
      )}
      <Link href={`/customers/${customerId}`} className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-ink-5 px-3 py-1.5 text-[11px] font-semibold text-ink-60 transition-colors hover:bg-ink-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2" title="ไปหน้าเวอร์ชันปัจจุบัน (Legacy)">
        <ExternalLink size={12} strokeWidth={2.25} aria-hidden /> มุมมองเดิม
      </Link>
    </>
  );

  return (
    <>
      {/* ★ Same prominent IdentityBlock as BCA (SPEC §4): name · DOB ค.ศ. · age · gender · height */}
      <IdentityBlock
        customer={c}
        editHref={`/customers/${customerId}`}
        headerExtra={statusBadge}
        chips={chips}
        reason={st.reason || undefined}
        actions={actions}
      />
      {/* button utility classes (scoped) */}
      <style jsx global>{`
        .btn-primary {
          display: inline-flex; align-items: center; gap: 0.375rem; min-height: 44px;
          border-radius: 9999px; padding: 0.375rem 0.875rem;
          font-size: 12px; font-weight: 600; color: #fff; background: #18151A;
          transition: background-color 0.15s;
        }
        .btn-primary:hover { background: #8C4C4C; }
        .btn-ghost {
          display: inline-flex; align-items: center; gap: 0.375rem; min-height: 44px;
          border-radius: 9999px; padding: 0.375rem 0.875rem;
          font-size: 12px; font-weight: 600; color: #18151A;
          background: #fff; border: 1px solid #DDD9DF; transition: border-color 0.15s, color 0.15s;
        }
        .btn-ghost:hover { border-color: #8C4C4C; color: #8C4C4C; }
      `}</style>
    </>
  );
}

function RecencyChip({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ink-10 bg-surface px-2.5 py-1 font-mono text-[10.5px] text-ink-60">
      <Icon size={11} strokeWidth={2.25} aria-hidden /> {text}
    </span>
  );
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = `${window.location.origin}/r/lab/${token}`;
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("คัดลอกลิงก์นี้เพื่อส่งให้ลูกค้า:", url); }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button type="button" onClick={copy} aria-label="คัดลอกลิงก์รายงานสาธารณะ (เปิดได้ไม่ต้องล็อกอิน)"
      className="inline-flex items-center gap-1.5 rounded-full border border-ink-10 bg-ink-5 px-3.5 py-1.5 text-[12px] font-semibold text-ink-60 transition-colors hover:bg-ink-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2">
      {copied ? <Check size={14} strokeWidth={2.5} className="text-wellness" aria-hidden /> : <Link2 size={14} strokeWidth={2.25} aria-hidden />}
      {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์ลูกค้า"}
    </button>
  );
}

/* ─────────────────────────── Vital Dashboard ─────────────────────────── */

function VitalDashboard({ data }: { data: Customer360 }) {
  const total = data.score.total;
  const lv = scoreLevel(total);
  const delta = data.score.delta;

  // 6 metric cards (SPEC §7.3): HbA1c · LDL · weight · visceral · FBS · body age
  const chronoAge = data.customer.chrono_age ?? resolveAge(data.customer);
  const bca = data.bcaLatest;
  const history = data.bcaHistory ?? [];
  const weightSeries = [...history].map((h) => h.weight).filter((n) => n != null).reverse() as number[];
  const visceralSeries = [...history].map((h) => h.visceral).filter((n) => n != null).reverse() as number[];

  const cards: MetricCardProps[] = [
    metricCard("HbA1c", data.labVals.hba1c, "%", data.labVals.hba1c != null ? classifyHbA1c(data.labVals.hba1c) : null, "lower"),
    metricCard("LDL", data.labVals.ldl, "mg/dL", data.labVals.ldl != null ? classifyLDL(data.labVals.ldl) : null, "lower"),
    metricCard("น้ำหนัก", bca?.weight ?? null, "kg", null, "lower", weightSeries),
    metricCard("Visceral", bca?.visceral ?? null, "", bca?.visceral != null ? classifyVisceralFat(bca.visceral) : null, "lower", visceralSeries),
    metricCard("FBS", data.labVals.fbs, "mg/dL", data.labVals.fbs != null ? classifyFBS(data.labVals.fbs) : null, "lower"),
    metricCard("Body age", bca?.body_age ?? null, "ปี", (bca?.body_age != null && chronoAge != null) ? classifyBodyAge(bca.body_age, chronoAge) : null, "lower"),
  ];

  return (
    <Card className="p-4 lg:p-5">
      <div className="flex flex-wrap items-center gap-5">
        {/* Health score gauge */}
        <div className="flex items-center gap-4">
          <MetricGauge
            value={total != null ? total / 100 : 0}
            display={total != null ? String(total) : "—"}
            unit="/ 100"
            label="Health Score"
            level={lv}
            size={104}
          />
          <div>
            <div className="flex items-center gap-1.5">
              <Heart size={15} strokeWidth={2.25} className="text-rose" aria-hidden />
              <span className="font-head text-[15px] font-bold text-ink">คะแนนสุขภาพรวม</span>
            </div>
            <p className="mt-0.5 max-w-[200px] font-thai text-[12px] leading-[1.5] text-ink-60">
              BCA · ผลแล็บ · ความสม่ำเสมอ รวมเป็น 0–100
            </p>
            {delta != null && delta !== 0 && (
              <div className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${delta > 0 ? `bg-status-bg-optimal ${statusTextClass.optimal}` : `bg-status-bg-warning ${statusTextClass.warning}`}`}>
                <TrendArrow dir={delta > 0 ? "up" : "down"} />
                {delta > 0 ? "+" : ""}{delta} จากครั้งก่อน
              </div>
            )}
            {data.score.deltaReason && <div className="mt-1 font-mono text-[10px] text-ink-60">{data.score.deltaReason}</div>}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-ink-5 pt-4 sm:grid-cols-3">
        {cards.map((c) => <MetricCard key={c.label} {...c} />)}
      </div>
    </Card>
  );
}

interface MetricCardProps {
  label: string;
  value: number | null;
  unit: string;
  level: StatusLevel | null;
  betterDir: "lower" | "higher";
  series?: number[];
}

function metricCard(label: string, value: number | null, unit: string, level: StatusLevel | null, betterDir: "lower" | "higher", series?: number[]): MetricCardProps {
  return { label, value, unit, level, betterDir, series };
}

function MetricCard({ label, value, unit, level, betterDir, series }: MetricCardProps) {
  const dir = series && series.length >= 2 ? trendDir(series) : "flat";
  // For "lower is better", a downward trend is good (green), upward is caution.
  const trendColor =
    dir === "flat" ? "text-ink-60"
      : (betterDir === "lower" ? dir === "down" : dir === "up") ? statusTextClass.optimal : statusTextClass.warning;

  return (
    <div className="rounded-xl border border-ink-10 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-ink-60">{label}</span>
        {level && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusHex[level] }} aria-label={STATUS_LABEL_TH[level]} />}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-head text-[20px] font-extrabold leading-none text-ink">{value != null ? value : "—"}</span>
        {value != null && unit && <span className="font-mono text-[10px] text-ink-60">{unit}</span>}
        {series && series.length >= 2 && (
          <span className={`ml-auto ${trendColor}`}><TrendArrow dir={dir} /></span>
        )}
      </div>
      {level && <div className="mt-1 text-[10px] font-semibold" style={{ color: statusTextHex[level] }}>{STATUS_LABEL_TH[level]}</div>}
    </div>
  );
}

/* ─────────────────────────── Insights Panel ─────────────────────────── */

const SEV_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-status-bg-danger", text: statusTextClass.danger, border: "border-status-danger/20" },
  watch: { bg: "bg-status-bg-caution", text: statusTextClass.caution, border: "border-status-caution/20" },
  info: { bg: "bg-status-bg-optimal", text: statusTextClass.optimal, border: "border-status-optimal/20" },
};

function InsightItem({ ins }: { ins: any }) {
  const s = SEV_STYLE[ins.severity] ?? SEV_STYLE.info;
  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} p-3`}>
      <div className={`font-thai text-[13px] font-semibold leading-snug ${s.text}`}>{ins.title}</div>
      {ins.detail && <p className={`mt-1 text-[11.5px] leading-snug ${s.text} opacity-90`}>{ins.detail}</p>}
      {ins.metric && <div className="mt-1 font-mono text-[9.5px] uppercase tracking-wide text-ink-60">{ins.metric}</div>}
      {ins.action && (
        ins.href ? (
          <a href={ins.href} className={`mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-semibold ${s.text}`}>
            {ins.action} <ArrowRight size={11} strokeWidth={2.5} aria-hidden />
          </a>
        ) : (
          <span className={`mt-2 inline-block rounded-full bg-white px-2.5 py-1 text-[10.5px] font-semibold ${s.text}`}>{ins.action}</span>
        )
      )}
    </div>
  );
}

function InsightsPanel({ insights }: { insights: Customer360["insights"] }) {
  const total = insights.alerts.length + insights.trends.length + insights.actions.length;
  return (
    <Card className="p-4 lg:p-5">
      <div className="mb-1 flex items-center gap-1.5">
        <Sparkles size={15} strokeWidth={2.25} className="text-rose" aria-hidden />
        <h2 className="font-head text-[15px] font-bold tracking-tight text-ink">สิ่งที่น่าสังเกต</h2>
      </div>
      <p className="mb-3 text-[12px] text-ink-60">{total > 0 ? `พบ ${total} เรื่องน่าสนใจ` : "ทุกอย่างดูดีค่ะ"}</p>

      {total === 0 ? (
        <div className="rounded-xl border border-status-optimal/20 bg-status-bg-optimal p-5 text-center">
          <Sparkles size={24} strokeWidth={1.75} className="mx-auto text-status-optimal" aria-hidden />
          <p className={`mt-2 font-thai text-[12.5px] ${statusTextClass.optimal}`}>ไม่มีสัญญาณที่ต้องกังวลตอนนี้</p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.alerts.length > 0 && (
            <Group icon={AlertTriangle} label="จุดที่ควรดู" count={insights.alerts.length} tone={statusTextClass.danger}>
              {insights.alerts.map((ins) => <InsightItem key={ins.id} ins={ins} />)}
            </Group>
          )}
          {insights.trends.length > 0 && (
            <Group icon={TrendingUp} label="แนวโน้ม" count={insights.trends.length} tone="text-ink-60">
              {insights.trends.map((ins) => <InsightItem key={ins.id} ins={ins} />)}
            </Group>
          )}
          {insights.actions.length > 0 && (
            <Group icon={Target} label="สิ่งที่ควรทำต่อ" count={insights.actions.length} tone="text-ink-60">
              {insights.actions.map((ins) => <InsightItem key={ins.id} ins={ins} />)}
            </Group>
          )}
        </div>
      )}

      <p className="mt-5 border-t border-ink-5 pt-4 font-thai text-[10.5px] leading-relaxed text-ink-60">
        ข้อมูลนี้ใช้สำหรับ wellness coaching เท่านั้น · ไม่ใช่การวินิจฉัยทางการแพทย์ · ค่าผิดปกติควรปรึกษาแพทย์เพื่อยืนยัน
      </p>
    </Card>
  );
}

function Group({ icon: Icon, label, count, tone, children }: { icon: any; label: string; count: number; tone: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={`mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${tone}`}>
        <Icon size={12} strokeWidth={2.25} aria-hidden /> {label} <span className="font-bold">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/* ─────────────────────────── Timeline ─────────────────────────── */

function relDays(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return "วันนี้";
  if (days === 1) return "เมื่อวาน";
  if (days < 7) return `${days} วันก่อน`;
  if (days < 30) return `${Math.floor(days / 7)} สัปดาห์ก่อน`;
  return `${Math.floor(days / 30)} เดือนก่อน`;
}

function TimelinePanel({ events }: { events: Customer360["timeline"] }) {
  return (
    <Card className="p-4 lg:p-5">
      <div className="mb-3 flex items-center gap-1.5">
        <Clock size={15} strokeWidth={2.25} className="text-rose" aria-hidden />
        <h2 className="font-head text-[15px] font-bold tracking-tight text-ink">ไทม์ไลน์ 90 วัน</h2>
        <span className="ml-auto font-mono text-[10px] text-ink-60">ใหม่ → เก่า</span>
      </div>
      {events.length === 0 ? (
        <EmptyState icon={Inbox} title="ยังไม่มีความเคลื่อนไหวใน 90 วัน" hint="ลองทักทายเพื่อเริ่มต้นความสัมพันธ์" />
      ) : (
        <ul className="relative space-y-3">
          <span className="absolute bottom-2 left-[18px] top-2 w-px bg-ink-10" aria-hidden />
          {events.map((e, i) => {
            const inner = (
              <div className="flex items-start gap-3.5">
                <span className="relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-10 bg-white text-base">{e.icon}</span>
                <div className="min-w-0 flex-1 pt-1.5">
                  <div className="font-thai text-[13px] leading-snug text-ink">{e.title}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-ink-60">
                    {new Date(e.date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })} · {relDays(e.date)}
                  </div>
                </div>
              </div>
            );
            return e.href ? <li key={i}><Link href={e.href as any} className="block transition-transform hover:translate-x-0.5">{inner}</Link></li> : <li key={i}>{inner}</li>;
          })}
        </ul>
      )}
    </Card>
  );
}

/* ─────────────────────────── Detail Tabs ─────────────────────────── */

type TabKey = "body" | "labs" | "trends" | "allergy" | "cgm" | "supplements" | "pulse" | "notes";

const TAB_DEFS: { key: TabKey; label: string; icon: any }[] = [
  { key: "body", label: "Body", icon: Activity },
  { key: "labs", label: "Labs", icon: FlaskConical },
  { key: "trends", label: "Trends", icon: TrendingUp },
  { key: "allergy", label: "Allergy", icon: Sparkles },
  { key: "cgm", label: "CGM", icon: Wifi },
  { key: "supplements", label: "Supplements", icon: Pill },
  { key: "pulse", label: "Pulse", icon: Smartphone },
  { key: "notes", label: "Notes", icon: NotebookPen },
];

function DetailTabs({ data, customerId }: { data: Customer360; customerId: string }) {
  const [tab, setTab] = useState<TabKey>("body");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const baseId = useId();
  const chronoAge = data.customer.chrono_age ?? resolveAge(data.customer);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % TAB_DEFS.length;
    if (e.key === "ArrowLeft") next = (idx - 1 + TAB_DEFS.length) % TAB_DEFS.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = TAB_DEFS.length - 1;
    setTab(TAB_DEFS[next].key);
    tabRefs.current[next]?.focus();
  };

  return (
    <Card className="p-4 lg:p-5">
      <h2 className="sr-only">รายละเอียดเพิ่มเติม</h2>
      <div role="tablist" aria-label="รายละเอียดลูกค้า — ใช้ปุ่มลูกศรซ้าย-ขวาเปลี่ยนแท็บ" className="mb-4 flex flex-wrap gap-1.5 border-b border-ink-5 pb-3">
        {TAB_DEFS.map((t, i) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              ref={(el) => { tabRefs.current[i] = el; }}
              role="tab"
              id={`${baseId}-tab-${t.key}`}
              aria-selected={active}
              aria-controls={`${baseId}-panel-${t.key}`}
              tabIndex={active ? 0 : -1}
              type="button"
              onClick={() => setTab(t.key)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 ${
                active ? "bg-ink text-white" : "border border-ink-10 bg-white text-ink-60 hover:border-ink-20 hover:text-ink"
              }`}
            >
              <Icon size={14} strokeWidth={2.25} aria-hidden /> {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`${baseId}-panel-${tab}`} aria-labelledby={`${baseId}-tab-${tab}`} tabIndex={0}>
        {tab === "body" && <BodyTab data={data} />}
        {tab === "labs" && <LabsTab customerId={customerId} chronoAge={chronoAge} />}
        {tab === "trends" && <TrendsTab customerId={customerId} chronoAge={chronoAge} />}
        {tab === "allergy" && <AllergyTab customerId={customerId} />}
        {tab === "cgm" && <CgmTab customerId={customerId} profiles={data.cgmProfiles} />}
        {tab === "supplements" && <SupplementsTab customerId={customerId} />}
        {tab === "pulse" && <PulseTab customerId={customerId} assessments={data.pulseAssessments} intake={data.pulseIntake} />}
        {tab === "notes" && <NotesTab customerId={customerId} />}
      </div>
    </Card>
  );
}

/* ── Body tab — BCA latest + history from the 360 payload (no extra fetch) ── */

function BodyTab({ data }: { data: Customer360 }) {
  const bca = data.bcaLatest;
  const height = data.customer.height as number | null;
  const chronoAge = data.customer.chrono_age ?? resolveAge(data.customer);
  const gender = data.customer.gender;
  const history = data.bcaHistory ?? [];

  if (!bca) {
    return (
      <EmptyState
        icon={Activity}
        title="ยังไม่มีผลวัดองค์ประกอบร่างกาย (BCA)"
        hint="บันทึกค่าครั้งแรกได้ที่หน้า BCA"
        action={
          <Link href={`/v2/bca?customer=${data.customer.id}`} className="inline-flex items-center gap-1.5 rounded-full bg-rose px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-mid">
            <Scale size={13} strokeWidth={2.25} aria-hidden /> ไปหน้า BCA
          </Link>
        }
      />
    );
  }

  const bmi = deriveBMI(bca.weight, height);
  const rows: { label: string; icon: any; value: string; level: StatusLevel | null }[] = [
    { label: "น้ำหนัก", icon: Weight, value: bca.weight != null ? `${bca.weight} kg` : "—", level: null },
    { label: "BMI", icon: Scale, value: bmi != null ? String(bmi) : "—", level: bmi != null ? classifyBMI(bmi) : null },
    { label: "Body fat", icon: Droplet, value: bca.fat_pct != null ? `${bca.fat_pct}%` : "—", level: null },
    { label: "Muscle", icon: Activity, value: bca.muscle_pct != null ? `${bca.muscle_pct}%` : "—", level: null },
    { label: "Visceral", icon: Heart, value: bca.visceral != null ? String(bca.visceral) : "—", level: bca.visceral != null ? classifyVisceralFat(bca.visceral) : null },
    { label: "Body age", icon: CalendarClock, value: bca.body_age != null ? `${bca.body_age} ปี` : "—", level: (bca.body_age != null && chronoAge != null) ? classifyBodyAge(bca.body_age, chronoAge) : null },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-ink-60">ผลวัดล่าสุด · {new Date(bca.recorded_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</span>
        <Link href={`/v2/bca?customer=${data.customer.id}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-rose hover:underline">
          เปิดหน้า BCA <ArrowRight size={12} strokeWidth={2.5} aria-hidden />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl border border-ink-10 bg-white p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-60">
              <r.icon size={13} strokeWidth={2.25} className="text-ink-40" aria-hidden /> {r.label}
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="font-head text-[18px] font-extrabold text-ink">{r.value}</span>
              {r.level && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusHex[r.level] }} aria-label={STATUS_LABEL_TH[r.level]} />}
            </div>
          </div>
        ))}
      </div>
      {history.length > 1 && (
        <div className="rounded-xl border border-ink-10 bg-surface/50 p-3">
          <div className="mb-1 text-[11px] font-semibold text-ink-60">ประวัติย้อนหลัง {history.length} ครั้ง</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink-60">
            {history.slice(0, 6).map((h, i) => (
              <span key={i}>
                {new Date(h.recorded_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}: {h.weight ?? "—"}kg
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
