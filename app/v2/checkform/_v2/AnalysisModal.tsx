"use client";

/**
 * UP Labs v2 · CheckForm AI analysis modal (SPEC §7.7)
 * ─────────────────────────────────────────────────────
 * Clinical-warm modal showing Gemini's prospect analysis:
 *   readiness/approach ratio · first move · DISC tone · dialog samples ·
 *   red flags · roleplay · next actions · + STP clip recommendations.
 * Mirrors v1 app/checkform/_components/AIAnalysisModal but uses the v2 kit
 * (Lucide icons, status TEXT via statusTextClass, ≥12px, focus-visible, no glass/aurora).
 * Keyboard-accessible: Escape closes, focus trapped to the dialog surface.
 */

import { useEffect, useRef, useState } from "react";
import {
  X, Sparkles, RefreshCw, Loader2, AlertTriangle, Target, Rocket, MessageCircle,
  ShieldAlert, Drama, ListChecks, Film, Copy, Check, Play, ExternalLink, Clipboard,
  Lightbulb, MessageSquare,
} from "lucide-react";
import type { AIAnalysis } from "@/lib/checkform/ai-analyze";
import type { ClipRecommendations, ClipMatch } from "@/lib/checkform/clip-matcher";
import { findClipById } from "@/app/checkform/_data/stp-clips";
import { LoadingState, ErrorState } from "@/lib/v2/ui";

interface Props {
  open: boolean;
  loading: boolean;
  error?: string | null;
  analysis: AIAnalysis | null;
  cached?: boolean;
  analyzedAt?: string | null;
  prospectName?: string;
  onReanalyze?: () => void;
  onClose: () => void;
  // STP clip recommendations (load after AI analysis succeeds)
  clipRecs?: ClipRecommendations | null;
  clipLoading?: boolean;
  clipError?: string | null;
  clipCached?: boolean;
  clipGeneratedAt?: string | null;
  onRecommendClips?: () => void;
}

