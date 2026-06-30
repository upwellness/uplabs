"use client";

/**
 * UP Labs v2 · CheckForm — FORM-Method lead qualification (SPEC §7.7)
 * ──────────────────────────────────────────────────────────────────
 * Clinical-warm coach tool. A 4-step FORM wizard (Family · Occupation ·
 * Recreation · Money) WITH a progress indicator (SPEC §6) feeds Gemini, which
 * returns a readiness/approach analysis + STP clip recommendations (1–3 clips
 * with copy-ready share message + follow-up). Saved records list reuses the same
 * v1 APIs (/api/checkform/records, /analyze, /recommend-clips). Bring-your-own
 * Gemini key gate (shared localStorage with v1 + NutriScan).
 *
 * Reuses v1 data + types (form-questions/profile-options/stp-clips, ai-analyze,
 * clip-matcher) — no v1 files are modified.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Sparkles, Save, RotateCcw, Loader2, ClipboardList, ChevronDown, Trash2,
  RefreshCw, Plus, Inbox, Pencil, Bot,
} from "lucide-react";
import { Shell } from "../_components/Shell";
import { Card, LoadingState, EmptyState, ErrorState } from "@/lib/v2/ui";
import { statusTextClass, type StatusLevel } from "@/lib/v2/status";
import { GeminiKeyField, getGeminiKey } from "@/components/GeminiKeyField";
import {
  EMPTY_PROFILE, EMPTY_DISC, type ProfileData, type DiscData,
} from "@/app/checkform/_components/ProfileForm";
import type { AIAnalysis, CheckformProfile } from "@/lib/checkform/ai-analyze";
import type { ClipRecommendations } from "@/lib/checkform/clip-matcher";
import { ProfileWizard } from "./_v2/ProfileWizard";
import { AnalysisModal } from "./_v2/AnalysisModal";

const STORAGE_KEY = "upwellness:checkform:draft:v2";

type Scores = Partial<Record<"F" | "O" | "R" | "M", 1 | 2 | 3>>;
type Notes = Partial<Record<"F" | "O" | "R" | "M", string>>;

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

/** Light list row (heavy jsonb dropped server-side — see /api/checkform/records). */
interface CheckformRecordLite {
  id: string;
  prospect_name: string;
  meeting_context: string | null;
  verdict_level: string | null;
  verdict_label: string | null;
  total_score: number;
  ai_analyzed_at: string | null;
  clip_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Full record (GET /api/checkform/records/[id]) carries the jsonb blobs. */
interface CheckformRecordFull extends CheckformRecordLite {
  scores: Scores;
  notes: Notes;
  profile?: ProfileData;
  disc_primary?: string | null;
  disc_secondary?: string | null;
  ai_analysis?: AIAnalysis | null;
  clip_recommendations?: ClipRecommendations | null;
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

/** Fill any missing profile branches (old/converted records can be partial). */
function normalizeProfile(p: any): ProfileData {
  const src = (p && typeof p === "object") ? p : {};
  return {
    demographics: { ...(src.demographics ?? {}) },
    career: { ...(src.career ?? {}) },
    lifestyle: { hobbies: [], ...(src.lifestyle ?? {}) },
    family: { ...(src.family ?? {}) },
  };
}

/** Verdict level → status token (one status system). */
const VERDICT_LEVEL: Record<string, StatusLevel> = {
  strong: "optimal",
  borderline: "caution",
  warm: "warning",
  not_ready: "danger",
};
function verdictLevel(v: string | null): StatusLevel {
  return (v && VERDICT_LEVEL[v]) || "caution";
}

export default function V2CheckFormPage() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(0);

  // Records
  const [records, setRecords] = useState<CheckformRecordLite[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [recordsOpen, setRecordsOpen] = useState(true);
  const [loadingRecordId, setLoadingRecordId] = useState<string | null>(null);

  // Save
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // AI analysis
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiAnalyzedAt, setAiAnalyzedAt] = useState<string | null>(null);
  const [aiCached, setAiCached] = useState(false);

