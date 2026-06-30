"use client";

/**
 * UP Labs v2 · ★ UP Pulse hub (SPEC §7.6)
 * ────────────────────────────────────────
 * Customer picker (or ?customer=<id>) → reuses /api/customers/list for the picker
 * (gives connection status per row) and /api/pulse/customers/[id] for the selected
 * customer's connection + intake + assessments. Mandatory identity block (§4) on top.
 *
 * Mirrors v1 /app/pulse/page.tsx workflow (connect → intake → assess) but clinical-warm:
 *  - connection status + "จัดการอุปกรณ์" entry → /v2/pulse/master/[id]
 *  - intake link (create / regenerate) via /api/pulse/intakes
 *  - run AI assessment via /api/pulse/customers/[id]/assess
 *  - assessments list → preview (/v2/pulse/assessments/[id]) · publish (PATCH) · customer link
 *  - report shortcut → /v2/pulse/report/[id]
 *
 * Customer-facing flows (/connect, /intake) STAY on v1; we only generate + link to them.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity, Search, Users, ChevronRight, X, ArrowRight, Smartphone, ClipboardList,
  Brain, Link2, Copy, Check, RefreshCw, FileText, Eye, Send, Sparkles, AlertTriangle,
  ExternalLink, Loader2,
} from "lucide-react";
import { Shell } from "../_components/Shell";
import { IdentityBlock } from "@/lib/v2/IdentityBlock";
import { Card, LoadingState, EmptyState, ErrorState } from "@/lib/v2/ui";
import { initials, genderLabelWithGlyph, resolveAge, displayName } from "@/lib/v2/identity";
import { statusTextClass } from "@/lib/v2/status";
import type { Customer } from "@/lib/types";
import { ConnChip, StepState, fmtDateTime, type PulseListRow } from "./_lib";

/* ── /api/pulse/customers/[id] response shape (subset) ── */
interface Connection { id: string; provider: string; status: string; connected_at: string; last_sync_at: string | null; expires_at: string; }
interface Intake { id: string; token: string; submitted_at: string | null; expires_at: string; goal: string | null; budget_range: string | null; }
interface Assessment { id: string; status: string; blocked: boolean; block_reasons: string[]; share_token: string; sent_at: string | null; created_at: string; ai_output: any; }
interface PulseData {
  customer: Customer;
  connection: Connection | null;
  readings: { recorded_at: string; metric_type: string; value: number; unit: string }[];
  latest_invite: { token: string; expires_at: string; used_at: string | null } | null;
  latest_intake: Intake | null;
  assessments: Assessment[];
}

export default function V2PulsePage() {
  return (
    <Suspense fallback={<Shell breadcrumb={[{ label: "หน้าแรก", href: "/v2" }, { label: "UP Pulse" }]}><Card><LoadingState /></Card></Shell>}>
      <PulseInner />
    </Suspense>
  );
}

function PulseInner() {
  const search = useSearchParams();
  const router = useRouter();
  const customerId = search.get("customer");
  const breadcrumb = [{ label: "หน้าแรก", href: "/v2" }, { label: "ลูกค้า", href: "/v2/customers" }, { label: "UP Pulse" }];

  if (!customerId) {
    return (
      <Shell breadcrumb={breadcrumb}>
        <PickCustomer onPick={(id) => router.push(`/v2/pulse?customer=${id}`)} />
      </Shell>
    );
  }
  return (
    <Shell breadcrumb={breadcrumb}>
      <PulseWorkspace customerId={customerId} onClear={() => router.push("/v2/pulse")} />
    </Shell>
  );
}

/* ─────────────────────────── Customer picker ─────────────────────────── */

