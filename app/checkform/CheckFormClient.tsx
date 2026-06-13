"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FORM_SECTIONS, analyzeForm, type FormKey, type FormSectionData } from "./_data/form-questions";
import { AnalysisModal } from "./AnalysisModal";
import { ProfileForm, EMPTY_PROFILE, EMPTY_DISC, type ProfileData, type DiscData } from "./_components/ProfileForm";

/**
 * Ensure a record's `profile` blob has the full shape that ProfileForm
 * expects (demographics, career, lifestyle.hobbies, family). Old records
 * or records created via /prospects convert can have partial shape — this
 * fills in missing branches with empty defaults to prevent undefined access
 * crashes.
 */
function normalizeProfile(p: any): ProfileData {
  const src = (p && typeof p === "object") ? p : {};
  return {
    demographics: { ...(src.demographics ?? {}) },
    career:       { ...(src.career       ?? {}) },
    lifestyle:    { hobbies: [], ...(src.lifestyle ?? {}) },
    family:       { ...(src.family       ?? {}) },
  };
}
import { AIAnalysisModal } from "./_components/AIAnalysisModal";
import type { AIAnalysis, CheckformProfile } from "@/lib/checkform/ai-analyze";
import type { ClipRecommendations } from "@/lib/checkform/clip-matcher";

const STORAGE_KEY = "upwellness:checkform:draft:v2";

type Scores = Partial<Record<FormKey, 1 | 2 | 3>>;
type Notes  = Partial<Record<FormKey, string>>;

interface Draft {
  prospectName: string;
  meetingContext: string;
  scores: Scores;
  notes: Notes;
  profile: ProfileData;
  disc: DiscData;
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
  profile?: ProfileData;
  disc_primary?: string | null;
  disc_secondary?: string | null;
  ai_analysis?: AIAnalysis | null;
  ai_analyzed_at?: string | null;
  clip_recommendations?: ClipRecommendations | null;
  clip_generated_at?: string | null;
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
  profile: EMPTY_PROFILE,
  disc: EMPTY_DISC,
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
  const [recordsExpanded, setRecordsExpanded] = useState(true);    // auto-expand by default
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // FORM details collapsible
  const [formDetailsOpen, setFormDetailsOpen] = useState(false);

  // Explicit save toast (different from auto-save localStorage toast)
  const [dbSavedToast, setDbSavedToast] = useState<string | null>(null);

  const saveOnly = async () => {
    const r = await saveRecord();
    if (r.ok) {
      setDbSavedToast(draft.editingRecordId ? "✓ อัพเดทแล้ว" : "✓ บันทึกแล้ว");
      setTimeout(() => setDbSavedToast(null), 2200);
    } else {
      alert(r.error ?? "บันทึกไม่สำเร็จ");
    }
  };

  // AI analysis state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiAnalyzedAt, setAiAnalyzedAt] = useState<string | null>(null);
  const [aiCached, setAiCached] = useState(false);

  // STP clip recommendation state (auto-fires after AI analysis succeeds)
  const [clipRecs, setClipRecs] = useState<ClipRecommendations | null>(null);
  const [clipLoading, setClipLoading] = useState(false);
  const [clipError, setClipError] = useState<string | null>(null);
  const [clipGeneratedAt, setClipGeneratedAt] = useState<string | null>(null);
  const [clipCached, setClipCached] = useState(false);

