"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FORM_SECTIONS, analyzeForm, type FormKey, type FormSectionData } from "./_data/form-questions";
import { AnalysisModal } from "./AnalysisModal";

const STORAGE_KEY = "upwellness:checkform:draft:v1";

type Scores = Partial<Record<FormKey, 1 | 2 | 3>>;
type Notes  = Partial<Record<FormKey, string>>;

interface Draft {
  prospectName: string;
  meetingContext: string;
  scores: Scores;
  notes: Notes;
  updatedAt: string;
}

const EMPTY_DRAFT: Draft = {
  prospectName: "",
  meetingContext: "",
  scores: {},
  notes: {},
  updatedAt: "",
};

const ACCENT_BG = {
  rose:     "bg-rose-ultra",
  wellness: "bg-wellness-ultra",
  science:  "bg-science-ultra",
  amber:    "bg-amber-ultra",
} as const;

const ACCENT_RING = {
  rose:     "ring-rose-pale",
  wellness: "ring-wellness-pale",
  science:  "ring-science-pale",
  amber:    "ring-amber-pale",
} as const;

const ACCENT_TEXT = {
  rose:     "text-rose",
  wellness: "text-wellness",
  science:  "text-science",
  amber:    "text-amber",
} as const;

const ACCENT_DOT = {
  rose:     "bg-rose",
  wellness: "bg-wellness",
  science:  "bg-science",
  amber:    "bg-amber",
} as const;

const ACCENT_FILLBAR = {
  rose:     "bg-rose",
  wellness: "bg-wellness",
  science:  "bg-science",
  amber:    "bg-amber",
} as const;