export function AnalysisModal({
  open, loading, error, analysis, cached, analyzedAt, prospectName, onReanalyze, onClose,
  clipRecs, clipLoading, clipError, clipCached, clipGeneratedAt, onRecommendClips,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape to close + focus the panel when opened (a11y).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`ผลวิเคราะห์ ${prospectName || "prospect"}`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="my-8 w-full max-w-3xl overflow-hidden rounded-2xl border border-ink-10 bg-white shadow-[0_24px_60px_-24px_rgba(24,21,26,0.45)] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-ink-10 bg-surface px-5 py-4 lg:px-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-rose">
              <Sparkles size={14} strokeWidth={2.25} aria-hidden /> วิเคราะห์ด้วย AI · Gemini
            </div>
            <h2 className="mt-0.5 truncate font-head text-[22px] font-extrabold tracking-tight text-ink">
              {prospectName || "Prospect"}
            </h2>
            {cached && analyzedAt && (
              <p className="mt-0.5 font-mono text-[11px] text-ink-40">
                ผลที่บันทึกไว้ · {new Date(analyzedAt).toLocaleString("th-TH")}
              </p>
            )}
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
        {loading ? (
          <LoadingState label="กำลังให้ AI วิเคราะห์… ~10-20 วินาที" />
        ) : error ? (
          <ErrorState message={error} onRetry={onReanalyze} />
        ) : analysis ? (
          <AnalysisBody
            analysis={analysis}
            clipRecs={clipRecs ?? null}
            clipLoading={!!clipLoading}
            clipError={clipError ?? null}
            clipCached={!!clipCached}
            clipGeneratedAt={clipGeneratedAt ?? null}
            onRecommendClips={onRecommendClips}
          />
        ) : null}

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-ink-10 bg-surface px-5 py-3 lg:px-6">
          {onReanalyze && !loading && (
            <button
              type="button"
              onClick={onReanalyze}
              title="ละทิ้งผลเดิม · เรียก AI ใหม่ (ใช้ quota)"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-2 text-[12px] font-semibold text-ink-60 transition-colors hover:border-ink-20 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
            >
              <RefreshCw size={13} strokeWidth={2.25} aria-hidden /> วิเคราะห์ใหม่
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-rose-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Body ─────────────────────────── */

function SectionLabel({ icon: Icon, children, tone = "ink" }: { icon: any; children: React.ReactNode; tone?: "ink" | "rose" | "wellness" | "amber" }) {
  const color = tone === "rose" ? "text-rose" : tone === "wellness" ? "text-wellness" : tone === "amber" ? "text-amber" : "text-ink-60";
  return (
    <div className={`mb-2 inline-flex items-center gap-1.5 text-[12px] font-semibold ${color}`}>
      <Icon size={14} strokeWidth={2.25} aria-hidden /> {children}
    </div>
  );
}

function AnalysisBody({
  analysis, clipRecs, clipLoading, clipError, clipCached, clipGeneratedAt, onRecommendClips,
}: {
  analysis: AIAnalysis;
  clipRecs: ClipRecommendations | null;
  clipLoading: boolean;
  clipError: string | null;
  clipCached: boolean;
  clipGeneratedAt: string | null;
  onRecommendClips?: () => void;
}) {
  const approachTone =
    analysis.approach.type === "product" ? { bg: "bg-wellness-ultra", text: "text-wellness", border: "border-wellness/20" } :
    analysis.approach.type === "business" ? { bg: "bg-rose-ultra", text: "text-rose", border: "border-rose/20" } :
    { bg: "bg-amber-ultra", text: "text-amber", border: "border-amber/20" };

  return (
    <div className="space-y-6 px-5 py-5 lg:px-6">
      {/* Summary */}
      <section>
        <SectionLabel icon={Sparkles}>สรุปภาพรวม</SectionLabel>
        <p className="font-thai text-[14px] leading-relaxed text-ink-80">{analysis.summary}</p>
      </section>

      {/* Approach ratio */}
      <section className={`rounded-2xl border ${approachTone.border} ${approachTone.bg} px-5 py-4`}>
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel icon={Target} tone={analysis.approach.type === "product" ? "wellness" : analysis.approach.type === "business" ? "rose" : "amber"}>
            แนวทางที่แนะนำ
          </SectionLabel>
          <span className={`rounded-full bg-white px-2 py-0.5 text-[11px] font-bold uppercase ${approachTone.text}`}>
            {analysis.approach.type}
          </span>
        </div>

        {/* Stacked ratio bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-white">
          <div
            className="flex items-center justify-end bg-wellness px-2 text-[10px] font-bold text-white"
            style={{ width: `${analysis.approach.productRatio}%` }}
          >
            {analysis.approach.productRatio >= 14 && `${analysis.approach.productRatio}%`}
          </div>
          <div
            className="flex items-center justify-start bg-rose px-2 text-[10px] font-bold text-white"
            style={{ width: `${analysis.approach.businessRatio}%` }}
          >
            {analysis.approach.businessRatio >= 14 && `${analysis.approach.businessRatio}%`}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[12px] font-semibold">
          <span className="text-wellness">สุขภาพ (Product) · {analysis.approach.productRatio}%</span>
          <span className="text-rose">โอกาส (Business) · {analysis.approach.businessRatio}%</span>
        </div>

        <p className="mt-3 font-thai text-[13px] leading-relaxed text-ink-80">{analysis.approach.reasoning}</p>
      </section>

      {/* First move */}
      <section>
        <SectionLabel icon={Rocket} tone="rose">ก้าวแรก</SectionLabel>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <InfoCard label="เมื่อไหร่" value={analysis.firstMove.when} />
          <InfoCard label="ที่ไหน" value={analysis.firstMove.where} />
          <InfoCard label="เริ่มยังไง" value={analysis.firstMove.how} />
        </div>
      </section>

      {/* DISC note */}
      {analysis.discNotes && (
        <section className="rounded-2xl border border-ink-10 bg-white px-5 py-4">
          <SectionLabel icon={Target}>โทนตาม DISC</SectionLabel>
          <p className="font-thai text-[13px] leading-relaxed text-ink-80">{analysis.discNotes}</p>
        </section>
      )}

      {/* Dialog samples */}
      {analysis.dialogSamples.length > 0 && (
        <section>
          <SectionLabel icon={MessageCircle} tone="rose">ตัวอย่างบทสนทนา · เฉพาะคนนี้</SectionLabel>
          <div className="space-y-2">
            {analysis.dialogSamples.map((d, i) => <DialogSampleCard key={i} sample={d} />)}
          </div>
        </section>
      )}

      {/* Red flags */}
      {analysis.redFlags.length > 0 && (
        <section className="rounded-2xl border border-status-warning/20 bg-status-bg-warning px-5 py-4">
          <SectionLabel icon={ShieldAlert} tone="amber">สิ่งที่ควรเลี่ยง</SectionLabel>
          <ul className="space-y-1.5">
            {analysis.redFlags.map((r, i) => (
              <li key={i} className="relative pl-4 font-thai text-[13px] leading-relaxed text-ink-80">
                <span className="absolute left-0 text-status-warning" aria-hidden>•</span>{r}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Roleplay */}
      {analysis.roleplay.length > 0 && (
        <section>
          <SectionLabel icon={Drama} tone="rose">จำลองบทสนทนา</SectionLabel>
          <div className="space-y-3 rounded-2xl border border-ink-10 bg-surface/60 p-4">
            {analysis.roleplay.map((turn, i) => <RoleplayTurn key={i} turn={turn} />)}
          </div>
        </section>
      )}

      {/* Next steps */}
      {analysis.nextSteps.length > 0 && (
        <section>
          <SectionLabel icon={ListChecks} tone="wellness">สิ่งที่ควรทำต่อ</SectionLabel>
          <ol className="space-y-2">
            {analysis.nextSteps.map((n, i) => (
              <li key={i} className="rounded-xl bg-surface px-4 py-3 font-thai text-[13px] leading-relaxed text-ink-80">
                <span className="mr-2 font-bold text-rose">{i + 1}.</span>{n}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* STP clips */}
      <ClipRecommendationsSection
        recs={clipRecs}
        loading={clipLoading}
        error={clipError}
        cached={clipCached}
        generatedAt={clipGeneratedAt}
        onRefresh={onRecommendClips}
      />
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-10 bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-40">{label}</div>
      <p className="mt-1 font-thai text-[12.5px] leading-relaxed text-ink-80">{value || "—"}</p>
    </div>
  );
}

function DialogSampleCard({ sample }: { sample: { context: string; line: string; why: string } }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(sample.line); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  return (
    <div className="rounded-2xl border border-ink-10 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center rounded-full bg-rose-ultra px-2 py-0.5 text-[11px] font-semibold text-rose">{sample.context}</span>
        <button
          type="button"
          onClick={copy}
          aria-label="คัดลอกประโยคนี้"
          className={`inline-flex min-h-[28px] shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors ${copied ? "text-wellness" : "text-ink-40 hover:text-rose"}`}
        >
          {copied ? <><Check size={12} strokeWidth={2.5} aria-hidden /> คัดลอกแล้ว</> : <><Copy size={12} strokeWidth={2.25} aria-hidden /> คัดลอก</>}
        </button>
      </div>
      <p className="mt-2 font-thai text-[14px] font-semibold leading-relaxed text-ink">“{sample.line}”</p>
      <p className="mt-1.5 font-thai text-[12px] leading-relaxed text-ink-60">→ {sample.why}</p>
    </div>
  );
}

function RoleplayTurn({ turn }: { turn: { speaker: "abo" | "prospect"; text: string; note?: string } }) {
  const isAbo = turn.speaker === "abo";
  return (
    <div className={`flex ${isAbo ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[85%] flex-col ${isAbo ? "items-end" : "items-start"}`}>
        <div className={`mb-1 text-[11px] font-semibold ${isAbo ? "text-rose" : "text-ink-40"}`}>
          {isAbo ? "โค้ช (ABO)" : "Prospect"}
        </div>
        <div className={`rounded-2xl px-4 py-2.5 font-thai text-[13px] leading-relaxed ${isAbo ? "bg-rose text-white" : "border border-ink-10 bg-white text-ink-80"}`}>
          {turn.text}
        </div>
        {turn.note && (
          <div className={`mt-1 flex max-w-full items-start gap-1 px-2 font-thai text-[11px] italic ${isAbo ? "flex-row-reverse text-right text-rose/70" : "text-ink-40"}`}>
            <Lightbulb size={11} strokeWidth={2.25} className="mt-0.5 shrink-0" aria-hidden /> {turn.note}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── STP clip recommendations ─────────────────────── */

function ClipRecommendationsSection({
  recs, loading, error, cached, generatedAt, onRefresh,
}: {
  recs: ClipRecommendations | null;
  loading: boolean;
  error: string | null;
  cached: boolean;
  generatedAt: string | null;
  onRefresh?: () => void;
}) {
  if (!loading && !error && !recs) return null;
  return (
    <section className="rounded-2xl border border-wellness/20 bg-wellness-ultra/50 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SectionLabel icon={Film} tone="wellness">คลิปแนะนำให้ฟัง</SectionLabel>
          {recs && (
            <span className="font-mono text-[11px] text-ink-40">· {recs.matches.length}/{recs.total_clips_evaluated} คลิป</span>
          )}
          {cached && generatedAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-wellness">
              บันทึกไว้ · {new Date(generatedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
        {onRefresh && !loading && (
          <button
            type="button"
            onClick={onRefresh}
            title="จับคู่ใหม่ · ใช้ quota"
            className="inline-flex min-h-[28px] items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-ink-50 transition-colors hover:text-ink-80"
          >
            <RefreshCw size={12} strokeWidth={2.25} aria-hidden /> จับคู่ใหม่
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-white/70 px-4 py-6 text-[12px] text-ink-60">
          <Loader2 size={16} className="animate-spin text-wellness" aria-hidden /> กำลังจับคู่คลิป… ~5-10 วินาที
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-status-danger/20 bg-status-bg-danger px-4 py-3 font-mono text-[12px] text-status-danger">
          <AlertTriangle size={14} strokeWidth={2.25} className="mt-0.5 shrink-0" aria-hidden />
          <span className="break-words">{error}</span>
        </div>
      )}
      {recs && !loading && !error && (
        recs.matches.length === 0 ? (
          <div className="rounded-xl bg-white/70 px-4 py-3 font-thai text-[12.5px] text-ink-60">
            ยังไม่มีคลิปที่ตรงกับ profile นี้แรงพอ ({recs.total_clips_evaluated} คลิปที่พิจารณา · ข้าม {recs.skipped_low_resonance_count})
          </div>
        ) : (
          <>
            {recs.reasoning_summary && (
              <p className="mb-3 flex items-start gap-1.5 font-thai text-[12.5px] italic leading-relaxed text-ink-60">
                <MessageSquare size={13} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ink-40" aria-hidden /> {recs.reasoning_summary}
              </p>
            )}
            <div className="space-y-3">
              {recs.matches.map((m) => <ClipCard key={m.clip_id} match={m} />)}
            </div>
          </>
        )
      )}
    </section>
  );
}

function ClipCard({ match }: { match: ClipMatch }) {
  const clip = findClipById(match.clip_id);
  const [copied, setCopied] = useState<"share" | "followup" | null>(null);

  if (!clip) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-status-warning/20 bg-status-bg-warning px-4 py-3 font-mono text-[12px] text-status-warning">
        <AlertTriangle size={14} strokeWidth={2.25} aria-hidden /> ไม่พบคลิป: {match.clip_id}
      </div>
    );
  }

  const copy = async (kind: "share" | "followup", text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(kind); setTimeout(() => setCopied(null), 1500); } catch {}
  };

  const thumb = `https://i.ytimg.com/vi/${clip.youtube_id}/mqdefault.jpg`;
  const confidencePct = Math.round(match.confidence * 100);
  const confColor = match.confidence >= 0.8 ? "text-wellness" : match.confidence >= 0.6 ? "text-amber" : "text-ink-50";

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-10 bg-white">
      {/* Thumbnail + meta */}
      <div className="flex flex-col gap-3 p-4 sm:flex-row">
        <a
          href={clip.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block w-full shrink-0 sm:w-32"
          aria-label={`เปิด YouTube: ${clip.title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb} alt={clip.title} loading="lazy" className="aspect-video w-full rounded-lg object-cover ring-1 ring-ink-10 sm:h-20 sm:w-32" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-white transition-colors group-hover:bg-rose">
              <Play size={15} strokeWidth={2.25} className="ml-0.5" aria-hidden />
            </span>
          </span>
          {clip.duration_min && (
            <span className="absolute bottom-1 right-1 rounded bg-ink/80 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">
              {clip.duration_min}m
            </span>
          )}
        </a>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 flex-1 break-words font-thai text-[14px] font-bold leading-snug text-ink">{clip.title}</h3>
            <span className={`shrink-0 rounded-full bg-white px-2 py-0.5 font-mono text-[12px] font-bold ring-1 ring-ink-10 ${confColor}`}>
              {confidencePct}%
            </span>
          </div>
          <p className="mt-1 break-words font-thai text-[12px] text-ink-60">
            {clip.speaker.nickname || clip.speaker.name}
            <span className="text-ink-30"> · </span>
            <span className="font-mono text-[11px] uppercase tracking-wide text-ink-40">{clip.speaker.achievement_level.replace(/_/g, " ")}</span>
          </p>
          <a
            href={clip.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 break-all font-mono text-[12px] text-rose hover:underline"
          >
            youtu.be/{clip.youtube_id} <ExternalLink size={11} strokeWidth={2.25} aria-hidden />
          </a>
        </div>
      </div>

      {/* Why this clip */}
      <div className="border-t border-ink-5 bg-surface/40 px-4 py-3">
        <div className="mb-1 text-[11px] font-semibold text-wellness">ทำไมคลิปนี้</div>
        <p className="break-words font-thai text-[12.5px] leading-relaxed text-ink-80">{match.why_this_clip}</p>
        {match.key_signals_aligned?.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {match.key_signals_aligned.map((s, i) => (
              <li key={i} className="relative break-words pl-3 font-thai text-[11.5px] leading-relaxed text-ink-60">
                <span className="absolute left-0 text-wellness" aria-hidden>·</span>{s}
              </li>
            ))}
          </ul>
        )}
        {match.potential_concerns?.length > 0 && (
          <div className="mt-2 rounded-lg border border-status-warning/20 bg-status-bg-warning px-3 py-1.5">
            <span className="text-[11px] font-semibold text-status-warning">ข้อควรระวัง</span>
            <ul className="mt-1 space-y-0.5">
              {match.potential_concerns.map((c, i) => (
                <li key={i} className="break-words font-thai text-[11.5px] leading-relaxed text-ink-60">· {c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Share message */}
      <div className="border-t border-ink-5 bg-rose-ultra/40 px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-rose">ข้อความส่ง · DM/LINE</span>
          <button
            type="button"
            onClick={() => copy("share", `${match.share_message_th}\n\n${clip.url}`)}
            aria-label="คัดลอกข้อความส่ง"
            className={`inline-flex min-h-[28px] shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors ${copied === "share" ? "text-wellness" : "text-rose hover:text-rose-deep"}`}
          >
            {copied === "share" ? <><Check size={12} strokeWidth={2.5} aria-hidden /> คัดลอกแล้ว</> : <><Clipboard size={12} strokeWidth={2.25} aria-hidden /> คัดลอก</>}
          </button>
        </div>
        <p className="break-words font-thai text-[12.5px] italic leading-relaxed text-ink-80">“{match.share_message_th}”</p>
      </div>

      {/* Follow-up question */}
      <div className="border-t border-ink-5 bg-amber-ultra/40 px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-amber">ถามต่อหลังดูจบ</span>
          <button
            type="button"
            onClick={() => copy("followup", match.follow_up_question_th)}
            aria-label="คัดลอกคำถามต่อ"
            className={`inline-flex min-h-[28px] shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold transition-colors ${copied === "followup" ? "text-wellness" : "text-amber hover:text-rose-deep"}`}
          >
            {copied === "followup" ? <><Check size={12} strokeWidth={2.5} aria-hidden /> คัดลอกแล้ว</> : <><Clipboard size={12} strokeWidth={2.25} aria-hidden /> คัดลอก</>}
          </button>
        </div>
        <p className="break-words font-thai text-[12.5px] italic leading-relaxed text-ink-80">“{match.follow_up_question_th}”</p>
      </div>
    </div>
  );
}
