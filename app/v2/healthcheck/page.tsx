"use client";

/**
 * UP Labs v2 · Health-Check Leads admin (SPEC §7.8)
 * ──────────────────────────────────────────────────
 * Coach-facing leads inbox for the public quizzes. The capture forms themselves
 * (/check/[coachId], /metaflex/[coachId]) STAY on v1 — this page only MANAGES the
 * leads they create: filter by quiz type + status, search, convert→customer,
 * status/contact tracking, and coach notes. Reuses /api/healthcheck/leads* + the
 * v1 risk classifier (lib/healthcheck/score) unchanged.
 *
 * Risk levels (low→very_high) map onto the v2 status tokens (one status system).
 * Leads render as a table on desktop and shed to cards on phones (no overflow).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, Copy, Check, ExternalLink, X, Phone, MessageCircle, Mail, ArrowRight,
  Inbox, FlaskConical, Activity, ChevronRight,
} from "lucide-react";
import { Shell } from "../_components/Shell";
import { Card, LoadingState, EmptyState, ErrorState } from "@/lib/v2/ui";
import { statusTextClass, statusTextHex, type StatusLevel } from "@/lib/v2/status";

interface Lead {
  id: string;
  coach_id: string | null;
  quiz_type: string;
  created_at: string;
  name: string;
  phone: string | null;
  email: string | null;
  line_id: string | null;
  consent_followup: boolean;
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  waist_cm: number | null;
  bmi: number | null;
  risk_score: number;
  risk_level: "low" | "moderate" | "high" | "very_high";
  flags: string[];
  answers: any;
  status: string;
  contacted_at: string | null;
  customer_id: string | null;
  notes: string | null;
}

/** Risk level → status token + Thai label. */
const RISK_META: Record<Lead["risk_level"], { level: StatusLevel; label: string }> = {
  low:       { level: "optimal", label: "ความเสี่ยงต่ำ" },
  moderate:  { level: "caution", label: "ปานกลาง" },
  high:      { level: "warning", label: "สูง" },
  very_high: { level: "danger", label: "สูงมาก" },
};

/** Defensive lookup — metaflex leads store non-standard risk_level strings
 *  (e.g. "WARNING ZONE ⚠️"), so fall back to the raw label instead of crashing. */
function riskMeta(level: string | null | undefined): { level: StatusLevel; label: string } {
  return RISK_META[level as Lead["risk_level"]] ?? { level: "caution", label: level || "—" };
}

const STATUS_META: Record<string, { label: string; level: StatusLevel | "neutral" }> = {
  new:       { label: "ใหม่", level: "good" },
  contacted: { label: "ติดต่อแล้ว", level: "caution" },
  converted: { label: "เป็นลูกค้า", level: "optimal" },
  dismissed: { label: "ปิด", level: "neutral" },
};

const STATUS_TABS = [
  { v: "all", label: "ทั้งหมด" },
  { v: "new", label: "ใหม่" },
  { v: "contacted", label: "ติดต่อแล้ว" },
  { v: "converted", label: "เป็นลูกค้า" },
  { v: "dismissed", label: "ปิด" },
];

const QUIZ_TABS = [
  { v: "all", label: "ทั้งหมด" },
  { v: "healthcheck", label: "Health Check" },
  { v: "metaflex", label: "MetaFlex" },
] as const;

function statusBgClass(lv: StatusLevel): string {
  return { optimal: "bg-status-bg-optimal", good: "bg-status-bg-good", caution: "bg-status-bg-caution", warning: "bg-status-bg-warning", danger: "bg-status-bg-danger" }[lv];
}

