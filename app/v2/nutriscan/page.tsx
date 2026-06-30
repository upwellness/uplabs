"use client";

/**
 * UP Labs v2 · NutriScan AI (SPEC §7.9)
 * ─────────────────────────────────────
 * Upload food image (or describe in text) → POST /api/nutriscan (Gemini Vision, BYO key) →
 * macros C:P:F + glucose impact + health score + Nutrilite SKU match. Recent scans list
 * from GET /api/nutriscan. Optional ?customer=<id> prefills the "save for" target.
 *
 * Reuse (no contract change):
 *   - API:   POST/GET /api/nutriscan (same payload as v1 NutriScanClient)
 *   - key:   GeminiKeyField + getGeminiKey (shared localStorage BYO key)
 *   - calc:  macroBreakdown (lib/nutriscan/macros) — C·P=4, F=9 kcal/g
 *   - chart: CPFPie (lazy via next/dynamic — pure SVG, kept out of First-Load JS)
 *
 * Clinical-warm: lib/v2/ui primitives, Lucide icons, status TEXT via statusTextHex,
 * empty/loading/error states, ≥44px touch targets, keyboard-accessible.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Camera, PencilLine, Sparkles, Loader2, X, ImagePlus, Salad, ListChecks,
  CalendarDays, ThumbsUp, ThumbsDown, FlaskConical, ArrowRight, TrendingUp, Heart, Leaf,
  Save, History, PieChart, ChevronRight,
} from "lucide-react";
import { Shell } from "../_components/Shell";
import { Card, SectionLabel, LoadingState, EmptyState, IconChip } from "@/lib/v2/ui";
import { GeminiKeyField, getGeminiKey } from "@/components/GeminiKeyField";
import { macroBreakdown } from "@/lib/nutriscan/macros";
import { statusTextHex } from "@/lib/v2/status";

/** CPFPie is pure SVG but lazy-loaded per SPEC §8 ("กราฟ lazy"). */
const CPFPie = dynamic(() => import("@/components/CPFPie").then((m) => m.CPFPie), {
  ssr: false,
  loading: () => <div className="flex h-[170px] w-[170px] items-center justify-center"><Loader2 size={22} className="animate-spin text-rose" aria-hidden /></div>,
});

interface CustomerOpt { id: string; name: string }

interface ScanRow {
  id: string;
  food_identified: string | null;
  meal_type: string | null;
  calories_estimate: number | null;
  carb_g: number | null;
  protein_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  glucose_impact_score: number | null;
  health_score: number | null;
  created_at: string;
  eaten_on: string | null;
  customer_id: string | null;
  notes: string | null;
}

interface NutriComponent {
  name: string;
  pct: number;
  carb_g?: number;
  protein_g?: number;
  fat_g?: number;
}

interface AnalysisResult {
  food_identified: string;
  food_components?: string[];
  components?: NutriComponent[];
  estimated_portion?: string;
  calories_estimate?: number;
  macros?: { carb_g: number; protein_g: number; fat_g: number; fiber_g: number };
  glucose_impact?: { score: number; explanation: string };
  health_score?: { score: number; pros: string[]; cons: string[] };
  recommendations?: { modifications: string[]; nutrilite_skus: Array<{ sku: string; reason: string }> };
  alternative_meals?: string[];
  error?: string;
}

/** Today in Asia/Bangkok (UTC+7) as yyyy-mm-dd. */
function todayBKK() {
  const d = new Date();
  d.setHours(d.getHours() + 7);
  return d.toISOString().slice(0, 10);
}

const MEAL_OPTIONS = [
  { value: "breakfast", label: "เช้า" },
  { value: "lunch", label: "กลางวัน" },
  { value: "dinner", label: "เย็น" },
  { value: "snack", label: "ของว่าง" },
];
const MEAL_LABEL_TH: Record<string, string> = { breakfast: "เช้า", lunch: "กลางวัน", dinner: "เย็น", snack: "ของว่าง" };

type InputMode = "image" | "text";

/** Score 1–10 → status level (higher health = better; higher glucose = worse). */
function healthLevel(score: number) { return score >= 7 ? "optimal" : score >= 4 ? "caution" : "danger"; }
function glucoseLevel(score: number) { return score >= 7 ? "danger" : score >= 4 ? "caution" : "optimal"; }