export function CheckFormClient() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDraft(JSON.parse(raw));
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      const next = { ...draft, updatedAt: new Date().toISOString() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 1200);
      } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(t);
  }, [draft, hydrated]);

  const setScore = (key: FormKey, value: 1 | 2 | 3) =>
    setDraft((d) => ({ ...d, scores: { ...d.scores, [key]: d.scores[key] === value ? undefined : value } }));

  const setNote = (key: FormKey, value: string) =>
    setDraft((d) => ({ ...d, notes: { ...d.notes, [key]: value } }));

  const reset = () => {
    if (!confirm("ล้างข้อมูลทั้งหมด · เริ่มใหม่?")) return;
    setDraft(EMPTY_DRAFT);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const verdict = useMemo(() => analyzeForm(draft.scores), [draft.scores]);
  const total = useMemo(
    () => (Object.values(draft.scores).filter(Boolean) as number[]).reduce((s, v) => s + v, 0),
    [draft.scores],
  );
  const filledCount = Object.values(draft.scores).filter(Boolean).length;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 lg:gap-8 mt-8">
      {/* ── Main column ────────────────────────────── */}
      <div className="space-y-6">
        {/* Prospect info */}
        <div className="rounded-3xl border border-ink-10 bg-white p-6 lg:p-7">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-40 font-bold mb-3">Prospect</div>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">ชื่อที่จะวิเคราะห์</span>
              <input
                value={draft.prospectName}
                onChange={(e) => setDraft((d) => ({ ...d, prospectName: e.target.value }))}
                placeholder="คุณ___"
                className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm focus:border-rose focus:outline-none placeholder:text-ink-30"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">บริบทที่เจอ</span>
              <input
                value={draft.meetingContext}
                onChange={(e) => setDraft((d) => ({ ...d, meetingContext: e.target.value }))}
                placeholder="เจอที่ไหน · ใครแนะนำ · meeting ครั้งที่..."
                className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm focus:border-rose focus:outline-none placeholder:text-ink-30"
              />
            </label>
          </div>
        </div>

        {/* Hint */}
        <div className="rounded-2xl border border-wellness-pale bg-wellness-ultra px-5 py-4 font-thai text-[13px] leading-relaxed text-wellness-deep">
          <b>💚 ไม่ต้องรีบ · ฟังก่อน วิเคราะห์ทีหลัง</b>
          <br />
          คำถามตัวอย่างข้างล่างเป็นแค่ <b>ตัวจุดประกาย</b> · ลองชวนคุยอย่างเป็นธรรมชาติ · จด keyword สำคัญใน Notes · พอครบ 4 ด้านค่อยกดวิเคราะห์
        </div>

        {/* FORM sections */}
        {FORM_SECTIONS.map((section) => (
          <FormSection
            key={section.key}
            section={section}
            score={draft.scores[section.key]}
            note={draft.notes[section.key] ?? ""}
            onScore={(v) => setScore(section.key, v)}
            onNote={(v) => setNote(section.key, v)}
          />
        ))}

        {/* Bottom action */}
        <div className="rounded-3xl border border-ink-10 bg-gradient-to-br from-warm-white to-rose-ultra p-6 lg:p-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-rose font-bold">Final step</div>
            <div className="mt-1 font-head text-[20px] font-extrabold text-ink">วิเคราะห์ผล + คำแนะนำต่อ</div>
            <p className="mt-1 font-thai text-[13px] text-ink-60">กรอกครบทั้ง 4 ด้านแล้วกดดูได้เลย · ดูได้หลายครั้ง</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={reset}>ล้างเริ่มใหม่</Button>
            <Button variant="rose" onClick={() => setShowAnalysis(true)} disabled={filledCount < 4}>
              {filledCount < 4 ? `กรอกอีก ${4 - filledCount} ด้าน` : "🔍 วิเคราะห์ผล"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Sticky scorecard ─────────────────────────── */}
      <aside className="lg:sticky lg:top-24 lg:self-start space-y-4">
        <div className="rounded-3xl border border-ink-10 bg-white p-6 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-40 font-bold">FORM Score</div>
            {savedToast && (
              <span className="text-[10px] font-mono text-wellness animate-pulse">✓ saved</span>
            )}
          </div>
          <div className="mt-3 font-head text-[40px] font-extrabold leading-none text-ink">
            {total}
            <span className="font-mono text-[14px] text-ink-30 ml-1">/ 12</span>
          </div>
          <div className="mt-1 font-thai text-[12px] text-ink-60">
            {filledCount}/4 ด้าน · {filledCount === 4 ? "พร้อมวิเคราะห์" : "ยังกรอกไม่ครบ"}
          </div>

          <div className="mt-5 space-y-3">
            {FORM_SECTIONS.map((s) => {
              const v = draft.scores[s.key] ?? 0;
              return (
                <a key={s.key} href={`#section-${s.key}`} className="group block">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-md ${ACCENT_BG[s.accent]} font-mono text-[11px] font-bold ${ACCENT_TEXT[s.accent]}`}>{s.key}</span>
                      <span className="font-thai text-[12px] font-semibold text-ink group-hover:text-rose">{s.label}</span>
                    </div>
                    <span className={`font-mono text-[11px] font-bold ${v ? ACCENT_TEXT[s.accent] : "text-ink-30"}`}>
                      {v ? `${v}/3` : "—"}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ink-5 overflow-hidden">
                    <div className={`h-full ${ACCENT_FILLBAR[s.accent]} transition-all duration-300`} style={{ width: `${(v / 3) * 100}%` }} />
                  </div>
                </a>
              );
            })}
          </div>

          <div className="mt-6 border-t border-ink-10 pt-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 font-bold mb-1">Verdict ตอนนี้</div>
            <div className="font-thai text-[13px] font-semibold text-ink">
              {verdict.emoji} {verdict.label}
            </div>
            <p className="mt-1.5 font-thai text-[11px] text-ink-50 leading-relaxed">
              {filledCount < 4 ? "กรอกอีกหน่อย เผื่อ verdict เปลี่ยน" : verdict.message}
            </p>
          </div>

          {filledCount === 4 && (
            <Button variant="rose" onClick={() => setShowAnalysis(true)} className="mt-5 w-full">
              🔍 ดูคำแนะนำเต็ม
            </Button>
          )}
        </div>

        <div className="rounded-2xl border border-ink-10 bg-white p-4 text-[11px] font-thai text-ink-60 leading-relaxed">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 font-bold mb-2">💡 Tip</div>
          แต่ละด้านมี dialog cards ที่กด <b>ตัวอย่าง</b> · ลอกตามได้ตรง ๆ หรือเรียบเรียงใหม่ · ไม่ใช่ script ตายตัว
        </div>
      </aside>

      {showAnalysis && (
        <AnalysisModal
          draft={draft}
          verdict={verdict}
          total={total}
          onClose={() => setShowAnalysis(false)}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────── */

function FormSection({
  section, score, note, onScore, onNote,
}: {
  section: FormSectionData;
  score: 1 | 2 | 3 | undefined;
  note: string;
  onScore: (v: 1 | 2 | 3) => void;
  onNote: (v: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const filled = score !== undefined;

  return (
    <section id={`section-${section.key}`} className="rounded-3xl border border-ink-10 bg-white overflow-hidden scroll-mt-24">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 p-6 lg:p-7 text-left hover:bg-surface/50 transition-colors"
      >
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${ACCENT_BG[section.accent]} ring-1 ${ACCENT_RING[section.accent]} text-2xl`}>
          {section.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={`font-head text-[26px] font-extrabold leading-none ${ACCENT_TEXT[section.accent]}`}>{section.key}</span>
            <span className="font-thai text-[16px] font-bold text-ink">{section.fullName}</span>
          </div>
          <p className="mt-1 font-thai text-[13px] text-ink-60">{section.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {filled && (
            <span className={`inline-flex items-center gap-1 rounded-full ${ACCENT_BG[section.accent]} px-2.5 py-1 text-[11px] font-bold ${ACCENT_TEXT[section.accent]}`}>
              ✓ {score}/3
            </span>
          )}
          <span className={`text-ink-30 text-lg transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
        </div>
      </button>

      {expanded && (
        <div className="px-6 lg:px-7 pb-7 border-t border-ink-10 pt-6 space-y-6">
          {/* Why matters */}
          <div className={`rounded-2xl ${ACCENT_BG[section.accent]} px-4 py-3 font-thai text-[12px] leading-relaxed text-ink-80`}>
            <span className={`font-bold ${ACCENT_TEXT[section.accent]}`}>ทำไมถึงสำคัญ:</span> {section.whyMatters}
          </div>

          {/* Dialog cards · Openers */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 font-bold mb-3 flex items-center gap-2">
              💬 ลองชวนคุยแบบนี้ · เปิดเรื่อง
            </div>
            <div className="space-y-2">
              {section.openers.map((line, i) => (
                <DialogBubble key={i} accent={section.accent} line={line} />
              ))}
            </div>
          </div>

          {/* Dialog cards · Follow-ups */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 font-bold mb-3 flex items-center gap-2">
              💭 ถ้าเริ่มเปิด ลองตามต่อ
            </div>
            <div className="space-y-2">
              {section.followUps.map((line, i) => (
                <DialogBubble key={i} accent={section.accent} line={line} />
              ))}
            </div>
          </div>

          {/* Listen-for signals */}
          <div className="grid md:grid-cols-2 gap-2">
            {section.signals.map((s, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2.5 text-[12px] font-thai flex items-start gap-2 ${
                  s.emoji === "✅" ? "bg-status-bg-optimal text-status-optimal" : "bg-status-bg-caution text-status-caution"
                }`}
              >
                <span>{s.emoji}</span>
                <span className="leading-relaxed">{s.text}</span>
              </div>
            ))}
          </div>

          {/* Rating */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 font-bold mb-3">ให้คะแนนด้านนี้</div>
            <div className="grid grid-cols-3 gap-2">
              {section.ratingScale.map((r) => {
                const active = score === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => onScore(r.value)}
                    className={`group relative rounded-2xl border p-4 text-left transition-all ${
                      active
                        ? `${ACCENT_BG[section.accent]} border-current ${ACCENT_TEXT[section.accent]} shadow-[0_8px_20px_-12px_rgba(0,0,0,0.15)]`
                        : "border-ink-10 bg-white text-ink-60 hover:border-ink-20 hover:bg-surface"
                    }`}
                  >
                    <div className="flex items-baseline justify-between mb-1">
                      <span className={`font-head text-[22px] font-extrabold ${active ? "" : "text-ink"}`}>{r.value}</span>
                      <span className={`font-mono text-[10px] uppercase tracking-wide ${active ? "" : "text-ink-40"}`}>{r.label}</span>
                    </div>
                    <p className={`font-thai text-[11px] leading-relaxed ${active ? "" : "text-ink-50"}`}>{r.meaning}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 font-bold mb-2 flex items-center justify-between">
              <span>📝 Notes</span>
              <span className="text-ink-30">{note.length} chars · auto-save</span>
            </div>
            <textarea
              value={note}
              onChange={(e) => onNote(e.target.value)}
              placeholder="จดสิ่งที่ได้ฟัง · keyword · quotes · ความรู้สึก..."
              rows={3}
              className="w-full rounded-xl border border-ink-10 bg-white px-4 py-3 text-sm font-thai focus:border-rose focus:outline-none placeholder:text-ink-30 resize-none"
            />
          </div>
        </div>
      )}
    </section>
  );
}

/* Chat-bubble dialog line · clickable to copy */
function DialogBubble({ accent, line }: { accent: FormSectionData["accent"]; line: { text: string; tag?: string } }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(line.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={`group w-full flex items-start gap-3 rounded-2xl border border-ink-10 bg-white px-4 py-3 text-left transition-all hover:border-ink-20 hover:shadow-[0_4px_12px_-6px_rgba(0,0,0,0.08)]`}
      title="คลิกเพื่อ copy"
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ACCENT_BG[accent]} text-[12px] mt-0.5`}>💬</span>
      <div className="flex-1 min-w-0">
        <p className="font-thai text-[14px] leading-relaxed text-ink">"{line.text}"</p>
        {line.tag && (
          <span className={`mt-1 inline-flex items-center gap-1 rounded-full ${ACCENT_BG[accent]} px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide ${ACCENT_TEXT[accent]}`}>
            <span className={`h-1 w-1 rounded-full ${ACCENT_DOT[accent]}`} />
            {line.tag}
          </span>
        )}
      </div>
      <span className={`shrink-0 font-mono text-[10px] font-bold transition-all ${copied ? "text-wellness" : "text-ink-30 opacity-0 group-hover:opacity-100"}`}>
        {copied ? "copied ✓" : "📋 copy"}
      </span>
    </button>
  );
}