export default function V2HealthCheckPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("all");
  const [quizType, setQuizType] = useState<"all" | "healthcheck" | "metaflex">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [coachId, setCoachId] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const checkUrl = coachId ? `${origin}/check/${coachId}` : "";
  const metaflexUrl = coachId ? `${origin}/metaflex/${coachId}` : "";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/healthcheck/leads${tab !== "all" ? `?status=${tab}` : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "โหลด leads ไม่สำเร็จ");
      setLeads(json.leads ?? []);
    } catch (e: any) {
      setError(e.message);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/debug/me").then((r) => r.json()).then((d) => { if (d.user?.id) setCoachId(d.user.id); }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    let l = leads;
    if (quizType !== "all") l = l.filter((x) => x.quiz_type === quizType);
    if (search.trim()) {
      const s = search.toLowerCase();
      l = l.filter((x) => x.name.toLowerCase().includes(s) || x.phone?.includes(s) || x.line_id?.toLowerCase().includes(s));
    }
    return l;
  }, [leads, search, quizType]);

  const counts = useMemo(() => ({
    new: leads.filter((l) => l.status === "new").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
    converted: leads.filter((l) => l.status === "converted").length,
    high_risk: leads.filter((l) => l.risk_level === "high" || l.risk_level === "very_high").length,
  }), [leads]);

  const updateLead = async (id: string, patch: Partial<Lead>) => {
    try {
      const res = await fetch(`/api/healthcheck/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "อัปเดตไม่สำเร็จ");
      // keep the open modal in sync
      setSelected((s) => (s && s.id === id ? { ...s, ...patch } : s));
      load();
    } catch (e: any) { alert(e.message); }
  };

  const convertLead = async (id: string) => {
    if (!confirm("Convert lead นี้เป็นลูกค้าในระบบ?")) return;
    try {
      const res = await fetch(`/api/healthcheck/leads/${id}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "convert ไม่สำเร็จ");
      alert(`เพิ่มเป็นลูกค้าแล้ว · Customer ID: ${json.customer.id}`);
      setSelected(null);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const breadcrumb = [{ label: "หน้าแรก", href: "/v2" }, { label: "Health-Check Leads" }];

  return (
    <Shell breadcrumb={breadcrumb}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-head text-[24px] font-extrabold tracking-tight text-ink">Health-Check Leads</h1>
          <p className="mt-1 max-w-2xl font-thai text-[13px] text-ink-60">
            ดูแล lead ที่มาจากแบบประเมินสาธารณะ · กรองตามแบบ/สถานะ · แปลงเป็นลูกค้า · ติดตามการติดต่อ
          </p>
        </div>
        {!loading && !error && (
          <span className="rounded-full bg-ink-5 px-3 py-1 font-mono text-[11px] text-ink-60">
            {filtered.length === leads.length ? `${leads.length} lead` : `${filtered.length} / ${leads.length} lead`}
          </span>
        )}
      </div>

      {/* Share links to v1 public forms */}
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <ShareCard title="Health Check" tone="science" desc="ประเมิน metabolic ครบชุด · risk score · BMI · 6 หมวด" url={checkUrl} />
        <ShareCard title="MetaFlex Quiz" tone="rose" desc="วัด Metabolic Flexibility · 8 คำถามเร็ว ๆ" url={metaflexUrl} />
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="Lead ใหม่" value={counts.new} level="good" />
        <StatCard label="ติดต่อแล้ว" value={counts.contacted} level="caution" />
        <StatCard label="เป็นลูกค้าแล้ว" value={counts.converted} level="optimal" />
        <StatCard label="ความเสี่ยงสูง" value={counts.high_risk} level="danger" />
      </div>

      {/* Filters */}
      <Card className="mb-4 space-y-2.5 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12px] font-semibold text-ink-40">แบบประเมิน</span>
          {QUIZ_TABS.map((t) => (
            <FilterChip key={t.v} active={quizType === t.v} onClick={() => setQuizType(t.v)}>{t.label}</FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12px] font-semibold text-ink-40">สถานะ</span>
          {STATUS_TABS.map((t) => (
            <FilterChip key={t.v} active={tab === t.v} onClick={() => setTab(t.v)}>{t.label}</FilterChip>
          ))}
        </div>
        <div className="relative">
          <Search size={15} strokeWidth={2.25} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-30" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ / เบอร์ / LINE…"
            aria-label="ค้นหา lead"
            className="w-full rounded-full border border-ink-10 bg-surface/50 py-2 pl-9 pr-9 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:bg-white focus:ring-2 focus:ring-rose-ultra"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="ล้างคำค้น" className="absolute right-1.5 top-1/2 inline-flex h-[40px] w-[40px] -translate-y-1/2 items-center justify-center rounded-full text-ink-60 hover:bg-ink-5 hover:text-ink">
              <X size={15} strokeWidth={2.5} aria-hidden />
            </button>
          )}
        </div>
      </Card>

      {/* Leads */}
      {loading ? (
        <Card><LoadingState label="กำลังโหลด leads…" /></Card>
      ) : error ? (
        <Card><ErrorState message={error} onRetry={load} /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title={search || quizType !== "all" || tab !== "all" ? "ไม่พบ lead ตามตัวกรอง" : "ยังไม่มี lead"}
            hint={search || quizType !== "all" || tab !== "all" ? "ลองเปลี่ยนตัวกรอง" : "แชร์ลิงก์แบบประเมินด้านบนให้คนทำ → lead จะเข้ามาที่นี่"}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop table header */}
          <div className="hidden grid-cols-[1.6fr_0.9fr_0.9fr_0.8fr_auto] gap-3 border-b border-ink-5 bg-surface/60 px-4 py-2.5 text-[11px] font-semibold text-ink-40 lg:grid">
            <span>ชื่อ · ติดต่อ</span>
            <span>แบบประเมิน</span>
            <span>ความเสี่ยง</span>
            <span>สถานะ</span>
            <span className="text-right">เมื่อ</span>
          </div>
          <ul className="divide-y divide-ink-5">
            {filtered.map((l) => (
              <LeadRow key={l.id} lead={l} isMine={l.coach_id === coachId} onClick={() => setSelected(l)} />
            ))}
          </ul>
        </Card>
      )}

      {selected && (
        <LeadDetailModal
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdate={updateLead}
          onConvert={convertLead}
        />
      )}
    </Shell>
  );
}