  // STP clips
  const [clipRecs, setClipRecs] = useState<ClipRecommendations | null>(null);
  const [clipLoading, setClipLoading] = useState(false);
  const [clipError, setClipError] = useState<string | null>(null);
  const [clipGeneratedAt, setClipGeneratedAt] = useState<string | null>(null);
  const [clipCached, setClipCached] = useState(false);

  /* ── Hydrate / persist draft (localStorage) ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setDraft({
          ...EMPTY_DRAFT,
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

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, updatedAt: new Date().toISOString() })); } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [draft, hydrated]);

  /* ── Load records ── */
  const loadRecords = async () => {
    setRecordsLoading(true);
    setRecordsError(null);
    try {
      const res = await fetch("/api/checkform/records");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setRecords(json.records ?? []);
    } catch (e: any) {
      setRecordsError(e.message ?? "เครือข่ายผิดพลาด");
      setRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  };
  useEffect(() => { loadRecords(); }, []);

  /* ── Auto-load a record passed via ?load=<id> (from /v2/prospects convert) ── */
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (autoLoadedRef.current || records.length === 0 || typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("load");
    if (!id || !records.some((r) => r.id === id)) return;
    autoLoadedRef.current = true;
    window.history.replaceState({}, "", "/v2/checkform");
    void hydrateAndLoad(id, true);
  }, [records]);

  const applyRecord = (r: CheckformRecordFull) => {
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
    setRecordsOpen(false);
    setStep(0);
  };

  const hydrateAndLoad = async (id: string, skipConfirm = false) => {
    if (!skipConfirm && draft.prospectName) {
      const name = records.find((x) => x.id === id)?.prospect_name ?? "record นี้";
      if (!confirm(`โหลด '${name}' มาแทน · ข้อมูลปัจจุบันจะถูกแทนที่?`)) return;
    }
    setLoadingRecordId(id);
    try {
      const res = await fetch(`/api/checkform/records/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "โหลด record ไม่สำเร็จ");
      applyRecord(json.record);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      alert(e.message ?? "โหลด record ไม่สำเร็จ");
    } finally {
      setLoadingRecordId(null);
    }
  };

  const startNew = () => {
    if (draft.prospectName.trim() && !confirm("เริ่มใหม่ · ข้อมูลปัจจุบันจะถูกล้าง?")) return;
    setDraft({ ...EMPTY_DRAFT, updatedAt: new Date().toISOString() });
    setAiAnalysis(null); setAiAnalyzedAt(null); setAiCached(false); setAiError(null);
    setClipRecs(null); setClipGeneratedAt(null); setClipCached(false); setClipError(null);
    setStep(0);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  /* ── Save / delete ── */
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

  const saveRecord = async (): Promise<{ ok: boolean; id?: string; error?: string }> => {
    if (!draft.prospectName.trim()) return { ok: false, error: "กรุณากรอกชื่อ prospect ก่อน" };
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
        verdict_level: null,
        verdict_label: null,
        total_score: 0,
      };
      const editing = draft.editingRecordId;
      const res = await fetch(editing ? `/api/checkform/records/${editing}` : "/api/checkform/records", {
        method: editing ? "PATCH" : "POST",
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
    } finally {
      setSaving(false);
    }
  };

  const saveOnly = async () => {
    const r = await saveRecord();
    if (r.ok) {
      setSavedToast(draft.editingRecordId ? "อัปเดตแล้ว" : "บันทึกแล้ว");
      setTimeout(() => setSavedToast(null), 2000);
    } else {
      alert(r.error ?? "บันทึกไม่สำเร็จ");
    }
  };

  const deleteRecord = async (id: string, name: string) => {
    if (!confirm(`ลบบันทึก '${name}'?`)) return;
    try {
      const res = await fetch(`/api/checkform/records/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "delete failed");
      if (draft.editingRecordId === id) setDraft((d) => ({ ...d, editingRecordId: null }));
      await loadRecords();
    } catch (e: any) { alert(e.message); }
  };