function PickCustomer({ onPick }: { onPick: (id: string) => void }) {
  const [rows, setRows] = useState<PulseListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    setError(null);
    setRows(null);
    fetch("/api/customers/list")
      .then((r) => r.json())
      .then((j) => { if (j.error) setError(j.error); else setRows(j.customers ?? []); })
      .catch((e) => setError(e.message ?? "load failed"));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !s || r.name.toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-5 text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-ultra text-rose">
          <Smartphone size={22} strokeWidth={2} aria-hidden />
        </span>
        <h1 className="mt-3 font-head text-[22px] font-extrabold tracking-tight text-ink">UP Pulse</h1>
        <p className="mt-1 font-thai text-[13px] text-ink-60">เลือกลูกค้าเพื่อเชื่อมอุปกรณ์ wearable และวิเคราะห์สุขภาพ</p>
      </div>

      <Card className="p-3">
        <div className="relative mb-2">
          <Search size={16} strokeWidth={2.25} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-30" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อลูกค้า…"
            aria-label="ค้นหาชื่อลูกค้า"
            className="w-full rounded-full border border-ink-10 bg-white py-2.5 pl-10 pr-4 text-[14px] outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:ring-2 focus:ring-rose-ultra"
          />
        </div>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !rows ? (
          <LoadingState label="กำลังโหลดรายชื่อ…" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title={q ? "ไม่พบลูกค้า" : "ยังไม่มีลูกค้า"} hint={q ? "ลองเปลี่ยนคำค้น" : undefined} />
        ) : (
          <ul className="max-h-[60vh] divide-y divide-ink-5 overflow-y-auto">
            {filtered.map((r) => {
              const age = resolveAge(r);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onPick(r.id)}
                    className="group flex min-h-[44px] w-full items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-surface focus:outline-none focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-5 text-[12px] font-bold text-ink-60">{initials(r.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-head text-[14px] font-bold text-ink">{r.name}</span>
                      <span className="block font-thai text-[11px] text-ink-60">
                        {genderLabelWithGlyph(r.gender)} {age != null ? `· ${age} ปี` : ""}
                      </span>
                    </span>
                    <ConnChip pulse={r.stats?.pulse ?? null} />
                    <ChevronRight size={16} strokeWidth={2.25} className="text-ink-20 group-hover:text-rose" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ─────────────────────────── Workspace ─────────────────────────── */

function PulseWorkspace({ customerId, onClear }: { customerId: string; onClear: () => void }) {
  const [data, setData] = useState<PulseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "intake" | "assess">(null);
  const [intakeUrl, setIntakeUrl] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pulse/customers/${customerId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "โหลดข้อมูลไม่สำเร็จ");
      setData(json);
    } catch (e: any) {
      setError(e.message ?? "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  const createIntake = async () => {
    setBusy("intake"); setActionMsg(null);
    try {
      const res = await fetch("/api/pulse/intakes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "สร้างลิงก์ไม่สำเร็จ");
      setIntakeUrl(json.url);
      await load();
    } catch (e: any) { setActionMsg(`⚠ ${e.message}`); }
    finally { setBusy(null); }
  };

  const runAssess = async () => {
    setBusy("assess"); setActionMsg(null);
    try {
      const res = await fetch(`/api/pulse/customers/${customerId}/assess`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "วิเคราะห์ไม่สำเร็จ");
      await load();
      setActionMsg(json.assessment?.blocked
        ? `AI วิเคราะห์เสร็จแล้ว — แต่ระบบ block: ${(json.assessment.block_reasons ?? []).join(" · ")}`
        : "AI วิเคราะห์เสร็จแล้ว — เปิด draft เพื่อตรวจ แล้วกด “เผยแพร่” เพื่อส่งลูกค้า");
    } catch (e: any) { setActionMsg(`⚠ ${e.message}`); }
    finally { setBusy(null); }
  };

  const publishAssessment = async (a: Assessment) => {
    if (!confirm("เผยแพร่รายงานนี้ให้ลูกค้า?")) return;
    try {
      const res = await fetch(`/api/pulse/assessments/${a.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "เผยแพร่ไม่สำเร็จ");
      await load();
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <Card><LoadingState label="กำลังโหลดข้อมูล UP Pulse…" /></Card>;
  if (error) return <Card><ErrorState message={error} onRetry={load} /></Card>;
  if (!data) return <Card><EmptyState title="ไม่พบลูกค้า" /></Card>;

  const c = data.customer;
  const connected = data.connection?.status === "connected";
  const intakeDone = !!data.latest_intake?.submitted_at;
  const hasReadings = (data.readings?.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      {/* Header: switch customer */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-ultra text-rose"><Smartphone size={16} strokeWidth={2} aria-hidden /></span>
          <h1 className="font-head text-[20px] font-extrabold tracking-tight text-ink">UP Pulse</h1>
          <span className="rounded-full bg-status-bg-caution px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-status-caution">beta</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/v2/customers/${customerId}`} className="inline-flex min-h-[44px] items-center gap-1 text-[12px] font-semibold text-ink-60 hover:text-rose">
            ดูโปรไฟล์ 360 <ArrowRight size={12} strokeWidth={2.5} aria-hidden />
          </Link>
          <button type="button" onClick={onClear} className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink">
            <X size={13} strokeWidth={2.25} aria-hidden /> เปลี่ยนลูกค้า
          </button>
        </div>
      </div>

      {/* ★ Identity block (SPEC §4) */}
      <IdentityBlock customer={c} editHref={`/customers/${customerId}`} />

      {/* Action result toast */}
      {actionMsg && (
        <div className="flex items-start gap-2 rounded-xl border border-ink-10 bg-surface px-3.5 py-2.5 font-thai text-[12.5px] text-ink-80">
          <Sparkles size={15} strokeWidth={2.25} className="mt-0.5 shrink-0 text-rose" aria-hidden />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Workflow: 3 steps */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Step 1 — connect device */}
        <StepCard step={1} title="เชื่อมอุปกรณ์ wearable" icon={Smartphone} done={connected}>
          <StepState done={connected} doneLabel="เชื่อมแล้ว" todoLabel="ยังไม่เชื่อม" />
          {connected && (
            <div className="mt-1 font-mono text-[10px] text-ink-60">
              {data.connection?.provider === "whoop" ? "WHOOP" : "Google Fit"} · sync ล่าสุด {fmtDateTime(data.connection?.last_sync_at ?? null)}
            </div>
          )}
          <Link
            href={`/v2/pulse/master/${customerId}`}
            className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-2 text-[12px] font-semibold text-ink-80 transition-colors hover:border-rose hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            <Activity size={14} strokeWidth={2.25} aria-hidden /> จัดการอุปกรณ์ &amp; นำเข้าข้อมูล
          </Link>
        </StepCard>

        {/* Step 2 — intake */}
        <StepCard step={2} title="แบบสอบถาม Intake (5 ข้อ)" icon={ClipboardList} done={intakeDone}>
          {intakeDone ? (
            <>
              <StepState done doneLabel="ส่งแล้ว" todoLabel="ยังไม่ส่ง" />
              <div className="mt-1 font-mono text-[10px] text-ink-60">{fmtDateTime(data.latest_intake!.submitted_at)}</div>
              <button type="button" onClick={createIntake} disabled={busy === "intake"} className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-[12px] font-semibold text-ink-60 hover:text-rose disabled:opacity-50">
                {busy === "intake" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <RefreshCw size={13} strokeWidth={2.25} aria-hidden />} สร้างลิงก์ใหม่
              </button>
            </>
          ) : (
            <IntakeLink
              url={intakeUrl ?? (data.latest_intake && !data.latest_intake.submitted_at ? `${siteUrl}/intake/${data.latest_intake.token}` : null)}
              creating={busy === "intake"}
              onCreate={createIntake}
            />
          )}
        </StepCard>

        {/* Step 3 — assess */}
        <StepCard step={3} title="วิเคราะห์ + แนะนำ (AI)" icon={Brain} done={(data.assessments?.length ?? 0) > 0}>
          <button
            type="button"
            onClick={runAssess}
            disabled={busy === "assess" || !connected || !intakeDone}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-rose-mid disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            {busy === "assess" ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Brain size={15} strokeWidth={2.25} aria-hidden />}
            {busy === "assess" ? "AI กำลังวิเคราะห์…" : "รัน AI Assessment"}
          </button>
          {(!connected || !intakeDone) && (
            <p className="mt-2 font-thai text-[11px] text-ink-60">ต้องเชื่อมอุปกรณ์ + ส่ง Intake ก่อนจึงวิเคราะห์ได้</p>
          )}
        </StepCard>
      </div>

      {/* Report shortcut */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4 lg:p-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-science-ultra text-science"><FileText size={17} strokeWidth={2} aria-hidden /></span>
          <div>
            <div className="font-head text-[15px] font-bold text-ink">รายงาน Wearable + Longevity</div>
            <p className="font-thai text-[12px] text-ink-60">{hasReadings ? "รวมข้อมูล wearable · ผลเลือด · Longevity L1–L4 · พิมพ์ PDF ได้" : "ยังไม่มีข้อมูล wearable — นำเข้าก่อนเพื่อสร้างรายงาน"}</p>
          </div>
        </div>
        <Link
          href={`/v2/pulse/report/${customerId}`}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-rose/30 bg-rose-ultra px-4 py-2 text-[13px] font-semibold text-rose transition-colors hover:bg-rose hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
        >
          <FileText size={15} strokeWidth={2.25} aria-hidden /> เปิดรายงาน
        </Link>
      </Card>

      {/* Assessments list */}
      <AssessmentsPanel
        assessments={data.assessments ?? []}
        siteUrl={siteUrl}
        onPublish={publishAssessment}
      />
    </div>
  );
}

/* ── Workflow step card ── */
function StepCard({ step, title, icon: Icon, done, children }: { step: number; title: string; icon: any; done: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-4 ${done ? "border-status-optimal/30 bg-status-bg-optimal/30" : "border-ink-10 bg-white"}`}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold ${done ? "bg-status-optimal text-white" : "bg-ink-5 text-ink-60"}`}>
          {done ? <Check size={14} strokeWidth={3} aria-hidden /> : step}
        </span>
        <div className="flex items-center gap-1.5">
          <Icon size={15} strokeWidth={2.25} className="text-ink-40" aria-hidden />
          <h2 className="font-head text-[14px] font-bold text-ink">{title}</h2>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ── Intake link generator ── */
function IntakeLink({ url, creating, onCreate }: { url: string | null; creating: boolean; onCreate: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!url) {
    return (
      <button type="button" onClick={onCreate} disabled={creating} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-rose-mid disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
        {creating ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Link2 size={15} strokeWidth={2.25} aria-hidden />} สร้างลิงก์ Intake
      </button>
    );
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("คัดลอกลิงก์นี้:", url); }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div>
      <div className="rounded-lg border border-ink-10 bg-surface px-2.5 py-2 font-mono text-[10.5px] text-ink-80 break-all">{url}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-rose-mid">
          {copied ? <Check size={13} strokeWidth={2.5} aria-hidden /> : <Copy size={13} strokeWidth={2.25} aria-hidden />} {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
        </button>
        <button type="button" onClick={onCreate} disabled={creating} className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink disabled:opacity-50">
          <RefreshCw size={12} strokeWidth={2.25} aria-hidden /> ใหม่
        </button>
      </div>
      <p className="mt-1.5 font-thai text-[11px] text-ink-60">ส่งลิงก์นี้ให้ลูกค้าทาง LINE เพื่อกรอกแบบสอบถาม</p>
    </div>
  );
}

/* ── Assessments list ── */
function AssessmentsPanel({ assessments, siteUrl, onPublish }: { assessments: Assessment[]; siteUrl: string; onPublish: (a: Assessment) => void }) {
  return (
    <Card className="p-4 lg:p-5">
      <div className="mb-3 flex items-center gap-1.5">
        <Sparkles size={15} strokeWidth={2.25} className="text-rose" aria-hidden />
        <h2 className="font-head text-[15px] font-bold text-ink">รายงานที่ AI วิเคราะห์</h2>
        <span className="ml-auto font-mono text-[10px] text-ink-60">{assessments.length} ฉบับ</span>
      </div>
      {assessments.length === 0 ? (
        <EmptyState icon={Brain} title="ยังไม่มีรายงาน" hint="เชื่อมอุปกรณ์ + ส่ง Intake แล้วกด “รัน AI Assessment” เพื่อสร้างรายงานฉบับแรก" />
      ) : (
        <ul className="space-y-3">
          {assessments.map((a) => <AssessmentRow key={a.id} a={a} siteUrl={siteUrl} onPublish={onPublish} />)}
        </ul>
      )}
    </Card>
  );
}

function AssessmentRow({ a, siteUrl, onPublish }: { a: Assessment; siteUrl: string; onPublish: (a: Assessment) => void }) {
  const [copied, setCopied] = useState(false);
  const reportUrl = `${siteUrl}/r/${a.share_token}`;
  const summary = a.ai_output?.summary ?? "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(reportUrl); } catch { window.prompt("คัดลอกลิงก์นี้:", reportUrl); }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  return (
    <li className={`rounded-xl border p-4 ${a.blocked ? "border-status-caution/30 bg-status-bg-caution/40" : a.sent_at ? "border-status-optimal/30 bg-white" : "border-ink-10 bg-white"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10.5px] text-ink-60">{new Date(a.created_at).toLocaleString("th-TH")}</span>
        <AssessmentBadge a={a} />
      </div>
      {a.blocked ? (
        <div className={`mt-2 flex items-start gap-1.5 font-thai text-[13px] ${statusTextClass.caution}`}>
          <AlertTriangle size={14} strokeWidth={2.25} className="mt-0.5 shrink-0" aria-hidden />
          <span>ขอให้ปรึกษาแพทย์ก่อน: {(a.block_reasons ?? []).join(" · ")}</span>
        </div>
      ) : (
        <p className="mt-2 line-clamp-2 font-thai text-[13px] leading-[1.6] text-ink">{summary || "—"}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/v2/pulse/assessments/${a.id}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink-80 transition-colors hover:border-rose hover:text-rose">
          <Eye size={14} strokeWidth={2.25} aria-hidden /> ดู (เฉพาะโค้ช)
        </Link>
        {a.sent_at ? (
          <>
            <a href={reportUrl} target="_blank" rel="noopener" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink-80 transition-colors hover:border-ink-20 hover:text-ink">
              <ExternalLink size={14} strokeWidth={2.25} aria-hidden /> มุมมองลูกค้า
            </a>
            <button type="button" onClick={copy} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-ink-5 px-3.5 py-1.5 text-[12px] font-semibold text-ink-60 transition-colors hover:bg-ink-10">
              {copied ? <Check size={14} strokeWidth={2.5} className="text-wellness" aria-hidden /> : <Link2 size={14} strokeWidth={2.25} aria-hidden />} {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์ลูกค้า"}
            </button>
          </>
        ) : !a.blocked ? (
          <button type="button" onClick={() => onPublish(a)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-rose-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
            <Send size={14} strokeWidth={2.25} aria-hidden /> เผยแพร่ให้ลูกค้า
          </button>
        ) : null}
      </div>
    </li>
  );
}

function AssessmentBadge({ a }: { a: Assessment }) {
  if (a.blocked) return <span className={`rounded-full bg-status-bg-caution px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTextClass.caution}`}>ปรึกษาแพทย์</span>;
  if (a.sent_at) return <span className={`rounded-full bg-status-bg-optimal px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTextClass.optimal}`}>เผยแพร่แล้ว</span>;
  return <span className="rounded-full bg-ink-5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-60">ฉบับร่าง</span>;
}
