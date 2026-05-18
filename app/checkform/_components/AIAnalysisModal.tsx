"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { AIAnalysis } from "@/lib/checkform/ai-analyze";

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
}

export function AIAnalysisModal({
  open, loading, error, analysis, cached, analyzedAt, prospectName, onReanalyze, onClose,
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
          <AnalysisBody analysis={analysis} />
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

function ErrorPanel({ error, onClose }: { error: string; onClose: () => void }) {
  return (
    <div className="px-7 py-10 text-center">
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-status-bg-danger text-2xl">
        ⚠
      </div>
      <div className="mt-4 font-head text-[16px] font-extrabold text-status-danger">วิเคราะห์ไม่สำเร็จ</div>
      <p className="mt-2 max-w-md mx-auto font-mono text-[11px] text-ink-60 break-words">{error}</p>
      <p className="mt-3 font-thai text-[12px] text-ink-50">ลองอีกครั้งหรือ check GEMINI_API_KEY ใน env</p>
      <Button variant="ghost" size="sm" onClick={onClose} className="mt-4">ปิด</Button>
    </div>
  );
}

function AnalysisBody({ analysis }: { analysis: AIAnalysis }) {
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
