"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { AIAnalysis } from "@/lib/checkform/ai-analyze";
import type { ClipRecommendations, ClipMatch } from "@/lib/checkform/clip-matcher";
import { findClipById } from "../_data/stp-clips";

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
  // STP clip recommendations (optional · loads after AI analysis succeeds)
  clipRecs?: ClipRecommendations | null;
  clipLoading?: boolean;
  clipError?: string | null;
  clipCached?: boolean;
  clipGeneratedAt?: string | null;
  onRecommendClips?: () => void;
}

export function AIAnalysisModal({
  open, loading, error, analysis, cached, analyzedAt, prospectName, onReanalyze, onClose,
  clipRecs, clipLoading, clipError, clipCached, clipGeneratedAt, onRecommendClips,
}: Props) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl my-8 overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-ink-10 bg-gradient-to-br from-rose-ultra via-warm-white to-amber-ultra px-7 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2">
                <span className="relative h-2 w-2">
                  <span className="absolute inset-0 rounded-full bg-rose" />
                  <span className="absolute inset-0 rounded-full bg-rose animate-ping opacity-70" />
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-rose font-bold">AI Analysis · Gemini</span>
              </div>
              <h2 className="mt-1 font-head text-[24px] lg:text-[28px] font-extrabold tracking-tight text-ink">
                {prospectName || "Prospect"}
              </h2>
              {cached && analyzedAt && (
                <p className="mt-1 font-mono text-[10px] text-ink-40">
                  cached · {new Date(analyzedAt).toLocaleString("th-TH")}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="close"
              className="h-9 w-9 rounded-full bg-white/80 text-ink-60 hover:bg-white hover:text-ink transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorPanel error={error} onClose={onClose} />
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
        <div className="flex items-center justify-between gap-3 border-t border-ink-10 bg-surface px-7 py-4">
          {onReanalyze && !loading && (
            <button
              onClick={onReanalyze}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-2 text-[12px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink transition-colors"
              title="ละทิ้ง cache · เรียก AI ใหม่ (ใช้ quota)"
            >
              🔄 วิเคราะห์ใหม่
            </button>
          )}
          <div className="ml-auto">
            <Button variant="rose" size="sm" onClick={onClose}>ปิด</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────── */

function Loading() {
  return (
    <div className="px-7 py-12 text-center">
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-ultra to-amber-ultra text-2xl ring-1 ring-rose-pale animate-pulse">
        🤖
      </div>
      <div className="mt-4 font-head text-[18px] font-extrabold text-ink">กำลังให้ AI วิเคราะห์...</div>
      <p className="mt-2 font-thai text-[13px] text-ink-60">~10-20 วินาที · กำลังคิดอย่างละเอียด</p>
      <div className="mt-6 space-y-2 max-w-md mx-auto text-left">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-ink-5 animate-pulse" style={{ width: `${80 - i * 15}%` }} />
        ))}
      </div>
    </div>
  );
}

/** True when the failure is about the Gemini API key (bad/expired/revoked/missing/restricted). */
function isGeminiKeyError(msg: string): boolean {
  const s = (msg || "").toLowerCase();
  return (
    s.includes("gemini_key_invalid") ||
    s.includes("api key not valid") ||
    s.includes("api_key_invalid") ||
    s.includes("invalid_argument") ||
    s.includes("permission_denied") ||
    s.includes("กรุณาใส่ api key")
  );
}

