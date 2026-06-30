"use client";

/**
 * UP Labs v2 · ★ UP Pulse — Assessment detail (SPEC §7.6) — clinical-warm.
 * ───────────────────────────────────────────────────────────────────────
 * Coach view of one AI assessment: ai_output (summary · observations · behaviour
 * changes · nutrient recommendations · next step · data notes) + blocked banner +
 * publish (PATCH status:sent) + public customer share link.
 *
 * Reuses /api/pulse/assessments/[id] (GET full row incl. ai_output + customers{name};
 * PATCH to publish) — no API change. Renders the same ai_output shape as the v1
 * ReportView but with the v2 design language (Lucide, status tokens, ≥12px).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles, ArrowLeft, ListChecks, Lightbulb, Pill, Flag, Info, Eye, Send, Link2, Copy,
  Check, AlertTriangle, Loader2, FileText,
} from "lucide-react";
import { Shell } from "../../../_components/Shell";
import { Card, LoadingState, EmptyState, ErrorState } from "@/lib/v2/ui";
import { statusTextClass } from "@/lib/v2/status";

interface AiOutput {
  summary?: string;
  observations?: string[];
  behavior_changes?: Array<{ title: string; why: string; how: string }>;
  nutrient_recommendations?: Array<{ category: string; why: string; evidence_grade: string; skus: Array<{ sku: string; dose: string; timing?: string }> }>;
  data_notes?: string[];
  next_step?: string;
}
interface Assessment {
  id: string;
  ai_output: AiOutput | null;
  blocked: boolean;
  block_reasons: string[] | null;
  sent_at: string | null;
  created_at: string;
  share_token: string;
  customer_id: string;
  customers?: { id: string; name: string } | null;
}

export default function V2AssessmentPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [a, setA] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setA(null);
    fetch(`/api/pulse/assessments/${id}`)
      .then((r) => r.json())
      .then((j) => { if (j.error) setError(j.error); else setA(j.assessment); })
      .catch((e) => setError(e.message ?? "load failed"));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const publish = async () => {
    if (!a || !confirm("เผยแพร่รายงานนี้ให้ลูกค้า?")) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/pulse/assessments/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "เผยแพร่ไม่สำเร็จ");
      load();
    } catch (e: any) { alert(e.message); }
    finally { setPublishing(false); }
  };

  const name = a?.customers?.name ?? "ลูกค้า";
  const breadcrumb = [
    { label: "หน้าแรก", href: "/v2" },
    { label: "UP Pulse", href: "/v2/pulse" },
    ...(a?.customer_id ? [{ label: name, href: `/v2/pulse?customer=${a.customer_id}` }] : []),
    { label: "รายงาน AI" },
  ];

  if (error) return <Shell breadcrumb={breadcrumb}><Card><ErrorState message={error} onRetry={load} /></Card></Shell>;
  if (!a) return <Shell breadcrumb={breadcrumb}><Card><LoadingState label="กำลังโหลดรายงาน…" /></Card></Shell>;

  const ai = a.ai_output;
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
  const reportUrl = `${siteUrl}/r/${a.share_token}`;

  return (
    <Shell breadcrumb={breadcrumb}>
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-ultra text-rose"><Sparkles size={16} strokeWidth={2} aria-hidden /></span>
            <h1 className="font-head text-[20px] font-extrabold tracking-tight text-ink">รายงานที่ AI วิเคราะห์</h1>
            <StatusPill a={a} />
          </div>
          <Link href={a.customer_id ? `/v2/pulse?customer=${a.customer_id}` : "/v2/pulse"} className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink">
            <ArrowLeft size={13} strokeWidth={2.25} aria-hidden /> กลับ
          </Link>
        </div>

        {/* Meta + actions */}
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="font-head text-[15px] font-bold text-ink">สำหรับ {name}</div>
            <div className="mt-0.5 font-mono text-[11px] text-ink-60">{a.sent_at ? "เผยแพร่แล้ว · " : "ฉบับร่าง · "}จัดทำ {new Date(a.created_at).toLocaleString("th-TH")}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {a.sent_at ? (
              <>
                <a href={reportUrl} target="_blank" rel="noopener" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink-80 hover:border-ink-20 hover:text-ink">
                  <Eye size={14} strokeWidth={2.25} aria-hidden /> มุมมองลูกค้า
                </a>
                <CopyLink url={reportUrl} />
              </>
            ) : !a.blocked ? (
              <button type="button" onClick={publish} disabled={publishing} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-4 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-rose-mid disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
                {publishing ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} strokeWidth={2.25} aria-hidden />} เผยแพร่ให้ลูกค้า
              </button>
            ) : null}
          </div>
        </Card>

        {/* Blocked banner */}
        {a.blocked && (
          <Card className="border-status-caution/30 bg-status-bg-caution/40 p-5">
            <div className={`flex items-center gap-2 font-head text-[16px] font-bold ${statusTextClass.caution}`}>
              <AlertTriangle size={18} strokeWidth={2.25} aria-hidden /> ขอให้ปรึกษาแพทย์ก่อน
            </div>
            <p className={`mt-2 font-thai text-[13px] leading-[1.7] ${statusTextClass.caution}`}>
              จากข้อมูลของลูกค้า มีปัจจัยที่ควรตรวจกับแพทย์ก่อน ระบบจึงยังไม่แนะนำ supplement
            </p>
            {(a.block_reasons?.length ?? 0) > 0 && (
              <ul className={`mt-3 space-y-1 font-thai text-[13px] ${statusTextClass.caution}`}>
                {a.block_reasons!.map((r, i) => <li key={i}>• {r}</li>)}
              </ul>
            )}
          </Card>
        )}

        {/* Preview-mode note */}
        {!a.sent_at && !a.blocked && (
          <div className="flex items-start gap-2 rounded-xl border border-status-caution/30 bg-status-bg-caution/40 px-3.5 py-2.5 font-thai text-[12.5px] text-status-caution">
            <Eye size={15} strokeWidth={2.25} className="mt-0.5 shrink-0" aria-hidden />
            <span>โหมดดูตัวอย่าง — ลูกค้ายังเห็นไม่ได้ จนกว่าจะกด “เผยแพร่ให้ลูกค้า”</span>
          </div>
        )}

        {/* Empty ai_output */}
        {!a.blocked && !ai && (
          <Card><EmptyState icon={FileText} title="ยังไม่มีเนื้อหารายงาน" hint="รายงานนี้ยังไม่มีผลวิเคราะห์ของ AI" /></Card>
        )}

        {/* Summary */}
        {ai?.summary && (
          <SectionCard icon={Sparkles} title="สรุป">
            <p className="font-thai text-[15px] leading-[1.8] text-ink">{ai.summary}</p>
          </SectionCard>
        )}

        {/* Observations */}
        {(ai?.observations?.length ?? 0) > 0 && (
          <SectionCard icon={ListChecks} title="สิ่งที่สังเกตได้">
            <ul className="space-y-2">
              {ai!.observations!.map((o, i) => (
                <li key={i} className="flex gap-2.5 font-thai text-[14px] leading-[1.7] text-ink">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose" aria-hidden />{o}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Behaviour changes */}
        {(ai?.behavior_changes?.length ?? 0) > 0 && (
          <div className="space-y-3">
            <SectionLabel icon={Lightbulb} title="พฤติกรรมที่ลองปรับ" />
            {ai!.behavior_changes!.map((bc, i) => (
              <Card key={i} className="p-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wellness-ultra font-head text-[15px] font-extrabold text-wellness">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-head text-[16px] font-bold text-ink">{bc.title}</h3>
                    <p className="mt-1.5 font-thai text-[13px] leading-[1.7] text-ink-60">{bc.why}</p>
                    <div className="mt-3 rounded-xl bg-wellness-ultra px-4 py-3">
                      <div className="text-[11px] font-semibold text-wellness">วิธีลอง</div>
                      <p className="mt-1 font-thai text-[13px] leading-[1.6] text-ink">{bc.how}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Nutrient recommendations */}
        {(ai?.nutrient_recommendations?.length ?? 0) > 0 && (
          <div className="space-y-3">
            <SectionLabel icon={Pill} title="Supplement ที่อาจช่วย" />
            {ai!.nutrient_recommendations!.map((rec, i) => (
              <Card key={i} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-head text-[16px] font-bold text-ink">{rec.category}</h3>
                    <p className="mt-1.5 font-thai text-[13px] leading-[1.7] text-ink-60">{rec.why}</p>
                  </div>
                  <GradeBadge grade={rec.evidence_grade} />
                </div>
                {(rec.skus?.length ?? 0) > 0 && (
                  <div className="mt-4 space-y-2">
                    {rec.skus.map((s, j) => (
                      <div key={j} className="rounded-xl bg-surface px-4 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="font-head text-[14px] font-bold text-rose">{s.sku}</div>
                          <div className="font-mono text-[12px] text-ink">{s.dose}</div>
                        </div>
                        {s.timing && <div className="mt-1 font-thai text-[11px] text-ink-60">⏰ {s.timing}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Next step */}
        {ai?.next_step && (
          <Card className="border-2 border-rose bg-rose-ultra p-5">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-rose">
              <Flag size={14} strokeWidth={2.25} aria-hidden /> ขั้นต่อไป
            </div>
            <p className="mt-2 font-thai text-[15px] leading-[1.7] text-ink">{ai.next_step}</p>
          </Card>
        )}

        {/* Data notes */}
        {(ai?.data_notes?.length ?? 0) > 0 && (
          <Card className="bg-ink-5/40 p-5">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-60">
              <Info size={14} strokeWidth={2.25} aria-hidden /> หมายเหตุข้อมูล
            </div>
            <ul className="mt-2 space-y-1 font-thai text-[12px] leading-[1.6] text-ink-60">
              {ai!.data_notes!.map((n, i) => <li key={i}>· {n}</li>)}
            </ul>
          </Card>
        )}

        {/* Disclaimer */}
        <div className="rounded-2xl border border-ink-10 bg-ink-5/50 px-5 py-4 font-thai text-[11px] leading-[1.6] text-ink-60">
          <strong className="text-ink">หมายเหตุ:</strong> เอกสารฉบับนี้คือ wellness recommendation เพื่อการดูแลตัวเองในชีวิตประจำวัน · ไม่ใช่การวินิจฉัยทางการแพทย์ · ถ้ามีโรคประจำตัว · ตั้งครรภ์ · ให้นมบุตร · หรือกินยาประจำ ขอให้ปรึกษาแพทย์ก่อนเริ่ม supplement
        </div>
      </div>
    </Shell>
  );
}

/* ── components ── */

function SectionLabel({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-60">
      <Icon size={14} strokeWidth={2.25} className="text-rose" aria-hidden /> {title}
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon size={15} strokeWidth={2.25} className="text-rose" aria-hidden />
        <h2 className="font-head text-[15px] font-bold text-ink">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

function StatusPill({ a }: { a: Assessment }) {
  if (a.blocked) return <span className={`rounded-full bg-status-bg-caution px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTextClass.caution}`}>ปรึกษาแพทย์</span>;
  if (a.sent_at) return <span className={`rounded-full bg-status-bg-optimal px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTextClass.optimal}`}>เผยแพร่แล้ว</span>;
  return <span className="rounded-full bg-ink-5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-60">ฉบับร่าง</span>;
}

function GradeBadge({ grade }: { grade: string }) {
  const map: Record<string, { fg: string; bg: string }> = {
    A: { fg: "#15803D", bg: "#DCFCE7" },
    B: { fg: "#854D0E", bg: "#FEF9C3" },
    C: { fg: "#991B1B", bg: "#FEE2E2" },
  };
  const g = map[grade] ?? map.C;
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-head text-base font-extrabold" style={{ background: g.bg, color: g.fg }} aria-label={`evidence grade ${grade}`}>
      {grade}
    </span>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("คัดลอกลิงก์นี้:", url); }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button type="button" onClick={copy} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-ink-5 px-3.5 py-1.5 text-[12px] font-semibold text-ink-60 transition-colors hover:bg-ink-10">
      {copied ? <Check size={14} strokeWidth={2.5} className="text-wellness" aria-hidden /> : <Link2 size={14} strokeWidth={2.25} aria-hidden />} {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์ลูกค้า"}
    </button>
  );
}