/* ─────────────────────────── pieces ─────────────────────────── */

const SHARE_TONE = {
  science: { chip: "bg-science-ultra text-science", icon: FlaskConical },
  rose: { chip: "bg-rose-ultra text-rose", icon: Activity },
} as const;

function ShareCard({ title, desc, url, tone }: { title: string; desc: string; url: string; tone: keyof typeof SHARE_TONE }) {
  const [copied, setCopied] = useState(false);
  const t = SHARE_TONE[tone];
  const Icon = t.icon;
  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { window.prompt("คัดลอกลิงก์นี้:", url); }
  };
  return (
    <Card className="p-4">
      <div className="flex items-start gap-2.5">
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.chip}`}>
          <Icon size={17} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="font-head text-[15px] font-bold text-ink">{title}</div>
          <p className="mt-0.5 font-thai text-[12px] text-ink-60">{desc}</p>
        </div>
      </div>
      {url ? (
        <div className="mt-3 truncate rounded-lg bg-ink px-3 py-2 font-mono text-[11px] text-white">{url}</div>
      ) : (
        <div className="mt-3 h-9 animate-pulse rounded-lg bg-ink-10" />
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          disabled={!url}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-rose px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-rose-mid disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
        >
          {copied ? <><Check size={13} strokeWidth={2.5} aria-hidden /> คัดลอกแล้ว</> : <><Copy size={13} strokeWidth={2.25} aria-hidden /> คัดลอกลิงก์</>}
        </button>
        {url && (
          <a href={url} target="_blank" rel="noopener" className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60 transition-colors hover:border-ink-20 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
            <ExternalLink size={13} strokeWidth={2.25} aria-hidden /> ดูตัวอย่าง
          </a>
        )}
      </div>
    </Card>
  );
}

function StatCard({ label, value, level }: { label: string; value: number; level: StatusLevel }) {
  return (
    <Card className="px-4 py-3">
      <div className={`font-head text-[24px] font-extrabold leading-none ${statusTextClass[level]}`}>{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-ink-40">{label}</div>
    </Card>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[32px] rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-1 ${
        active ? "border-ink bg-ink text-white" : "border-ink-10 bg-white text-ink-60 hover:border-ink-20 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function QuizBadge({ type }: { type: string }) {
  const isHealth = type !== "metaflex";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isHealth ? "bg-science-ultra text-science" : "bg-rose-ultra text-rose"}`}>
      {isHealth ? "Health Check" : "MetaFlex"}
    </span>
  );
}