function ErrorPanel({ error, onClose }: { error: string; onClose: () => void }) {
  // Key problem → guide the user to get a fresh (free) key instead of showing a raw error.
  if (isGeminiKeyError(error)) {
    return (
      <div className="px-7 py-10 text-center">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-ultra text-2xl ring-1 ring-ink-10">
          🔑
        </div>
        <div className="mt-4 font-head text-[17px] font-extrabold text-ink">คีย์ Gemini ใช้ไม่ได้แล้ว</div>
        <p className="mt-2 max-w-md mx-auto font-thai text-[13px] leading-relaxed text-ink-80">
          คีย์ AI ที่ใส่ไว้หมดอายุหรือไม่ถูกต้อง — ขอคีย์ใหม่ได้ <b>ฟรี</b> จาก Google AI Studio
          แล้วกด <b>⚙️ เปลี่ยนคีย์</b> ด้านบนของหน้าเพื่อวางคีย์ใหม่ จากนั้นกด “วิเคราะห์ใหม่”
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-wellness px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-wellness-deep"
          >
            🔑 ขอคีย์ใหม่ (ฟรี) ที่ Google AI Studio
          </a>
          <Button variant="ghost" size="sm" onClick={onClose}>ปิด</Button>
        </div>
        <p className="mt-4 font-thai text-[11px] text-ink-40">
          🔐 คีย์เก็บในเบราว์เซอร์นี้เท่านั้น · ใส่ครั้งเดียวใช้ได้ทั้ง CheckForm และ NutriScan
        </p>
      </div>
    );
  }

  return (
    <div className="px-7 py-10 text-center">
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-status-bg-danger text-2xl">
        ⚠
      </div>
      <div className="mt-4 font-head text-[16px] font-extrabold text-status-danger">วิเคราะห์ไม่สำเร็จ</div>
      <p className="mt-2 max-w-md mx-auto font-mono text-[11px] text-ink-60 break-words">{error}</p>
      <p className="mt-3 font-thai text-[12px] text-ink-50">ลองกด “วิเคราะห์ใหม่” อีกครั้ง · ถ้ายังไม่หายแจ้งทีมช่วยเหลือ</p>
      <Button variant="ghost" size="sm" onClick={onClose} className="mt-4">ปิด</Button>
    </div>
  );
}

