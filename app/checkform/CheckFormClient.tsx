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
  editingRecordId?: string | null;
}

interface CheckformRecord {
  id: string;
  coach_id: string;
  prospect_name: string;
  meeting_context: string | null;
  scores: Scores;
  notes: Notes;
  verdict_level: string | null;
  verdict_label: string | null;
  total_score: number;
  created_at: string;
  updated_at: string;
}

const EMPTY_DRAFT: Draft = {
  prospectName: "",
  meetingContext: "",
  scores: {},
  notes: {},
  updatedAt: "",
  editingRecordId: null,
};

const LEVEL_THEME: Record<string, { bg: string; text: string; ring: string }> = {
  strong:     { bg: "bg-wellness-ultra", text: "text-wellness", ring: "ring-wellness-pale" },
  borderline: { bg: "bg-amber-ultra",    text: "text-amber",    ring: "ring-amber-pale" },
  warm:       { bg: "bg-amber-ultra",    text: "text-amber",    ring: "ring-amber-pale" },
  not_ready:  { bg: "bg-rose-ultra",     text: "text-rose",     ring: "ring-rose-pale" },
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

  // Records list
  const [records, setRecords] = useState<CheckformRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsExpanded, setRecordsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

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

  // Load records from API
  const loadRecords = async () => {
    setRecordsLoading(true);
    try {
      const res = await fetch("/api/checkform/records");
      const json = await res.json();
      if (res.ok) setRecords(json.records ?? []);
    } catch { /* ignore */ }
    setRecordsLoading(false);
  };
  useEffect(() => { loadRecords(); }, []);

  const setScore = (key: FormKey, value: 1 | 2 | 3) =>
    setDraft((d) => ({ ...d, scores: { ...d.scores, [key]: d.scores[key] === value ? undefined : value } }));

  const setNote = (key: FormKey, value: string) =>
    setDraft((d) => ({ ...d, notes: { ...d.notes, [key]: value } }));

  const reset = () => {
    if (!confirm("ล้างข้อมูลทั้งหมด · เริ่มใหม่?")) return;
    setDraft(EMPTY_DRAFT);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const loadFromRecord = (r: CheckformRecord) => {
    if (draft.prospectName && !confirm(`โหลด '${r.prospect_name}' มาแทน · ข้อมูลปัจจุบันจะถูกแทนที่?`)) return;
    setDraft({
      prospectName: r.prospect_name,
      meetingContext: r.meeting_context ?? "",
      scores: r.scores ?? {},
      notes: r.notes ?? {},
      updatedAt: r.updated_at,
      editingRecordId: r.id,
    });
    setRecordsExpanded(false);
    // Scroll to top so user sees the loaded data
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startNew = () => {
    if (filledCount > 0 && !confirm("เริ่มใหม่ · ข้อมูลปัจจุบันจะถูกล้าง?")) return;
    setDraft({ ...EMPTY_DRAFT, updatedAt: new Date().toISOString() });
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const saveRecord = async (): Promise<{ ok: boolean; id?: string; error?: string }> => {
    if (!draft.prospectName.trim()) {
      return { ok: false, error: "กรุณากรอกชื่อ prospect ก่อน" };
    }
    setSaving(true);
    try {
      const payload = {
        prospect_name: draft.prospectName.trim(),
        meeting_context: draft.meetingContext?.trim() || null,
        scores: draft.scores,
        notes: draft.notes,
        verdict_level: verdict.level,
        verdict_label: verdict.label,
        total_score: total,
      };
      const editing = draft.editingRecordId;
      const url = editing ? `/api/checkform/records/${editing}` : "/api/checkform/records";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "save failed");
      const id = json.record?.id;
      setDraft((d) => ({ ...d, editingRecordId: id ?? editing }));
      await loadRecords();
      return { ok: true, id };
    } catch (e: any) {
      return { ok: false, error: e.message };
    } finally { setSaving(false); }
  };

  const deleteRecord = async (id: string, name: string) => {
    if (!confirm(`ลบบันทึก '${name}'?`)) return;
    try {
      const res = await fetch(`/api/checkform/records/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "delete failed");
      // If currently editing this one, clear
      if (draft.editingRecordId === id) {
        setDraft((d) => ({ ...d, editingRecordId: null }));
      }
      await loadRecords();
    } catch (e: any) { alert(e.message); }
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
        {/* Records list */}
        {(records.length > 0 || recordsLoading) && (
          <RecordsPanel
            records={records}
            loading={recordsLoading}
            expanded={recordsExpanded}
            setExpanded={setRecordsExpanded}
            editingId={draft.editingRecordId ?? null}
            onLoad={loadFromRecord}
            onDelete={deleteRecord}
            onStartNew={startNew}
          />
        )}

        {/* Prospect info */}
        <div className={`rounded-3xl border bg-white p-6 lg:p-7 ${draft.editingRecordId ? "border-rose/30 ring-1 ring-rose/10" : "border-ink-10"}`}>
          <div className="mb-3 flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-40 font-bold">Prospect</div>
            {draft.editingRecordId && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-ultra px-2.5 py-1 text-[10px] font-bold text-rose">
                ✏️ กำลังแก้บันทึกเดิม
                <button onClick={startNew} className="ml-1 text-rose underline-offset-2 hover:underline">เริ่มใหม่</button>
              </span>
            )}
          </div>
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
            <div className="mt-1 font-head text-[20px] font-extrabold text-ink">วิเคราะห์ + บันทึกเข้าระบบ</div>
            <p className="mt-1 font-thai text-[13px] text-ink-60">
              {draft.editingRecordId ? "อัพเดทบันทึกเดิมไว้เปิดดูภายหลังได้" : "บันทึกเข้า Supabase · กลับมาดูได้ทุกที่"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
          editing={!!draft.editingRecordId}
          saving={saving}
          onSave={saveRecord}
          onClose={() => setShowAnalysis(false)}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────── */
/* Records panel — list of saved checkform records       */
/* ──────────────────────────────────────────────────── */

function RecordsPanel({
  records, loading, expanded, setExpanded, editingId, onLoad, onDelete, onStartNew,
}: {
  records: CheckformRecord[];
  loading: boolean;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  editingId: string | null;
  onLoad: (r: CheckformRecord) => void;
  onDelete: (id: string, name: string) => void;
  onStartNew: () => void;
}) {
  return (
    <div className="rounded-3xl border border-ink-10 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-4 p-5 lg:p-6 text-left hover:bg-surface/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-ultra text-lg ring-1 ring-rose-pale">
            📋
          </span>
          <div>
            <div className="font-head text-[16px] font-bold text-ink">บันทึกของคุณ</div>
            <div className="mt-0.5 font-thai text-[12px] text-ink-60">
              {loading ? "กำลังโหลด..." : `${records.length} prospect · เก็บไว้ใน Supabase · เปิดดูจากที่ไหนก็ได้`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {records.length > 0 && (
            <span className="font-mono text-[11px] text-ink-40">
              {records.length}
            </span>
          )}
          <span className={`text-ink-30 text-lg transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-ink-10 px-5 lg:px-6 py-5 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-ink-5 animate-pulse" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-10 px-4 py-6 text-center font-thai text-[12px] text-ink-40">
              ยังไม่มีบันทึก · วิเคราะห์ครั้งแรกแล้วกด "บันทึกเข้าระบบ"
            </div>
          ) : (
            <>
              {records.map((r) => {
                const theme = r.verdict_level ? LEVEL_THEME[r.verdict_level] ?? LEVEL_THEME.warm : LEVEL_THEME.warm;
                const isEditing = editingId === r.id;
                return (
                  <div
                    key={r.id}
                    className={`group rounded-2xl border bg-white px-4 py-3 transition-all ${isEditing ? "border-rose/40 ring-1 ring-rose/20" : "border-ink-10 hover:border-ink-20"}`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onLoad(r)}
                        className="flex flex-1 min-w-0 items-center gap-3 text-left"
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.bg} ${theme.text} ring-1 ${theme.ring} font-head font-extrabold text-[14px]`}>
                          {r.total_score}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-thai text-[14px] font-bold text-ink truncate">{r.prospect_name}</span>
                            {isEditing && <span className="text-[10px] font-mono font-bold text-rose">EDITING</span>}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-ink-40 truncate">
                            {r.verdict_label ?? "—"}
                            {r.meeting_context ? ` · ${r.meeting_context}` : ""}
                          </div>
                        </div>
                        <div className="hidden md:block text-right shrink-0">
                          <div className="font-mono text-[10px] text-ink-40">{new Date(r.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</div>
                          <div className="font-mono text-[9px] text-ink-30">{new Date(r.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(r.id, r.prospect_name)}
                        title="ลบบันทึก"
                        className="shrink-0 rounded-lg border border-ink-10 bg-white px-2 py-1.5 text-[11px] text-ink-40 opacity-0 transition-all group-hover:opacity-100 hover:border-status-danger/30 hover:text-status-danger hover:bg-status-bg-danger/50"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={onStartNew}
                  className="text-[11px] font-mono font-bold text-rose hover:underline"
                >
                  + วิเคราะห์คนใหม่
                </button>
              </div>
            </>
          )}
        </div>
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