  /* ── Robust JSON fetch helper for Gemini routes (handle HTML error pages) ── */
  const parseAiResponse = async (res: Response): Promise<any> => {
    const raw = await res.text();
    if (raw.trim().startsWith("<")) {
      if (res.status === 401 || raw.includes("login")) throw new Error("Session หมดอายุ · กรุณา refresh และ login ใหม่");
      if (res.status === 504 || res.status === 408) throw new Error("Gemini ใช้เวลานานเกินไป (timeout) · ลองใหม่อีกครั้ง");
      throw new Error(`Server ตอบ HTML แทน JSON (HTTP ${res.status})`);
    }
    let json: any;
    try { json = JSON.parse(raw); } catch { throw new Error(`Response parse ไม่ได้: ${raw.slice(0, 120)}`); }
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json;
  };

  /* ── STP clip recommendations ── */
  const recommendClips = async (analysisForClips: AIAnalysis | null, opts: { recordId?: string | null; force?: boolean } = {}) => {
    setClipError(null);
    const key = getGeminiKey();
    if (!key) { setClipError("กรุณาใส่ API Key ก่อน"); return; }
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
          apiKey: key,
        }),
      });
      const json = await parseAiResponse(res);
      setClipRecs(json.recommendations);
      setClipGeneratedAt(json.generated_at ?? new Date().toISOString());
      setClipCached(!!json.cached);
      if (opts.recordId ?? draft.editingRecordId) loadRecords();
    } catch (e: any) {
      setClipError(e.message);
    } finally {
      setClipLoading(false);
    }
  };

  /* ── AI analysis ── */
  const analyzeWithAI = async (force = false) => {
    const key = getGeminiKey();
    if (!key) {
      setAiOpen(true);
      setAiError("กรุณาใส่ API Key ก่อน (กดปุ่ม ใส่ API key ด้านล่าง)");
      return;
    }
    setAiOpen(true);
    setAiError(null);
    setAiLoading(true);
    if (force) { setClipRecs(null); setClipError(null); }
    try {
      let recordId = draft.editingRecordId ?? null;
      if (!recordId) {
        const saved = await saveRecord();
        if (!saved.ok) throw new Error(saved.error ?? "บันทึกก่อนวิเคราะห์ไม่สำเร็จ");
        recordId = saved.id ?? null;
      }
      const res = await fetch("/api/checkform/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: buildAIProfile(), recordId: recordId ?? undefined, force, apiKey: key }),
      });
      const json = await parseAiResponse(res);
      setAiAnalysis(json.analysis);
      setAiAnalyzedAt(json.analyzed_at ?? new Date().toISOString());
      setAiCached(!!json.cached);
      loadRecords();
      if (force || !clipRecs) void recommendClips(json.analysis, { recordId, force });
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  /* ── Readiness gate: ≥3 fields + a name (matches v1 threshold) ── */
  const profileFilled = useMemo(() => {
    const p = draft.profile;
    let n = 0;
    if (p.demographics.ageRange) n++;
    if (p.career.occupation) n++;
    if (p.career.incomeRange) n++;
    if (p.lifestyle.healthAwareness) n++;
    if (p.family.deps) n++;
    return n;
  }, [draft.profile]);
  const ready = profileFilled >= 3 && draft.prospectName.trim().length > 0;

  const breadcrumb = [{ label: "หน้าแรก", href: "/v2" }, { label: "CheckForm" }];

  return (
    <Shell breadcrumb={breadcrumb}>
      {/* Page header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-head text-[24px] font-extrabold tracking-tight text-ink">วิเคราะห์ Prospect · FORM Method</h1>
          <p className="mt-1 max-w-2xl font-thai text-[13px] text-ink-60">
            กรอกทีละด้าน (Family · Occupation · Recreation · Money) แล้วให้ AI แนะนำวิธีเข้าหา + คลิปคนสำเร็จที่ตรงกับเขา · กรอกเฉพาะที่รู้ก็พอ
          </p>
        </div>
        {draft.editingRecordId && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-ultra px-3 py-1.5 text-[12px] font-semibold text-rose">
            <Pencil size={13} strokeWidth={2.25} aria-hidden /> กำลังแก้บันทึกเดิม
            <button type="button" onClick={startNew} className="ml-1 underline-offset-2 hover:underline">เริ่มใหม่</button>
          </span>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* ── Main column ── */}
        <div className="space-y-5">
          <RecordsPanel
            records={records}
            loading={recordsLoading}
            error={recordsError}
            open={recordsOpen}
            setOpen={setRecordsOpen}
            editingId={draft.editingRecordId ?? null}
            loadingId={loadingRecordId}
            onLoad={(id) => void hydrateAndLoad(id)}
            onDelete={deleteRecord}
            onStartNew={startNew}
            onReload={loadRecords}
          />

          {/* Prospect identity */}
          <Card className={`p-4 lg:p-5 ${draft.editingRecordId ? "ring-1 ring-rose/15" : ""}`}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[12px] font-semibold text-ink-60">ชื่อที่จะวิเคราะห์</span>
                <input
                  value={draft.prospectName}
                  onChange={(e) => setDraft((d) => ({ ...d, prospectName: e.target.value }))}
                  placeholder="คุณ___"
                  className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:ring-2 focus:ring-rose-ultra"
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-semibold text-ink-60">บริบทที่เจอ</span>
                <input
                  value={draft.meetingContext}
                  onChange={(e) => setDraft((d) => ({ ...d, meetingContext: e.target.value }))}
                  placeholder="เจอที่ไหน · ใครแนะนำ · meeting ครั้งที่…"
                  className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:ring-2 focus:ring-rose-ultra"
                />
              </label>
            </div>
          </Card>

          {/* FORM wizard with progress */}
          <ProfileWizard
            step={step}
            setStep={setStep}
            profile={draft.profile}
            disc={draft.disc}
            onProfileChange={(p) => setDraft((d) => ({ ...d, profile: p }))}
            onDiscChange={(disc) => setDraft((d) => ({ ...d, disc }))}
          />

          {/* AI action */}
          <Card className="space-y-4 border-rose/15 p-4 lg:p-5">
            <div className="flex items-start gap-2.5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-ultra text-rose">
                <Sparkles size={18} strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="font-head text-[17px] font-bold text-ink">วิเคราะห์ด้วย AI</h2>
                <p className="mt-0.5 font-thai text-[12.5px] leading-relaxed text-ink-60">
                  Gemini อ่าน profile + DISC → ได้วิธีเข้าหา · สัดส่วน สุขภาพ:โอกาส · ตัวอย่างบทสนทนา · จำลองบทสนทนา · และคลิปคนสำเร็จที่ตรงกับเขา
                </p>
              </div>
            </div>

            <GeminiKeyField />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={startNew}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-2 text-[12px] font-semibold text-ink-60 transition-colors hover:border-ink-20 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
              >
                <RotateCcw size={13} strokeWidth={2.25} aria-hidden /> ล้าง
              </button>
              <button
                type="button"
                onClick={saveOnly}
                disabled={!draft.prospectName.trim() || saving}
                title="บันทึกเก็บไว้ · ไม่ต้องรอ AI"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-2 text-[12px] font-semibold text-ink-80 transition-colors hover:border-rose hover:text-rose disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
              >
                {saving ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Save size={13} strokeWidth={2.25} aria-hidden />}
                {draft.editingRecordId ? "อัปเดต" : "บันทึก"}
              </button>
              <button
                type="button"
                onClick={() => analyzeWithAI(false)}
                disabled={!ready || aiLoading}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-rose px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-rose-mid disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 sm:flex-none"
              >
                {aiLoading ? <><Loader2 size={15} className="animate-spin" aria-hidden /> กำลังวิเคราะห์…</>
                  : !draft.prospectName.trim() ? "ใส่ชื่อก่อน"
                  : profileFilled < 3 ? `กรอกอีก ${3 - profileFilled} ฟิลด์`
                  : aiAnalysis ? <><Sparkles size={15} strokeWidth={2.25} aria-hidden /> เปิดผลวิเคราะห์</>
                  : <><Sparkles size={15} strokeWidth={2.25} aria-hidden /> บันทึก + วิเคราะห์ AI</>}
              </button>
              {savedToast && (
                <span className="inline-flex items-center gap-1 rounded-full bg-wellness px-3 py-1 text-[11px] font-semibold text-white">{savedToast}</span>
              )}
            </div>

            {aiAnalysis && !aiLoading && (
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                className="flex w-full items-center gap-3 rounded-xl border border-rose/20 bg-rose-ultra/50 px-4 py-3 text-left transition-colors hover:border-rose/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-rose">
                  <Bot size={17} strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-thai text-[13px] font-semibold text-ink">มีผลวิเคราะห์อยู่แล้ว · <span className="text-rose">คลิกเพื่อเปิดดู</span></div>
                  <div className="mt-0.5 font-mono text-[11px] text-ink-40">
                    {analysisTitle(aiAnalysis)}{aiAnalyzedAt ? ` · ${new Date(aiAnalyzedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}` : ""}
                  </div>
                </div>
              </button>
            )}
          </Card>
        </div>

        {/* ── Sidebar summary ── */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-4 lg:p-5">
            <div className="text-[12px] font-semibold text-ink-60">ความพร้อมข้อมูล</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-head text-[36px] font-extrabold leading-none text-ink">{profileFilled}</span>
              <span className="font-mono text-[13px] text-ink-30">/ 5 ฟิลด์หลัก</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-5">
              <div className={`h-full transition-all ${ready ? "bg-wellness" : "bg-rose"}`} style={{ width: `${Math.min(profileFilled / 3, 1) * 100}%` }} />
            </div>
            <p className="mt-2 font-thai text-[12px] leading-relaxed text-ink-60">
              {ready ? "พร้อมวิเคราะห์ AI แล้ว" : `กรอกอย่างน้อย 3 ฟิลด์หลัก + ชื่อ เพื่อให้ AI วิเคราะห์ได้ (ขาดอีก ${Math.max(0, 3 - profileFilled)})`}
            </p>
          </Card>

          <Card className="p-4 lg:p-5">
            <div className="text-[12px] font-semibold text-ink-60">FORM Method คืออะไร</div>
            <ul className="mt-2 space-y-1.5 font-thai text-[12px] leading-relaxed text-ink-60">
              <li><b className="text-rose">F</b>amily — ครอบครัว · คนที่เขาแคร์</li>
              <li><b className="text-rose">O</b>ccupation — งาน · รายได้</li>
              <li><b className="text-rose">R</b>ecreation — ไลฟ์สไตล์ · สุขภาพ</li>
              <li><b className="text-rose">M</b>oney — เงิน · เป้าหมาย</li>
            </ul>
            <p className="mt-3 border-t border-ink-5 pt-3 font-thai text-[11.5px] leading-relaxed text-ink-40">
              ฟังก่อน · แนะนำทีหลัง · ทุกคำแนะนำเพื่อ wellness coaching ไม่ใช่การกดดันขาย
            </p>
          </Card>
        </aside>
      </div>

      <AnalysisModal
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
    </Shell>
  );
}

function analysisTitle(a: AIAnalysis): string {
  return `${a.approach.type.toUpperCase()} · สุขภาพ ${a.approach.productRatio}% · โอกาส ${a.approach.businessRatio}%`;
}

/* ─────────────────────────── Records panel ─────────────────────────── */

function RecordsPanel({
  records, loading, error, open, setOpen, editingId, loadingId, onLoad, onDelete, onStartNew, onReload,
}: {
  records: CheckformRecordLite[];
  loading: boolean;
  error: string | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  editingId: string | null;
  loadingId: string | null;
  onLoad: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onStartNew: () => void;
  onReload: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-surface lg:px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-ultra text-rose">
            <ClipboardList size={18} strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="font-head text-[15px] font-bold text-ink">prospect ที่เคยวิเคราะห์</div>
            <div className="mt-0.5 font-thai text-[12px] text-ink-60">
              {loading ? "กำลังโหลด…" : error ? "โหลดไม่สำเร็จ" : records.length > 0 ? `${records.length} คน · คลิกเพื่อเปิดมาดู/แก้` : "ยังไม่มีบันทึก"}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {records.length > 0 && <span className="rounded-full bg-rose px-2 py-0.5 text-[11px] font-bold text-white">{records.length}</span>}
          <ChevronDown size={16} strokeWidth={2.25} className={`text-ink-30 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </div>
      </button>

      {open && (
        <div className="border-t border-ink-5 px-4 py-4 lg:px-5">
          {loading ? (
            <LoadingState label="กำลังโหลดรายชื่อ…" />
          ) : error ? (
            <ErrorState message={error} onRetry={onReload} />
          ) : records.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="ยังไม่มีบันทึก"
              hint="กรอก profile แล้วกด บันทึก หรือ วิเคราะห์ AI · ผลจะมาอยู่ตรงนี้"
            />
          ) : (
            <div className="space-y-2">
              {records.map((r) => {
                const lv = verdictLevel(r.verdict_level);
                const isEditing = editingId === r.id;
                const isLoading = loadingId === r.id;
                return (
                  <div
                    key={r.id}
                    className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 transition-colors ${isEditing ? "border-rose/40 ring-1 ring-rose/15" : "border-ink-10 hover:border-ink-20"} ${isLoading ? "opacity-60" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => onLoad(r.id)}
                      disabled={isLoading}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-1 rounded-lg"
                    >
                      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-head text-[14px] font-extrabold ${statusBgClass(lv)} ${statusTextClass[lv]}`}>
                        {isLoading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : (r.total_score || "–")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-head text-[14px] font-bold text-ink">{r.prospect_name}</span>
                          {isEditing && <span className="shrink-0 font-mono text-[10px] font-bold text-rose">กำลังแก้</span>}
                          {r.ai_analyzed_at && <Bot size={13} strokeWidth={2} className="shrink-0 text-rose" aria-label="มีผลวิเคราะห์ AI" />}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-ink-40">
                          {r.verdict_label ?? "ยังไม่มีผล"}{r.meeting_context ? ` · ${r.meeting_context}` : ""}
                        </div>
                      </div>
                      <span className="hidden shrink-0 font-mono text-[11px] text-ink-30 sm:block">
                        {new Date(r.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(r.id, r.prospect_name)}
                      aria-label={`ลบบันทึก ${r.prospect_name}`}
                      className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg text-ink-40 transition-colors hover:bg-status-bg-danger hover:text-status-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-1"
                    >
                      <Trash2 size={15} strokeWidth={2.25} aria-hidden />
                    </button>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={onReload} className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-40 hover:text-ink-80">
                  <RefreshCw size={12} strokeWidth={2.25} aria-hidden /> รีเฟรช
                </button>
                <button type="button" onClick={onStartNew} className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose hover:underline">
                  <Plus size={12} strokeWidth={2.5} aria-hidden /> วิเคราะห์คนใหม่
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/** Status token → soft bg class (avatar tile). */
function statusBgClass(lv: StatusLevel): string {
  switch (lv) {
    case "optimal": return "bg-status-bg-optimal";
    case "good": return "bg-status-bg-good";
    case "caution": return "bg-status-bg-caution";
    case "warning": return "bg-status-bg-warning";
    case "danger": return "bg-status-bg-danger";
  }
}