  // Which record is being fetched (full detail) · for row spinner
  const [loadingRecordId, setLoadingRecordId] = useState<string | null>(null);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Defensive: ensure profile has full shape even if old draft saved without all keys
        setDraft({
          ...parsed,
          profile: normalizeProfile(parsed?.profile),
          disc: parsed?.disc ?? EMPTY_DISC,
          scores: parsed?.scores ?? {},
          notes: parsed?.notes ?? {},
        });
      }
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
    setRecordsError(null);
    try {
      const res = await fetch("/api/checkform/records");
      const json = await res.json();
      if (!res.ok) {
        setRecordsError(json.error ?? `HTTP ${res.status}`);
        setRecords([]);
      } else {
        setRecords(json.records ?? []);
      }
    } catch (e: any) {
      setRecordsError(e.message ?? "เครือข่ายผิดพลาด");
      setRecords([]);
    }
    setRecordsLoading(false);
  };
  useEffect(() => { loadRecords(); }, []);

  // Auto-load record when navigated from /prospects (or anywhere) via ?load=<id>
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (autoLoadedRef.current) return;
    if (records.length === 0) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const loadId = params.get("load");
    if (!loadId) return;
    const r = records.find((rec) => rec.id === loadId);
    if (!r) return;
    autoLoadedRef.current = true;
    // Clean up URL so refresh doesn't re-trigger
    window.history.replaceState({}, "", "/checkform");
    // Fetch the full record (list payload is now light · no heavy jsonb)
    void hydrateAndLoad(loadId, { skipConfirm: true });
  }, [records]);

  /**
   * Apply a FULL record (with heavy jsonb fields) into the editor state.
   */
  const applyRecordToEditor = (r: CheckformRecord) => {
    setDraft({
      prospectName: r.prospect_name,
      meetingContext: r.meeting_context ?? "",
      scores: r.scores ?? {},
      notes: r.notes ?? {},
      profile: normalizeProfile(r.profile),
      disc: {
        primary: (r.disc_primary as DiscData["primary"]) ?? undefined,
        secondary: (r.disc_secondary as DiscData["secondary"]) ?? undefined,
      },
      updatedAt: r.updated_at,
      editingRecordId: r.id,
    });
    setAiAnalysis(r.ai_analysis ?? null);
    setAiAnalyzedAt(r.ai_analyzed_at ?? null);
    setAiCached(!!r.ai_analysis);
    setClipRecs(r.clip_recommendations ?? null);
    setClipGeneratedAt(r.clip_generated_at ?? null);
    setClipCached(!!r.clip_recommendations);
    setClipError(null);
    setRecordsExpanded(false);
  };

  /**
   * Fetch the full record by id (list view doesn't carry heavy jsonb anymore)
   * and load it into the editor.
   */
  const hydrateAndLoad = async (id: string, opts: { skipConfirm?: boolean } = {}) => {
    if (!opts.skipConfirm && draft.prospectName) {
      const listRow = records.find((x) => x.id === id);
      const name = listRow?.prospect_name ?? "record นี้";
      if (!confirm(`โหลด '${name}' มาแทน · ข้อมูลปัจจุบันจะถูกแทนที่?`)) return;
    }
    setLoadingRecordId(id);
    try {
      const res = await fetch(`/api/checkform/records/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "load record failed");
      applyRecordToEditor(json.record);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      alert(e.message ?? "โหลด record ไม่สำเร็จ");
    } finally {
      setLoadingRecordId(null);
    }
  };

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
    void hydrateAndLoad(r.id);
  };

  const startNew = () => {
    if (filledCount > 0 && !confirm("เริ่มใหม่ · ข้อมูลปัจจุบันจะถูกล้าง?")) return;
    setDraft({ ...EMPTY_DRAFT, updatedAt: new Date().toISOString() });
    setAiAnalysis(null);
    setAiAnalyzedAt(null);
    setAiCached(false);
    setAiError(null);
    setClipRecs(null);
    setClipGeneratedAt(null);
    setClipCached(false);
    setClipError(null);
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
        profile: draft.profile,
        disc_primary: draft.disc.primary ?? null,
        disc_secondary: draft.disc.secondary ?? null,
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
      if (draft.editingRecordId === id) {
        setDraft((d) => ({ ...d, editingRecordId: null }));
      }
      await loadRecords();
    } catch (e: any) { alert(e.message); }
  };

  const buildAIProfile = (): CheckformProfile => ({
    prospectName: draft.prospectName,
    meetingContext: draft.meetingContext,
    demographics: draft.profile.demographics,
    career: draft.profile.career,
    lifestyle: draft.profile.lifestyle,
    family: draft.profile.family,
    disc: draft.disc.primary ? { primary: draft.disc.primary, secondary: draft.disc.secondary, confidence: draft.disc.confidence } : undefined,
    formScores: draft.scores as { F?: number; O?: number; R?: number; M?: number },
    formNotes: draft.notes,
  });

  const recommendClips = async (
    analysisForClips: AIAnalysis | null,
    opts: { recordId?: string | null; force?: boolean } = {},
  ) => {
    setClipError(null);
    setClipLoading(true);
    setClipRecs(null);
    try {
      const res = await fetch("/api/checkform/recommend-clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: buildAIProfile(),
          analysis: analysisForClips ?? undefined,
          recordId: opts.recordId ?? draft.editingRecordId ?? undefined,
          force: opts.force === true,
        }),
      });

      // Read response as text first so we can detect non-JSON responses
      // (HTML error pages from middleware redirect, Vercel timeout, etc.)
      const raw = await res.text();
      let json: any;
      if (raw.trim().startsWith("<")) {
        // HTML response (login page, error page, etc.)
        if (res.status === 401 || raw.includes("login")) {
          throw new Error("Session หมดอายุ · กรุณา refresh และ login ใหม่");
        }
        if (res.status === 504 || res.status === 408) {
          throw new Error("Gemini ใช้เวลานานเกินไป (timeout) · ลองใหม่อีกครั้ง");
        }
        throw new Error(`Server ตอบ HTML แทน JSON (HTTP ${res.status}) · ดู Vercel logs`);
      }
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error(`Response parse ไม่ได้: ${raw.slice(0, 120)}`);
      }
      if (!res.ok) throw new Error(json.error ?? `recommend-clips failed (HTTP ${res.status})`);
      setClipRecs(json.recommendations);
      setClipGeneratedAt(json.generated_at ?? new Date().toISOString());
      setClipCached(!!json.cached);
      // Refresh records so the cached clip stays in sync with what's saved
      if (opts.recordId ?? draft.editingRecordId) loadRecords();
    } catch (e: any) {
      setClipError(e.message);
    } finally {
      setClipLoading(false);
    }
  };

  const analyzeWithAI = async (force = false) => {
    setAiOpen(true);
    setAiError(null);
    setAiLoading(true);
    // Reset clip state on FORCE (re-analyze) — keep cached on normal open
    if (force) {
      setClipRecs(null);
      setClipError(null);
    }
    try {
      // Auto-save the record first so the AI result has somewhere to live (cache hit next time)
      let recordId = draft.editingRecordId ?? null;
      if (!recordId) {
        const saved = await saveRecord();
        if (!saved.ok) {
          throw new Error(saved.error ?? "บันทึกก่อนวิเคราะห์ไม่สำเร็จ");
        }
        recordId = saved.id ?? null;
      }

      const res = await fetch("/api/checkform/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: buildAIProfile(),
          recordId: recordId ?? undefined,
          force,
        }),
      });
      // Robust parsing — handle HTML responses (auth redirect, timeout, etc.)
      const raw = await res.text();
      let json: any;
      if (raw.trim().startsWith("<")) {
        if (res.status === 401 || raw.includes("login")) {
          throw new Error("Session หมดอายุ · กรุณา refresh และ login ใหม่");
        }
        if (res.status === 504 || res.status === 408) {
          throw new Error("Gemini ใช้เวลานานเกินไป (timeout) · ลองใหม่อีกครั้ง");
        }
        throw new Error(`Server ตอบ HTML แทน JSON (HTTP ${res.status})`);
      }
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error(`Response parse ไม่ได้: ${raw.slice(0, 120)}`);
      }
      if (!res.ok) throw new Error(json.error ?? `analyze failed (HTTP ${res.status})`);
      setAiAnalysis(json.analysis);
      setAiAnalyzedAt(json.analyzed_at ?? new Date().toISOString());
      setAiCached(!!json.cached);
      loadRecords();

      // Fire clip recommendation:
      // - If force=true → re-call Gemini (force clips too)
      // - If already have cached clipRecs → skip (preloaded from record)
      // - Otherwise → call API (which will cache-hit if DB has it)
      if (force || !clipRecs) {
        void recommendClips(json.analysis, { recordId, force });
      }
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const profileFilled = useMemo(() => {
    const p = draft.profile;
    let count = 0;
    if (p.demographics.ageRange)     count++;
    if (p.career.occupation)         count++;
    if (p.career.incomeRange)        count++;
    if (p.lifestyle.healthAwareness) count++;
    if (p.family.deps)               count++;
    return count;
  }, [draft.profile]);
  const profileReadyForAI = profileFilled >= 3 && draft.prospectName.trim().length > 0;

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
        {/* Records list — always shown */}
        <RecordsPanel
          records={records}
          loading={recordsLoading}
          error={recordsError}
          expanded={recordsExpanded}
          setExpanded={setRecordsExpanded}
          editingId={draft.editingRecordId ?? null}
          loadingId={loadingRecordId}
          onLoad={loadFromRecord}
          onDelete={deleteRecord}
          onStartNew={startNew}
          onReload={loadRecords}
        />


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
          <b>💚 กรอกเฉพาะที่รู้ · ที่เหลือเดาจาก AI ได้</b>
          <br />
          กรอกอย่างน้อย <b>3 ฟิลด์</b> + ชื่อ → AI วิเคราะห์ให้ได้ว่า <b>เข้าหายังไง / สัดส่วน product:business / dialog / roleplay จำลอง</b>
        </div>

        {/* Profile form (new primary input) */}
        <ProfileForm
          profile={draft.profile}
          disc={draft.disc}
          onProfileChange={(p) => setDraft((d) => ({ ...d, profile: p }))}
          onDiscChange={(disc) => setDraft((d) => ({ ...d, disc }))}
        />

        {/* FORM details (optional · collapsible) */}
        <div className="rounded-3xl border border-ink-10 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setFormDetailsOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-4 p-5 lg:p-6 text-left hover:bg-surface/50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-ultra text-lg ring-1 ring-amber-pale">
                💬
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-head text-[16px] font-bold text-ink">FORM Details · Dialog Guidelines</div>
                  <span className="rounded-full bg-ink-5 px-2 py-0.5 text-[10px] font-mono font-bold text-ink-40">optional</span>
                </div>
                <div className="mt-0.5 font-thai text-[12px] text-ink-60">
                  สำหรับใช้คุยจริง · มี dialog template + F·O·R·M scoring · ไม่จำเป็นต่อ AI · เปิดเมื่อต้องการ
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {filledCount > 0 && (
                <span className="font-mono text-[10px] font-bold text-rose">
                  {filledCount}/4
                </span>
              )}
              <span className={`text-ink-30 text-lg transition-transform ${formDetailsOpen ? "rotate-180" : ""}`}>⌄</span>
            </div>
          </button>

          {formDetailsOpen && (
            <div className="border-t border-ink-10 p-5 lg:p-6 space-y-5">
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
            </div>
          )}
        </div>

        {/* Bottom action — AI primary, basic FORM secondary */}
        <div className="rounded-3xl border border-rose/20 bg-gradient-to-br from-rose-ultra via-warm-white to-amber-ultra p-6 lg:p-7 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2">
                <span className="relative h-2 w-2">
                  <span className="absolute inset-0 rounded-full bg-rose" />
                  <span className="absolute inset-0 rounded-full bg-rose animate-ping opacity-70" />
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-rose font-bold">AI Analysis</span>
              </div>
              <div className="mt-1 font-head text-[22px] font-extrabold text-ink">วิเคราะห์ด้วย AI</div>
              <p className="mt-1 max-w-lg font-thai text-[13px] text-ink-60">
                Gemini วิเคราะห์ profile + DISC → ได้ <b>วิธีเข้าหา</b> · <b>dialog ตัวอย่าง</b> · <b>สัดส่วน product/business</b> · <b>roleplay จำลอง</b>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={reset}>ล้าง</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={saveOnly}
                disabled={!draft.prospectName.trim() || saving}
                title="บันทึกเก็บไว้ใน Supabase · ไม่ต้องรอ AI"
              >
                {saving ? "..." : draft.editingRecordId ? "💾 อัพเดท" : "💾 บันทึก"}
              </Button>
              <Button
                variant="rose"
                onClick={() => analyzeWithAI(false)}
                disabled={!profileReadyForAI || aiLoading}
              >
                {aiLoading
                  ? "กำลังวิเคราะห์..."
                  : !draft.prospectName.trim()
                    ? "ใส่ชื่อก่อน"
                    : profileFilled < 3
                      ? `กรอกอีก ${3 - profileFilled} ฟิลด์`
                      : aiAnalysis
                        ? "✨ เปิดผลวิเคราะห์"
                        : "✨ บันทึก + วิเคราะห์ AI"}
              </Button>
            </div>
            {dbSavedToast && (
              <span className="ml-auto rounded-full bg-wellness px-3 py-1 text-[11px] font-bold text-white animate-pulse">
                {dbSavedToast}
              </span>
            )}
          </div>

          {aiAnalysis && !aiLoading && (
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="w-full text-left rounded-2xl border border-rose/30 bg-white px-4 py-3 transition-all hover:border-rose/50 hover:shadow-[0_4px_12px_-6px_rgba(140,76,76,0.15)]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-ultra text-base">🤖</span>
                <div className="flex-1 min-w-0">
                  <div className="font-thai text-[13px] font-semibold text-ink">
                    มีผลวิเคราะห์อยู่แล้ว · <span className="text-rose">คลิกเพื่อเปิดดู</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-ink-40">
                    {aiAnalysis.approach.type.toUpperCase()} · product {aiAnalysis.approach.productRatio}% · business {aiAnalysis.approach.businessRatio}%
                    {aiAnalyzedAt && ` · ${new Date(aiAnalyzedAt).toLocaleString("th-TH")}`}
                  </div>
                </div>
              </div>
            </button>
          )}

          <div className="border-t border-ink-10 pt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-thai text-ink-60">
            <span>หรือใช้ FORM scoring แบบเก่า (ต้องกรอก FORM Details ก่อน)</span>
            <button
              onClick={() => setShowAnalysis(true)}
              disabled={filledCount < 4}
              className="rounded-full border border-ink-10 bg-white px-3 py-1 text-[11px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              🔍 FORM scoring {filledCount < 4 ? `(${filledCount}/4)` : ""}
            </button>
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

      <AIAnalysisModal
        open={aiOpen}
        loading={aiLoading}
        error={aiError}
        analysis={aiAnalysis}
        cached={aiCached}
        analyzedAt={aiAnalyzedAt}
        prospectName={draft.prospectName}
        onReanalyze={() => analyzeWithAI(true)}
        onClose={() => setAiOpen(false)}
        clipRecs={clipRecs}
        clipLoading={clipLoading}
        clipError={clipError}
        clipCached={clipCached}
        clipGeneratedAt={clipGeneratedAt}
        onRecommendClips={() => recommendClips(aiAnalysis, { force: true })}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────── */
/* Records panel — list of saved checkform records       */
/* ──────────────────────────────────────────────────── */

function RecordsPanel({
  records, loading, error, expanded, setExpanded, editingId, loadingId, onLoad, onDelete, onStartNew, onReload,
}: {
  records: CheckformRecord[];
  loading: boolean;
  error: string | null;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  editingId: string | null;
  loadingId: string | null;
  onLoad: (r: CheckformRecord) => void;
  onDelete: (id: string, name: string) => void;
  onStartNew: () => void;
  onReload: () => void;
}) {
  const hasRecords = records.length > 0;
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
            <div className="font-head text-[16px] font-bold text-ink">รายชื่อ prospect ที่เคยวิเคราะห์</div>
            <div className="mt-0.5 font-thai text-[12px] text-ink-60">
              {loading
                ? "กำลังโหลด..."
                : error
                  ? <span className="text-status-danger">⚠ {error}</span>
                  : hasRecords
                    ? `${records.length} คน · คลิกที่แถวเพื่อเรียกมาดู/แก้`
                    : "ยังไม่มีบันทึก · กรอกแล้วกด 'บันทึก' จะอยู่ตรงนี้"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {hasRecords && (
            <span className="rounded-full bg-rose px-2 py-0.5 text-[11px] font-bold text-white">
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
          ) : error ? (
            <div className="rounded-xl border border-status-bg-danger bg-status-bg-danger/40 px-4 py-4 text-center">
              <div className="font-thai text-[13px] font-semibold text-status-danger">โหลดรายชื่อไม่สำเร็จ</div>
              <div className="mt-1 font-mono text-[10px] text-ink-50 break-words">{error}</div>
              <button
                onClick={onReload}
                className="mt-3 rounded-full border border-ink-10 bg-white px-3 py-1 text-[11px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink"
              >
                🔄 ลองใหม่
              </button>
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-10 px-4 py-8 text-center">
              <div className="text-3xl">📋</div>
              <div className="mt-3 font-head text-[14px] font-bold text-ink">ยังไม่มีบันทึกที่นี่</div>
              <p className="mt-1 max-w-sm mx-auto font-thai text-[12px] text-ink-50">
                กรอก profile + วิเคราะห์ AI ครั้งแรก → ผลจะเก็บลง Supabase · กลับมาเปิดดูได้
              </p>
            </div>
          ) : (
            <>
              {records.map((r) => {
                const theme = r.verdict_level ? LEVEL_THEME[r.verdict_level] ?? LEVEL_THEME.warm : LEVEL_THEME.warm;
                const isEditing = editingId === r.id;
                const isLoading = loadingId === r.id;
                return (
                  <div
                    key={r.id}
                    className={`group rounded-2xl border bg-white px-4 py-3 transition-all overflow-hidden ${isEditing ? "border-rose/40 ring-1 ring-rose/20" : "border-ink-10 hover:border-ink-20"} ${isLoading ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <button
                        type="button"
                        onClick={() => onLoad(r)}
                        disabled={isLoading}
                        className="flex flex-1 min-w-0 items-center gap-3 text-left overflow-hidden disabled:cursor-wait"
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.bg} ${theme.text} ring-1 ${theme.ring} font-head font-extrabold text-[14px]`}>
                          {isLoading ? <span className="animate-spin">⌛</span> : r.total_score}
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-thai text-[14px] font-bold text-ink truncate min-w-0">{r.prospect_name}</span>
                            {isEditing && <span className="shrink-0 text-[10px] font-mono font-bold text-rose">EDITING</span>}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-ink-40 line-clamp-1 break-all">
                            {r.verdict_label ?? "—"}
                            {r.meeting_context ? ` · ${r.meeting_context}` : ""}
                          </div>
                        </div>
                        <div className="hidden md:block text-right shrink-0">
                          <div className="font-mono text-[10px] text-ink-40 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</div>
                          <div className="font-mono text-[9px] text-ink-30 whitespace-nowrap">{new Date(r.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</div>
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