function RiskBadge({ level, score }: { level: Lead["risk_level"]; score: number }) {
  const m = riskMeta(level);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBgClass(m.level)} ${statusTextClass[m.level]}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusTextHex[m.level] }} aria-hidden />
      {score} · {m.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.new;
  if (m.level === "neutral") {
    return <span className="inline-flex items-center rounded-full bg-ink-5 px-2.5 py-1 text-[11px] font-semibold text-ink-60">{m.label}</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBgClass(m.level)} ${statusTextClass[m.level]}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusTextHex[m.level] }} aria-hidden />
      {m.label}
    </span>
  );
}

function LeadRow({ lead, isMine, onClick }: { lead: Lead; isMine: boolean; onClick: () => void }) {
  const when = new Date(lead.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group grid w-full grid-cols-1 items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-surface focus:outline-none focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose lg:grid-cols-[1.6fr_0.9fr_0.9fr_0.8fr_auto] lg:gap-3"
      >
        {/* Name + contact */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-head text-[14.5px] font-bold text-ink">{lead.name}</span>
            {!isMine && <span className="shrink-0 rounded-full bg-amber-ultra px-1.5 py-0.5 text-[10px] font-semibold text-amber">โค้ชอื่น</span>}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-ink-40">
            {lead.phone && <span>{lead.phone}</span>}
            {lead.line_id && <span>{lead.phone ? " · " : ""}LINE {lead.line_id}</span>}
            {!lead.phone && !lead.line_id && <span>ไม่มีข้อมูลติดต่อ</span>}
          </div>
          {/* Mobile inline badges */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 lg:hidden">
            <QuizBadge type={lead.quiz_type} />
            <RiskBadge level={lead.risk_level} score={lead.risk_score} />
            <StatusBadge status={lead.status} />
          </div>
        </div>

        {/* Desktop columns */}
        <div className="hidden lg:block"><QuizBadge type={lead.quiz_type} /></div>
        <div className="hidden lg:block"><RiskBadge level={lead.risk_level} score={lead.risk_score} /></div>
        <div className="hidden lg:block"><StatusBadge status={lead.status} /></div>
        <div className="hidden items-center justify-end gap-1.5 lg:flex">
          <span className="font-mono text-[11px] text-ink-30">{when}</span>
          <ChevronRight size={16} strokeWidth={2.25} className="text-ink-20 transition-all group-hover:translate-x-0.5 group-hover:text-rose" aria-hidden />
        </div>
      </button>
    </li>
  );
}

/* ─────────────────────────── Detail modal ─────────────────────────── */

function LeadDetailModal({ lead, onClose, onUpdate, onConvert }: {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Lead>) => void;
  onConvert: (id: string) => void;
}) {
  const [notes, setNotes] = useState(lead.notes ?? "");
  const risk = riskMeta(lead.risk_level);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const phoneClean = lead.phone ? lead.phone.replace(/[^0-9+]/g, "") : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`รายละเอียด lead ${lead.name}`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4"
      onClick={onClose}
    >
      <div className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-ink-10 bg-white shadow-[0_24px_60px_-24px_rgba(24,21,26,0.45)]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-ink-10 bg-surface px-5 py-4 lg:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-head text-[20px] font-extrabold tracking-tight text-ink">{lead.name}</h2>
              <QuizBadge type={lead.quiz_type} />
              <StatusBadge status={lead.status} />
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-ink-40">
              {new Date(lead.created_at).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-ink-60 transition-colors hover:bg-ink-5 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
            <X size={18} strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5 lg:px-6">
          {/* Risk + BMI */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl ${statusBgClass(risk.level)} p-4 text-center`}>
              <div className={`text-[11px] font-semibold ${statusTextClass[risk.level]}`}>คะแนนความเสี่ยง</div>
              <div className="mt-1 font-head text-[34px] font-extrabold leading-none" style={{ color: statusTextHex[risk.level] }}>{lead.risk_score}</div>
              <div className={`mt-1 text-[12px] font-semibold ${statusTextClass[risk.level]}`}>{risk.label}</div>
            </div>
            <div className="rounded-xl border border-ink-10 bg-surface/50 p-4 text-center">
              <div className="text-[11px] font-semibold text-ink-40">BMI</div>
              <div className="mt-1 font-head text-[34px] font-extrabold leading-none text-ink">{lead.bmi != null ? lead.bmi : "—"}</div>
            </div>
          </div>

          {/* Contact */}
          <Field title="ติดต่อ">
            <div className="flex flex-wrap gap-2">
              {phoneClean && (
                <a href={`tel:${phoneClean}`} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-80 hover:border-rose hover:text-rose">
                  <Phone size={13} strokeWidth={2.25} aria-hidden /> {lead.phone}
                </a>
              )}
              {lead.line_id && (
                <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-80">
                  <MessageCircle size={13} strokeWidth={2.25} aria-hidden /> {lead.line_id}
                </span>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-80 hover:border-rose hover:text-rose">
                  <Mail size={13} strokeWidth={2.25} aria-hidden /> {lead.email}
                </a>
              )}
            </div>
            <div className="mt-2 text-[12px] text-ink-60">
              ยินยอมให้ติดต่อ: {lead.consent_followup ? <span className={statusTextClass.optimal}>ใช่</span> : <span className="text-ink-40">ไม่</span>}
            </div>
          </Field>

          {/* Demographics */}
          <Field title="ข้อมูลพื้นฐาน">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="อายุ" value={lead.age != null ? `${lead.age} ปี` : "—"} />
              <Stat label="เพศ" value={lead.gender === "male" ? "ชาย" : lead.gender === "female" ? "หญิง" : "—"} />
              <Stat label="ส่วนสูง" value={lead.height_cm ? `${lead.height_cm} ซม.` : "—"} />
              <Stat label="น้ำหนัก" value={lead.weight_kg ? `${lead.weight_kg} กก.` : "—"} />
              <Stat label="รอบเอว" value={lead.waist_cm ? `${lead.waist_cm} ซม.` : "—"} />
            </div>
          </Field>

          {/* Flags */}
          {lead.flags.length > 0 && (
            <Field title="ปัจจัยที่พบ">
              <ul className="space-y-1">
                {lead.flags.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 font-thai text-[13px] text-ink-80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose" aria-hidden />{f}
                  </li>
                ))}
              </ul>
            </Field>
          )}

          {/* Notes */}
          <Field title="หมายเหตุ (โค้ช)">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="บันทึกเกี่ยวกับ lead นี้…"
              aria-label="หมายเหตุของโค้ช"
              className="w-full resize-y rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:ring-2 focus:ring-rose-ultra"
            />
            <button
              type="button"
              onClick={() => onUpdate(lead.id, { notes })}
              className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-1.5 text-[12px] font-semibold text-ink-80 transition-colors hover:border-rose hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
            >
              <Check size={13} strokeWidth={2.5} aria-hidden /> บันทึกหมายเหตุ
            </button>
          </Field>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 border-t border-ink-5 pt-4">
            {lead.status === "new" && (
              <button type="button" onClick={() => onUpdate(lead.id, { status: "contacted" })}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-ink-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
                <Check size={14} strokeWidth={2.5} aria-hidden /> ทำเครื่องหมายว่าติดต่อแล้ว
              </button>
            )}
            {lead.status !== "converted" && (
              <button type="button" onClick={() => onConvert(lead.id)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-rose-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
                <ArrowRight size={14} strokeWidth={2.5} aria-hidden /> แปลงเป็นลูกค้า
              </button>
            )}
            {lead.status !== "dismissed" && lead.status !== "converted" && (
              <button type="button" onClick={() => onUpdate(lead.id, { status: "dismissed" })}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-2 text-[12px] font-semibold text-ink-60 transition-colors hover:border-ink-20 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
                ปิด lead
              </button>
            )}
            {lead.customer_id && (
              <Link href={`/v2/customers/${lead.customer_id}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-wellness/20 bg-wellness-ultra px-4 py-2 text-[12px] font-semibold text-wellness transition-colors hover:bg-wellness hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2">
                เปิดโปรไฟล์ลูกค้า <ArrowRight size={14} strokeWidth={2.5} aria-hidden />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[12px] font-semibold text-ink-60">{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-10 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold text-ink-40">{label}</div>
      <div className="mt-0.5 font-head text-[15px] font-bold text-ink">{value}</div>
    </div>
  );
}