function AnalysisBody({
  analysis,
  clipRecs,
  clipLoading,
  clipError,
  clipCached,
  clipGeneratedAt,
  onRecommendClips,
}: {
  analysis: AIAnalysis;
  clipRecs: ClipRecommendations | null;
  clipLoading: boolean;
  clipError: string | null;
  clipCached: boolean;
  clipGeneratedAt: string | null;
  onRecommendClips?: () => void;
}) {
  const approachTheme =
    analysis.approach.type === "product" ? { bg: "bg-wellness-ultra", text: "text-wellness", ring: "ring-wellness-pale" } :
    analysis.approach.type === "business" ? { bg: "bg-rose-ultra", text: "text-rose", ring: "ring-rose-pale" } :
    { bg: "bg-amber-ultra", text: "text-amber", ring: "ring-amber-pale" };

  return (
    <div className="px-7 py-6 space-y-6">
      {/* Summary */}
      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 font-bold mb-2">📝 Summary</div>
        <p className="font-thai text-[14px] leading-relaxed text-ink-80">{analysis.summary}</p>
      </section>

      {/* Approach ratio */}
      <section className={`rounded-2xl ${approachTheme.bg} px-5 py-5 ring-1 ${approachTheme.ring}`}>
        <div className="flex items-center justify-between mb-3">
          <div className={`font-mono text-[10px] uppercase tracking-[0.14em] font-bold ${approachTheme.text}`}>🎯 Approach Recommendation</div>
          <span className={`text-[11px] font-bold uppercase font-mono ${approachTheme.text}`}>{analysis.approach.type}</span>
        </div>

        {/* Stacked bar */}
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-ink-5">
          <div className="bg-wellness flex items-center justify-end px-2 text-[10px] font-bold text-white" style={{ width: `${analysis.approach.productRatio}%` }}>
            {analysis.approach.productRatio >= 12 && `${analysis.approach.productRatio}%`}
          </div>
          <div className="bg-rose flex items-center justify-start px-2 text-[10px] font-bold text-white" style={{ width: `${analysis.approach.businessRatio}%` }}>
            {analysis.approach.businessRatio >= 12 && `${analysis.approach.businessRatio}%`}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
          <span className="text-wellness font-bold">🌿 Product · {analysis.approach.productRatio}%</span>
          <span className="text-rose font-bold">💼 Business · {analysis.approach.businessRatio}%</span>
        </div>

        <p className="mt-4 font-thai text-[13px] leading-relaxed text-ink-80">{analysis.approach.reasoning}</p>
      </section>

      {/* First Move */}
      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 font-bold mb-2">🚀 First Move</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <FirstMoveCard label="เมื่อไหร่" value={analysis.firstMove.when} />
          <FirstMoveCard label="ที่ไหน"    value={analysis.firstMove.where} />
          <FirstMoveCard label="เริ่มยังไง" value={analysis.firstMove.how} />
        </div>
      </section>

      {/* DISC note */}
      {analysis.discNotes && (
        <section className="rounded-2xl border border-ink-10 bg-white px-5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 font-bold mb-2">🎯 DISC tone</div>
          <p className="font-thai text-[13px] leading-relaxed text-ink-80">{analysis.discNotes}</p>
        </section>
      )}

      {/* Dialog samples */}
      {analysis.dialogSamples.length > 0 && (
        <section>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 font-bold mb-3">💬 Sample Dialogs · personalized</div>
          <div className="space-y-2">
            {analysis.dialogSamples.map((d, i) => (
              <DialogSampleCard key={i} sample={d} />
            ))}
          </div>
        </section>
      )}

      {/* Red flags */}
      {analysis.redFlags.length > 0 && (
        <section className="rounded-2xl border border-status-bg-warning bg-status-bg-warning/40 px-5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-status-warning font-bold mb-2">⚠ Avoid</div>
          <ul className="space-y-1.5">
            {analysis.redFlags.map((r, i) => (
              <li key={i} className="font-thai text-[13px] leading-relaxed text-ink-80 pl-4 relative">
                <span className="absolute left-0 text-status-warning">•</span>{r}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Roleplay */}
      {analysis.roleplay.length > 0 && (
        <section>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 font-bold mb-3">🎭 Roleplay · จำลองบทสนทนา</div>
          <div className="rounded-3xl border border-ink-10 bg-gradient-to-br from-warm-white to-rose-ultra/30 p-4 space-y-3">
            {analysis.roleplay.map((turn, i) => (
              <RoleplayTurn key={i} turn={turn} />
            ))}
          </div>
        </section>
      )}

      {/* Next steps */}
      {analysis.nextSteps.length > 0 && (
        <section>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 font-bold mb-3">📋 Next Steps</div>
          <ul className="space-y-2">
            {analysis.nextSteps.map((n, i) => (
              <li key={i} className="rounded-xl bg-surface px-4 py-3 font-thai text-[13px] leading-relaxed text-ink-80">
                <span className="font-bold text-rose mr-2">{i + 1}.</span>{n}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── STP Clip Recommendations ─────────────────────────── */}
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
    <section className="rounded-3xl border border-wellness-pale bg-gradient-to-br from-wellness-ultra/40 via-warm-white to-amber-ultra/30 p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-wellness-deep font-bold">
            🎬 คลิปแนะนำให้ฟัง
          </span>
          {recs && (
            <span className="font-mono text-[9px] text-ink-40">
              · STP Matcher · {recs.matches.length}/{recs.total_clips_evaluated} clips
            </span>
          )}
          {cached && generatedAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-wellness-ultra px-1.5 py-0.5 font-mono text-[9px] font-bold text-wellness-deep ring-1 ring-wellness-pale">
              💾 cached · {new Date(generatedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
        {onRefresh && !loading && (
          <button
            onClick={onRefresh}
            className="font-mono text-[10px] text-ink-50 hover:text-ink-80 underline-offset-2 hover:underline"
            title="วิเคราะห์ใหม่ · ใช้ quota"
          >
            🔄 จับคู่ใหม่
          </button>
        )}
      </div>

      {loading && <ClipLoading />}
      {error && (
        <div className="rounded-xl bg-status-bg-danger/40 px-4 py-3 font-mono text-[11px] text-status-danger break-words">
          ⚠ {error}
        </div>
      )}
      {recs && !loading && !error && (
        <>
          {recs.matches.length === 0 ? (
            <div className="rounded-xl bg-white/70 px-4 py-3 font-thai text-[12px] text-ink-60">
              ยังไม่มีคลิปที่ match กับ profile นี้แรงพอ ({recs.total_clips_evaluated} clips evaluated · skip {recs.skipped_low_resonance_count})
            </div>
          ) : (
            <>
              {recs.reasoning_summary && (
                <p className="mb-3 font-thai text-[12px] leading-relaxed text-ink-60 italic">
                  💭 {recs.reasoning_summary}
                </p>
              )}
              <div className="space-y-3">
                {recs.matches.map((m) => (
                  <ClipCard key={m.clip_id} match={m} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

function ClipLoading() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-white/70 p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="h-20 w-32 shrink-0 rounded-lg bg-ink-5" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 rounded bg-ink-5" />
              <div className="h-3 w-1/2 rounded bg-ink-5" />
              <div className="h-3 w-5/6 rounded bg-ink-5" />
            </div>
          </div>
        </div>
      ))}
      <p className="font-mono text-[10px] text-ink-40 text-center">~5-10 วินาที · กำลังจับคู่คลิป...</p>
    </div>
  );
}

function ClipCard({ match }: { match: ClipMatch }) {
  const clip = findClipById(match.clip_id);
  const [copied, setCopied] = useState<"share" | "followup" | null>(null);

  if (!clip) {
    // Defensive: matcher returned an unknown clip_id (already filtered server-side, but stay safe)
    return (
      <div className="rounded-xl bg-status-bg-warning/40 px-4 py-3 font-mono text-[11px] text-status-warning">
        ⚠ clip_id ไม่พบ: {match.clip_id}
      </div>
    );
  }

  const copy = async (kind: "share" | "followup", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };

  const thumb = `https://i.ytimg.com/vi/${clip.youtube_id}/mqdefault.jpg`;
  const confidencePct = Math.round(match.confidence * 100);
  const confColor =
    match.confidence >= 0.8 ? "text-wellness" :
    match.confidence >= 0.6 ? "text-amber" :
    "text-ink-50";

  return (
    <div className="rounded-2xl border border-ink-10 bg-white overflow-hidden shadow-[0_2px_8px_-4px_rgba(0,0,0,0.06)]">
      {/* Top: thumbnail + meta — stacks on mobile, side-by-side on sm+ */}
      <div className="flex flex-col sm:flex-row gap-3 p-4">
        <a
          href={clip.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative shrink-0 block w-full sm:w-32"
          aria-label={`เปิด YouTube: ${clip.title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt={clip.title}
            className="aspect-video w-full sm:h-20 sm:w-32 rounded-lg object-cover ring-1 ring-ink-10"
            loading="lazy"
          />
          {/* Dark gradient overlay for play-button readability */}
          <span className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-br from-ink/0 via-ink/0 to-ink/30 group-hover:to-ink/50 transition-colors" />
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-white text-[14px] pl-0.5 group-hover:bg-rose transition-colors">
              ▶
            </span>
          </span>
          {clip.duration_min && (
            <span className="absolute bottom-1 right-1 rounded bg-ink/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
              {clip.duration_min}m
            </span>
          )}
        </a>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-thai text-[14px] font-bold text-ink leading-snug break-words flex-1 min-w-0">
              {clip.title}
            </h3>
            <span className={`shrink-0 rounded-full bg-white px-2 py-0.5 font-mono text-[11px] font-bold ring-1 ring-ink-10 ${confColor}`}>
              {confidencePct}%
            </span>
          </div>
          <p className="mt-1 font-thai text-[11.5px] text-ink-60 break-words">
            {clip.speaker.nickname || clip.speaker.name}
            <span className="text-ink-30"> · </span>
            <span className="font-mono uppercase text-[9px] text-ink-40 tracking-wide">
              {clip.speaker.achievement_level.replace(/_/g, " ")}
            </span>
          </p>
          <a
            href={clip.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] text-rose hover:underline underline-offset-2 break-all"
          >
            <span>youtu.be/{clip.youtube_id}</span>
            <span aria-hidden>↗</span>
          </a>
        </div>
      </div>

      {/* Why this clip */}
      <div className="border-t border-ink-5 px-4 py-3 bg-surface/40">
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-wellness-deep font-bold mb-1">
          💡 ทำไมคลิปนี้
        </div>
        <p className="font-thai text-[12px] leading-relaxed text-ink-80 break-words">{match.why_this_clip}</p>
        {match.key_signals_aligned && match.key_signals_aligned.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {match.key_signals_aligned.map((s, i) => (
              <li key={i} className="font-thai text-[10.5px] leading-relaxed text-ink-50 pl-3 relative break-words">
                <span className="absolute left-0 text-wellness">·</span>{s}
              </li>
            ))}
          </ul>
        )}
        {match.potential_concerns && match.potential_concerns.length > 0 && (
          <div className="mt-2 rounded-lg bg-status-bg-warning/40 px-3 py-1.5">
            <span className="font-mono text-[9px] uppercase font-bold text-status-warning">⚠ concerns</span>
            <ul className="mt-1 space-y-0.5">
              {match.potential_concerns.map((c, i) => (
                <li key={i} className="font-thai text-[10.5px] leading-relaxed text-ink-60 break-words">· {c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Share message · copy-ready */}
      <div className="border-t border-ink-5 px-4 py-3 bg-rose-ultra/30">
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-rose font-bold">
            💬 ข้อความส่ง · DM/LINE
          </span>
          <button
            onClick={() => copy("share", `${match.share_message_th}\n\n${clip.url}`)}
            className={`shrink-0 font-mono text-[10px] font-bold transition-colors ${copied === "share" ? "text-wellness" : "text-rose hover:text-rose-deep"}`}
          >
            {copied === "share" ? "✓ copied" : "📋 copy"}
          </button>
        </div>
        <p className="font-thai text-[12.5px] leading-relaxed text-ink-80 italic break-words">"{match.share_message_th}"</p>
      </div>

      {/* Follow-up question */}
      <div className="border-t border-ink-5 px-4 py-3 bg-amber-ultra/30">
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-amber font-bold">
            🎯 ถามต่อหลังดูจบ
          </span>
          <button
            onClick={() => copy("followup", match.follow_up_question_th)}
            className={`shrink-0 font-mono text-[10px] font-bold transition-colors ${copied === "followup" ? "text-wellness" : "text-amber hover:text-rose-deep"}`}
          >
            {copied === "followup" ? "✓ copied" : "📋 copy"}
          </button>
        </div>
        <p className="font-thai text-[12.5px] leading-relaxed text-ink-80 italic break-words">"{match.follow_up_question_th}"</p>
      </div>
    </div>
  );
}

function FirstMoveCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-10 bg-white px-4 py-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-40 font-bold">{label}</div>
      <p className="mt-1 font-thai text-[12px] leading-relaxed text-ink-80">{value || "—"}</p>
    </div>
  );
}

function DialogSampleCard({ sample }: { sample: { context: string; line: string; why: string } }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sample.line);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="w-full text-left rounded-2xl border border-ink-10 bg-white p-4 transition-all hover:border-rose/30 hover:shadow-[0_4px_12px_-6px_rgba(0,0,0,0.08)]"
      title="คลิกเพื่อ copy"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-ultra text-[12px] mt-0.5">💬</span>
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center rounded-full bg-rose-ultra px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-rose">
            {sample.context}
          </span>
          <p className="mt-2 font-thai text-[14px] leading-relaxed text-ink font-semibold">"{sample.line}"</p>
          <p className="mt-1.5 font-thai text-[11px] leading-relaxed text-ink-50">→ {sample.why}</p>
        </div>
        <span className={`shrink-0 font-mono text-[10px] font-bold ${copied ? "text-wellness" : "text-ink-30"}`}>
          {copied ? "copied ✓" : "📋"}
        </span>
      </div>
    </button>
  );
}

function RoleplayTurn({ turn }: { turn: { speaker: "abo" | "prospect"; text: string; note?: string } }) {
  const isAbo = turn.speaker === "abo";
  return (
    <div className={`flex ${isAbo ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] ${isAbo ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`font-mono text-[9px] font-bold uppercase tracking-wide mb-1 ${isAbo ? "text-rose" : "text-ink-40"}`}>
          {isAbo ? "🌸 ABO" : "👤 Prospect"}
        </div>
        <div className={`rounded-2xl px-4 py-2.5 font-thai text-[13px] leading-relaxed ${
          isAbo ? "bg-rose text-white" : "bg-white border border-ink-10 text-ink-80"
        }`}>
          {turn.text}
        </div>
        {turn.note && (
          <div className={`mt-1 max-w-full font-thai text-[10px] italic px-2 ${isAbo ? "text-rose/70 text-right" : "text-ink-40"}`}>
            💡 {turn.note}
          </div>
        )}
      </div>
    </div>
  );
}