export default function V2NutriScanPage() {
  return (
    <Suspense
      fallback={
        <Shell breadcrumb={[{ label: "หน้าแรก", href: "/v2" }, { label: "NutriScan" }]}>
          <Card><LoadingState /></Card>
        </Shell>
      }
    >
      <NutriScanInner />
    </Suspense>
  );
}

function NutriScanInner() {
  const search = useSearchParams();
  const presetCustomer = search.get("customer") ?? "";

  const [mode, setMode] = useState<InputMode>("image");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [textDesc, setTextDesc] = useState("");
  const [mealType, setMealType] = useState("lunch");
  const [customerId, setCustomerId] = useState<string>(presetCustomer);
  const [notes, setNotes] = useState("");
  const [eatenOn, setEatenOn] = useState<string>(todayBKK());
  const [saveToHistory, setSaveToHistory] = useState(true);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<ScanRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/customers/list");
      const json = await res.json();
      setCustomers((json.customers ?? []).map((c: any) => ({ id: c.id, name: c.name })));
    } catch { /* non-fatal — picker just stays "self only" */ }
  }, []);

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (customerId) params.set("customer_id", customerId);
      const res = await fetch(`/api/nutriscan?${params}`);
      const json = await res.json();
      let rows: ScanRow[] = json.scans ?? [];
      // "ตัวเอง" = scans with no customer_id (server returns all this user's scans).
      if (!customerId) rows = rows.filter((r) => !r.customer_id);
      setRecent(rows);
    } catch { /* non-fatal */ } finally {
      setRecentLoading(false);
    }
  }, [customerId]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);
  useEffect(() => { loadRecent(); }, [loadRecent]);
  useEffect(() => { setCustomerId(presetCustomer); }, [presetCustomer]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("ต้องเป็นไฟล์รูปภาพเท่านั้น"); return; }
    const dataUrl = await compressImage(file, 1280, 0.85);
    setImageDataUrl(dataUrl);
    setResult(null);
    setError(null);
  };

  const analyze = async () => {
    if (mode === "image" && !imageDataUrl) return;
    if (mode === "text" && !textDesc.trim()) return;
    const geminiKey = getGeminiKey();
    if (!geminiKey) {
      const msg = "กรุณาใส่ Gemini API key ก่อน (กดปุ่มตั้งค่า API key ด้านบน)";
      setError(msg);
      if (typeof window !== "undefined") window.alert(msg);
      return;
    }
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const payload: Record<string, any> = {
        meal_type: mealType,
        customer_id: customerId || null,
        notes: notes.trim() || null,
        eaten_on: eatenOn || null,
        save: saveToHistory,
        apiKey: geminiKey,
      };
      if (mode === "image" && imageDataUrl) {
        const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!match) throw new Error("รูปภาพไม่ถูกต้อง ลองเลือกใหม่อีกครั้ง");
        payload.image_base64 = match[2];
        payload.mime_type = match[1];
      } else {
        payload.text_description = textDesc.trim();
      }
      const res = await fetch("/api/nutriscan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "วิเคราะห์ไม่สำเร็จ");
      setResult(json.result);
      if (json.saved) loadRecent();
    } catch (e: any) {
      setError(e.message ?? "วิเคราะห์ไม่สำเร็จ");
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setImageDataUrl(null);
    setTextDesc("");
    setResult(null);
    setError(null);
    setNotes("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const canAnalyze = (mode === "image" && !!imageDataUrl) || (mode === "text" && textDesc.trim().length > 3);
  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <Shell breadcrumb={[{ label: "หน้าแรก", href: "/v2" }, { label: "NutriScan" }]}>
      {/* Page header (SPEC §6) */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-3">
          <IconChip icon={Salad} tone="rose" size={20} className="mt-0.5 h-10 w-10" />
          <div>
            <h1 className="font-head text-[23px] font-extrabold tracking-tight text-ink">NutriScan AI</h1>
            <p className="mt-1 max-w-2xl font-thai text-[13px] leading-[1.6] text-ink-60">
              ถ่ายรูปอาหารหรือพิมพ์อธิบาย → AI วิเคราะห์ macros (C:P:F) · glucose impact · health score พร้อมจับคู่ Nutrilite ที่เหมาะกับมื้อนี้
            </p>
          </div>
        </div>
        <Link
          href="/v2/nutriscan/log"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-2 text-[13px] font-semibold text-ink-80 transition-colors hover:border-rose hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
        >
          <CalendarDays size={15} strokeWidth={2.25} aria-hidden /> บันทึกรายวัน
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr,340px]">
        {/* ── Main column ── */}
        <div className="space-y-5">
          <GeminiKeyField />

          {/* Capture card */}
          <Card className="p-4 lg:p-5">
            <div className="mb-4 flex items-center gap-1.5">
              <ImagePlus size={15} strokeWidth={2.25} className="text-rose" aria-hidden />
              <h2 className="font-head text-[15px] font-bold text-ink">บันทึกมื้ออาหาร</h2>
            </div>

            {/* save-for + meal */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr,160px]">
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-60">บันทึกให้ใคร</span>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-rose focus:ring-2 focus:ring-rose-ultra"
                >
                  <option value="">ตัวเอง (โปรไฟล์ของคุณ)</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-ink-60">มื้อ</span>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-rose focus:ring-2 focus:ring-rose-ultra"
                >
                  {MEAL_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </label>
            </div>

            {/* Mode tabs (segmented, keyboard-accessible) */}
            <div role="tablist" aria-label="วิธีบันทึกอาหาร" className="mt-4 inline-flex w-fit gap-1 rounded-full bg-surface p-1">
              <TabBtn active={mode === "image"} onClick={() => { setMode("image"); setResult(null); }} icon={Camera} label="ถ่ายรูป" />
              <TabBtn active={mode === "text"} onClick={() => { setMode("text"); setResult(null); }} icon={PencilLine} label="พิมพ์อธิบาย" />
            </div>

            {/* Image mode */}
            {mode === "image" && (
              <div className="mt-4">
                {!imageDataUrl ? (
                  <label className="block cursor-pointer">
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPickFile} className="sr-only" />
                    <div className="flex min-h-[176px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-10 bg-surface px-4 py-8 text-center transition-colors hover:border-rose hover:bg-rose-ultra">
                      <Camera size={30} strokeWidth={1.75} className="mb-2 text-rose" aria-hidden />
                      <div className="font-thai text-[14px] font-semibold text-ink">แตะเพื่อถ่ายรูป หรือเลือกรูปอาหาร</div>
                      <div className="mt-1 font-mono text-[11px] text-ink-40">JPG · PNG · WebP</div>
                    </div>
                  </label>
                ) : (
                  <div className="relative overflow-hidden rounded-2xl border border-ink-10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageDataUrl} alt="รูปอาหารที่เลือก" className="h-72 w-full object-cover" />
                    <button
                      type="button"
                      onClick={reset}
                      aria-label="ลบรูปและเริ่มใหม่"
                      className="absolute right-2 top-2 inline-flex h-[44px] w-[44px] items-center justify-center rounded-full bg-white/90 text-ink-60 shadow-sm backdrop-blur transition-colors hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose"
                    >
                      <X size={18} strokeWidth={2.25} aria-hidden />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Text mode */}
            {mode === "text" && (
              <div className="mt-4">
                <label className="sr-only" htmlFor="food-text">บรรยายอาหาร</label>
                <textarea
                  id="food-text"
                  value={textDesc}
                  onChange={(e) => setTextDesc(e.target.value)}
                  rows={4}
                  placeholder="เช่น ข้าวกะเพราหมูสับไข่ดาว 1 จาน · ข้าว 1 ทัพพี · น้ำเปล่า"
                  className="w-full rounded-2xl border border-ink-10 bg-white px-3.5 py-3 text-[14px] font-thai text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:ring-2 focus:ring-rose-ultra"
                />
                <p className="mt-1.5 font-thai text-[12px] text-ink-40">บรรยายให้ละเอียด — ส่วนประกอบ · ปริมาณ · วิธีปรุง จะแม่นขึ้น</p>
              </div>
            )}

            {/* Date eaten + meal-eaten note (a hint the AI uses) */}
            <label className="mt-4 block sm:max-w-[220px]">
              <span className="mb-1 block text-[12px] font-semibold text-ink-60">วันที่กิน</span>
              <input
                type="date"
                value={eatenOn}
                max={todayBKK()}
                onChange={(e) => setEatenOn(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-rose focus:ring-2 focus:ring-rose-ultra"
              />
            </label>

            {/* Notes — labelled as a HINT that helps the AI estimate */}
            <label className="mt-4 block">
              <span className="mb-1 block text-[12px] font-semibold text-ink-60">
                หมายเหตุ/บอกสัดส่วนที่รู้ <span className="font-normal text-ink-40">(ช่วย AI ประเมินแม่นขึ้น)</span>
              </span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เช่น ข้าว 2 ทัพพี · อกไก่ ~150g · ไม่ใส่น้ำมัน"
                className="min-h-[44px] w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:ring-2 focus:ring-rose-ultra"
              />
              <p className="mt-1.5 font-thai text-[12px] text-ink-40">
                ถ้ารูปกะสัดส่วนไม่เป๊ะ บอกปริมาณ/ส่วนผสมที่รู้ตรงนี้ได้ — AI จะใช้ช่วยประเมิน
              </p>
            </label>

            {/* Save-to-history toggle */}
            <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-ink-10 bg-surface px-3.5 py-3">
              <div className="flex items-start gap-2">
                <Save size={15} strokeWidth={2.25} className="mt-0.5 shrink-0 text-rose" aria-hidden />
                <div>
                  <div className="font-thai text-[13px] font-semibold text-ink">บันทึกเข้าประวัติ</div>
                  <div className="font-thai text-[12px] text-ink-40">
                    {saveToHistory ? "ผลจะถูกเก็บในบันทึกรายวัน" : "วิเคราะห์อย่างเดียว ไม่เก็บลงประวัติ"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={saveToHistory}
                aria-label="บันทึกเข้าประวัติ"
                onClick={() => setSaveToHistory((v) => !v)}
                className={`relative inline-flex h-[28px] min-h-[28px] w-[48px] shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 ${
                  saveToHistory ? "bg-rose" : "bg-ink-20"
                }`}
              >
                <span className={`inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow transition-transform ${saveToHistory ? "translate-x-[23px]" : "translate-x-[3px]"}`} />
              </button>
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={analyze}
                disabled={analyzing || !canAnalyze}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full bg-rose px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-rose-mid disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
              >
                {analyzing ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} strokeWidth={2.25} aria-hidden />}
                {analyzing ? "กำลังวิเคราะห์…" : saveToHistory ? "วิเคราะห์ + บันทึก" : "วิเคราะห์ (ไม่บันทึก)"}
              </button>
              {(imageDataUrl || textDesc) && !analyzing && (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink-60 transition-colors hover:bg-ink-5"
                >
                  ล้าง
                </button>
              )}
            </div>

            {selectedCustomer && saveToHistory && (
              <p className="mt-3 font-thai text-[12px] text-ink-60">
                จะบันทึกให้ <span className="font-semibold text-rose">{selectedCustomer.name}</span>
              </p>
            )}

            {error && (
              <div className="mt-4 rounded-xl bg-status-bg-danger px-3.5 py-2.5 font-thai text-[13px] text-status-danger" role="alert">
                {error}
              </div>
            )}
          </Card>

          {/* Result */}
          {result && <ResultCard result={result} />}
        </div>

        {/* ── History sidebar ── */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card className="p-4 lg:p-5">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <History size={15} strokeWidth={2.25} className="text-rose" aria-hidden />
                <h2 className="font-head text-[15px] font-bold text-ink">ประวัติการสแกน</h2>
              </div>
              {!recentLoading && recent.length > 0 && (
                <span className="rounded-full bg-ink-5 px-2 py-0.5 font-mono text-[11px] text-ink-60">{recent.length}</span>
              )}
            </div>
            <p className="mb-3 font-thai text-[11px] text-ink-40">
              {selectedCustomer ? <>ของ <span className="font-semibold text-rose">{selectedCustomer.name}</span></> : "ของตัวเอง"} · แตะเพื่อดูรายละเอียดเต็ม
            </p>
            {recentLoading ? (
              <LoadingState label="กำลังโหลด…" />
            ) : recent.length === 0 ? (
              <EmptyState icon={Salad} title="ยังไม่มีบันทึก" hint="วิเคราะห์มื้อแรกเพื่อเริ่มเก็บประวัติ" />
            ) : (
              <ul className="max-h-[600px] space-y-2 overflow-y-auto pr-1">
                {recent.map((r) => <RecentItem key={r.id} row={r} customers={customers} onOpen={() => setDetailId(r.id)} />)}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      {detailId && <ScanDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </Shell>
  );
}

/* ───────────────────────── Sub-components ───────────────────────── */

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Camera; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose ${
        active ? "bg-rose text-white" : "text-ink-60 hover:text-ink"
      }`}
    >
      <Icon size={14} strokeWidth={2.25} aria-hidden /> {label}
    </button>
  );
}

function ResultCard({ result }: { result: AnalysisResult }) {
  if (result.error) {
    return (
      <Card className="p-4 lg:p-5">
        <div className="font-thai text-[13px] text-status-danger" role="alert">{result.error}</div>
      </Card>
    );
  }

  const gi = result.glucose_impact;
  const hs = result.health_score;
  const m = result.macros;
  const b = m ? macroBreakdown(m) : null;

  return (
    <Card className="space-y-5 p-4 lg:p-5">
      {/* Header */}
      <div>
        <SectionLabel>ผลการวิเคราะห์</SectionLabel>
        <h2 className="mt-1 font-head text-[20px] font-extrabold tracking-tight text-ink">{result.food_identified}</h2>
        {result.estimated_portion && <p className="mt-0.5 font-thai text-[12px] text-ink-60">{result.estimated_portion}</p>}
        {/* Component chips: prefer the new %-breakdown's names, else the legacy flat list */}
        {result.components && result.components.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.components.map((c, i) => (
              <span key={i} className="rounded-full bg-surface px-2.5 py-1 font-thai text-[11px] text-ink-60">{c.name}</span>
            ))}
          </div>
        ) : result.food_components && result.food_components.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.food_components.map((c, i) => (
              <span key={i} className="rounded-full bg-surface px-2.5 py-1 font-thai text-[11px] text-ink-60">{c}</span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Per-ingredient % breakdown (new) */}
      {result.components && result.components.length > 0 && <ComponentBreakdown components={result.components} />}

      {/* Two scores */}
      {(gi || hs) && (
        <div className="grid grid-cols-2 gap-3">
          {gi && <ScoreCard label="Glucose impact" icon={TrendingUp} score={gi.score} note={gi.explanation} level={glucoseLevel(gi.score)} />}
          {hs && <ScoreCard label="Health score" icon={Heart} score={hs.score} note={hs.pros.slice(0, 2).join(" · ")} level={healthLevel(hs.score)} />}
        </div>
      )}

      {/* Calories + macros + pie */}
      {(result.calories_estimate || m) && b && (
        <div className="rounded-2xl border border-ink-10 bg-surface p-4 lg:p-5">
          <div className="grid items-center gap-5 sm:grid-cols-[180px,1fr]">
            <div className="flex justify-center">
              <CPFPie carb_pct={b.carb_pct} protein_pct={b.protein_pct} fat_pct={b.fat_pct} total_kcal={result.calories_estimate ?? b.total_kcal} size={170} />
            </div>
            <div>
              <SectionLabel>สัดส่วนพลังงาน (C:P:F)</SectionLabel>
              <div className="mt-2 space-y-2">
                {m && (
                  <>
                    <MacroRow label="คาร์โบไฮเดรต (Carb)" g={m.carb_g} kcal={b.carb_kcal} pct={b.carb_pct} color="rose" />
                    <MacroRow label="โปรตีน (Protein)" g={m.protein_g} kcal={b.protein_kcal} pct={b.protein_pct} color="wellness" />
                    <MacroRow label="ไขมัน (Fat)" g={m.fat_g} kcal={b.fat_kcal} pct={b.fat_pct} color="amber" />
                  </>
                )}
              </div>
              {m && m.fiber_g > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-science-pale bg-science-ultra px-3 py-2 font-mono text-[11px] text-science">
                  <Leaf size={13} strokeWidth={2.25} aria-hidden />
                  <span><b>ไฟเบอร์ {m.fiber_g}g</b> · ไม่นับในพลังงาน</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pros / Cons */}
      {hs && (hs.pros.length > 0 || hs.cons.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {hs.pros.length > 0 && (
            <div className="rounded-2xl border border-status-optimal/20 bg-status-bg-optimal/40 p-4">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: statusTextHex.optimal }}>
                <ThumbsUp size={13} strokeWidth={2.25} aria-hidden /> จุดดี
              </div>
              <ul className="mt-2 space-y-1.5">
                {hs.pros.map((p, i) => <li key={i} className="font-thai text-[12px] leading-relaxed text-ink">• {p}</li>)}
              </ul>
            </div>
          )}
          {hs.cons.length > 0 && (
            <div className="rounded-2xl border border-status-danger/20 bg-status-bg-danger/40 p-4">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: statusTextHex.danger }}>
                <ThumbsDown size={13} strokeWidth={2.25} aria-hidden /> จุดที่ควรระวัง
              </div>
              <ul className="mt-2 space-y-1.5">
                {hs.cons.map((c, i) => <li key={i} className="font-thai text-[12px] leading-relaxed text-ink">• {c}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Recommendations + Nutrilite */}
      {result.recommendations && (result.recommendations.modifications.length > 0 || result.recommendations.nutrilite_skus.length > 0) && (
        <div className="rounded-2xl border border-rose-pale bg-rose-ultra p-4">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-rose">
            <Sparkles size={13} strokeWidth={2.25} aria-hidden /> ปรับมื้อนี้ให้ดีขึ้น
          </div>
          {result.recommendations.modifications.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {result.recommendations.modifications.map((mod, i) => <li key={i} className="font-thai text-[13px] leading-relaxed text-ink">• {mod}</li>)}
            </ul>
          )}
          {result.recommendations.nutrilite_skus.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-rose">
                <FlaskConical size={13} strokeWidth={2.25} aria-hidden /> Nutrilite ที่เหมาะกับมื้อนี้
              </div>
              {result.recommendations.nutrilite_skus.map((s, i) => (
                <div key={i} className="rounded-xl border border-ink-10 bg-white px-3 py-2">
                  <div className="font-thai text-[13px] font-bold text-rose">{s.sku}</div>
                  <div className="mt-0.5 font-thai text-[12px] text-ink-60">{s.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alternatives */}
      {result.alternative_meals && result.alternative_meals.length > 0 && (
        <div className="rounded-2xl border border-ink-10 bg-surface p-4">
          <SectionLabel>ทางเลือกที่ดีต่อสุขภาพมากกว่า</SectionLabel>
          <ul className="mt-2 space-y-1.5">
            {result.alternative_meals.map((a, i) => (
              <li key={i} className="flex items-start gap-1.5 font-thai text-[12px] leading-relaxed text-ink">
                <ArrowRight size={13} strokeWidth={2.25} className="mt-0.5 shrink-0 text-wellness" aria-hidden /> {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** Per-ingredient % breakdown — name + share bar, optional per-component macros. */
function ComponentBreakdown({ components }: { components: NutriComponent[] }) {
  const items = components.filter((c) => c && c.name).map((c) => ({ ...c, pct: Math.max(0, Math.round(Number(c.pct) || 0)) }));
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-ink-10 bg-surface p-4">
      <div className="flex items-center gap-1.5">
        <PieChart size={14} strokeWidth={2.25} className="text-rose" aria-hidden />
        <SectionLabel>สัดส่วนแต่ละอย่างในจาน</SectionLabel>
      </div>
      <ul className="mt-3 space-y-2.5">
        {items.map((c, i) => {
          const macroBits = [
            c.carb_g != null ? `C ${c.carb_g}g` : null,
            c.protein_g != null ? `P ${c.protein_g}g` : null,
            c.fat_g != null ? `F ${c.fat_g}g` : null,
          ].filter(Boolean).join(" · ");
          return (
            <li key={i}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-thai text-[13px] font-semibold text-ink">{c.name}</span>
                <span className="shrink-0 font-mono text-[12px] font-bold text-rose">{c.pct}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-5" aria-hidden>
                <div className="h-full rounded-full bg-rose" style={{ width: `${Math.min(100, c.pct)}%` }} />
              </div>
              {macroBits && <div className="mt-1 font-mono text-[11px] text-ink-40">{macroBits}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScoreCard({ label, score, note, level, icon: Icon }: {
  label: string; score: number; note: string; level: "optimal" | "caution" | "danger"; icon: typeof Heart;
}) {
  const bg = level === "optimal" ? "bg-status-bg-optimal/40 border-status-optimal/30"
    : level === "caution" ? "bg-status-bg-caution/40 border-status-caution/30"
    : "bg-status-bg-danger/40 border-status-danger/30";
  return (
    <div className={`rounded-2xl border p-4 ${bg}`}>
      <div className="flex items-baseline justify-between">
        <SectionLabel>{label}</SectionLabel>
        <Icon size={16} strokeWidth={2.25} aria-hidden style={{ color: statusTextHex[level] }} />
      </div>
      <div className="mt-1 font-head text-[26px] font-extrabold" style={{ color: statusTextHex[level] }}>
        {score}<span className="text-[13px] font-normal text-ink-40"> / 10</span>
      </div>
      <p className="mt-1 font-thai text-[11px] leading-snug text-ink-60">{note}</p>
    </div>
  );
}

function MacroRow({ label, g, kcal, pct, color }: { label: string; g: number; kcal: number; pct: number; color: "rose" | "wellness" | "amber" }) {
  const dot = { rose: "bg-rose", wellness: "bg-wellness", amber: "bg-amber" }[color];
  const text = { rose: "text-rose", wellness: "text-wellness", amber: "text-amber" }[color];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-10 bg-white px-3 py-2">
      <span className={`h-3 w-3 shrink-0 rounded-full ${dot}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-thai text-[12px] font-semibold text-ink">{label}</div>
        <div className="font-mono text-[10px] text-ink-40">{Math.round(kcal)} kcal · {pct}%</div>
      </div>
      <div className={`font-head text-[18px] font-bold ${text}`}>
        {g}<span className="ml-0.5 text-[10px] font-normal text-ink-40">g</span>
      </div>
    </div>
  );
}

function RecentItem({ row, customers, onOpen }: { row: ScanRow; customers: CustomerOpt[]; onOpen: () => void }) {
  // Show the effective eaten date (eaten_on ?? created_at).
  const eff = row.eaten_on ? new Date(`${row.eaten_on}T00:00:00+07:00`) : new Date(row.created_at);
  const date = eff.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  const time = new Date(row.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const gi = row.glucose_impact_score;
  const customer = row.customer_id ? customers.find((c) => c.id === row.customer_id) : null;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full min-h-[44px] items-start justify-between gap-2 rounded-xl border border-ink-10 px-3 py-2.5 text-left transition-colors hover:border-rose hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-rose"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-thai text-[12px] font-semibold text-ink">{row.food_identified ?? "—"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 font-mono text-[10px] text-ink-40">
            <span>{date} · {time}</span>
            {row.meal_type && <span>· {MEAL_LABEL_TH[row.meal_type] ?? row.meal_type}</span>}
            {customer && <span className="rounded-full bg-rose-ultra px-1.5 py-0.5 text-rose">{customer.name}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="text-right">
            {row.calories_estimate != null && <div className="font-mono text-[10px] text-ink-60">{row.calories_estimate} kcal</div>}
            {gi != null && (
              <div className="font-mono text-[10px] font-bold" style={{ color: statusTextHex[glucoseLevel(gi)] }}>GI {gi}/10</div>
            )}
          </div>
          <ChevronRight size={14} strokeWidth={2.25} className="text-ink-30" aria-hidden />
        </div>
      </button>
    </li>
  );
}

/** Detail modal — fetches GET /api/nutriscan/[id] and renders the FULL analysis. */
function ScanDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [scan, setScan] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const res = await fetch(`/api/nutriscan/${id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "โหลดไม่สำเร็จ");
        if (alive) setScan(json.scan);
      } catch (e: any) {
        if (alive) setErr(e.message ?? "โหลดไม่สำเร็จ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const raw: AnalysisResult | null = scan?.raw_analysis ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="รายละเอียดการสแกน" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <History size={15} strokeWidth={2.25} className="text-rose" aria-hidden />
            <h2 className="font-head text-[16px] font-bold text-ink">รายละเอียดการสแกน</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-ink-60 transition-colors hover:bg-surface hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose"
          >
            <X size={18} strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        {loading ? (
          <LoadingState label="กำลังโหลดรายละเอียด…" />
        ) : err ? (
          <div className="rounded-xl bg-status-bg-danger px-3.5 py-2.5 font-thai text-[13px] text-status-danger" role="alert">{err}</div>
        ) : raw ? (
          <ResultCard result={raw} />
        ) : (
          <EmptyState icon={Salad} title="ไม่มีข้อมูล" hint="รายการนี้ไม่มีผลวิเคราะห์ที่บันทึกไว้" />
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Helpers ───────────────────────── */

async function compressImage(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
