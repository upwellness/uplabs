"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FORM_SECTIONS, type FormKey, type AnalysisVerdict } from "./_data/form-questions";

interface Draft {
  prospectName: string;
  meetingContext: string;
  scores: Partial<Record<FormKey, 1 | 2 | 3>>;
  notes: Partial<Record<FormKey, string>>;
  updatedAt: string;
}

const ACCENT_BG = {
  rose:     "bg-rose-ultra",
  wellness: "bg-wellness-ultra",
  science:  "bg-science-ultra",
  amber:    "bg-amber-ultra",
} as const;

const ACCENT_TEXT = {
  rose:     "text-rose",
  wellness: "text-wellness",
  science:  "text-science",
  amber:    "text-amber",
} as const;

const ACCENT_FILL = {
  rose:     "bg-rose",
  wellness: "bg-wellness",
  science:  "bg-science",
  amber:    "bg-amber",
} as const;

const VERDICT_THEME = {
  wellness: { bar: "from-wellness to-wellness-deep",  panelBg: "bg-wellness-ultra",  panelBorder: "border-wellness-pale", text: "text-wellness-deep" },
  amber:    { bar: "from-amber to-amber",             panelBg: "bg-amber-ultra",    panelBorder: "border-amber-pale",    text: "text-amber" },
  rose:     { bar: "from-rose to-rose-deep",          panelBg: "bg-rose-ultra",     panelBorder: "border-rose-pale",     text: "text-rose-deep" },
  ink:      { bar: "from-ink-40 to-ink-60",           panelBg: "bg-ink-5",          panelBorder: "border-ink-10",        text: "text-ink-60" },
} as const;

export function AnalysisModal({
  draft, verdict, total, editing, saving, onSave, onClose,
}: {
  draft: Draft;
  verdict: AnalysisVerdict;
  total: number;
  editing?: boolean;
  saving?: boolean;
  onSave?: () => Promise<{ ok: boolean; id?: string; error?: string }>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const theme = VERDICT_THEME[verdict.color];

  const handleSave = async () => {
    if (!onSave) return;
    setSaveError(null);
    const r = await onSave();
    if (r.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } else {
      setSaveError(r.error ?? "บันทึกไม่สำเร็จ");
    }
  };

  const copySummary = async () => {
    const lines = [
      `📋 Check FORM · ${draft.prospectName || "(ไม่ระบุชื่อ)"}`,
      draft.meetingContext ? `บริบท: ${draft.meetingContext}` : null,
      "",
      `${verdict.emoji} ${verdict.label}  ·  ${total}/12`,
      "",
      ...FORM_SECTIONS.map((s) => {
        const sc = draft.scores[s.key];
        const nt = (draft.notes[s.key] ?? "").trim();
        return `${s.key} (${s.label}): ${sc ?? "—"}/3${nt ? ` · ${nt}` : ""}`;
      }),
      "",
      "Next actions:",
      ...verdict.nextActions.map((a) => `  ${a}`),
    ].filter(Boolean).join("\n");

    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl my-8 overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`${theme.panelBg} ${theme.panelBorder} border-b px-7 py-6`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-40 font-bold">Analysis</div>
              <h2 className="mt-1 font-head text-[24px] lg:text-[28px] font-extrabold tracking-tight text-ink">
                {draft.prospectName || "Prospect"}
              </h2>
              {draft.meetingContext && (
                <p className="mt-1 font-thai text-[13px] text-ink-60">{draft.meetingContext}</p>
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

          {/* Big verdict */}
          <div className="mt-6 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className={`text-[40px] leading-none font-head font-extrabold ${theme.text}`}>
                {verdict.emoji} {total}<span className="text-[18px] text-ink-30 font-mono ml-1">/ 12</span>
              </div>
              <div className={`mt-2 font-thai text-[15px] font-bold ${theme.text}`}>
                {verdict.label}
              </div>
            </div>
            <span className="font-mono text-[10px] text-ink-40">
              บันทึกล่าสุด: {draft.updatedAt ? new Date(draft.updatedAt).toLocaleString("th-TH") : "—"}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-7 py-6 space-y-6">
          {/* FORM bars */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 font-bold mb-3">FORM Breakdown</div>
            <div className="space-y-3">
              {FORM_SECTIONS.map((s) => {
                const v = draft.scores[s.key] ?? 0;
                return (
                  <div key={s.key}>
                    <div className="flex items-baseline justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${ACCENT_BG[s.accent]} font-mono text-[12px] font-bold ${ACCENT_TEXT[s.accent]}`}>
                          {s.key}
                        </span>
                        <span className="font-thai text-[13px] font-semibold text-ink">{s.label}</span>
                        <span className="font-thai text-[11px] text-ink-50">· {s.fullName}</span>
                      </div>
                      <span className={`font-mono text-[12px] font-bold ${v ? ACCENT_TEXT[s.accent] : "text-ink-30"}`}>
                        {v ? `${v}/3` : "—"}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-ink-5 overflow-hidden">
                      <div className={`h-full ${ACCENT_FILL[s.accent]} transition-all duration-500`} style={{ width: `${(v / 3) * 100}%` }} />
                    </div>
                    {draft.notes[s.key]?.trim() && (
                      <p className="mt-1.5 font-thai text-[11px] text-ink-50 line-clamp-2 leading-relaxed">
                        📝 {draft.notes[s.key]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Verdict message */}
          <div className={`rounded-2xl ${theme.panelBg} ${theme.panelBorder} border p-5`}>
            <div className={`font-mono text-[10px] uppercase tracking-[0.14em] font-bold mb-2 ${theme.text}`}>คำอ่าน</div>
            <p className="font-thai text-[14px] leading-relaxed text-ink-80">{verdict.message}</p>
          </div>

          {/* Next actions */}
          {verdict.nextActions.length > 0 && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 font-bold mb-3">
                แนะนำขั้นถัดไป
              </div>
              <ul className="space-y-2">
                {verdict.nextActions.map((a, i) => (
                  <li key={i} className="rounded-xl bg-surface px-4 py-3 font-thai text-[13px] leading-relaxed text-ink-80">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-ink-10 bg-surface px-7 py-4 space-y-2">
          {saveError && (
            <div className="rounded-lg bg-status-bg-danger px-3 py-2 text-[12px] text-status-danger">⚠ {saveError}</div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={copySummary}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-2 text-[12px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink transition-colors"
            >
              {copied ? "✓ Copied" : "📋 Copy summary"}
            </button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>กลับไปแก้</Button>
              {onSave && (
                <Button
                  variant="rose"
                  onClick={handleSave}
                  disabled={saving || saved}
                >
                  {saving
                    ? "กำลังบันทึก..."
                    : saved
                      ? "✓ บันทึกแล้ว"
                      : editing
                        ? "💾 อัพเดทบันทึก"
                        : "💾 บันทึกเข้าระบบ"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
