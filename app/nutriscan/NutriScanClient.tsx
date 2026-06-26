"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CPFPie } from "@/components/CPFPie";
import { GeminiKeyField, getGeminiKey } from "@/components/GeminiKeyField";
import { macroBreakdown, type Macros } from "@/lib/nutriscan/macros";

interface CustomerOpt {
  id: string;
  name: string;
}

interface ScanRow {
  id: string;
  food_identified: string | null;
  meal_type: string | null;
  calories_estimate: number | null;
  carb_g:    number | null;
  protein_g: number | null;
  fat_g:     number | null;
  fiber_g:   number | null;
  glucose_impact_score: number | null;
  health_score: number | null;
  created_at: string;
  customer_id: string | null;
  notes: string | null;
}

interface AnalysisResult {
  food_identified:    string;
  food_components?:   string[];
  estimated_portion?: string;
  calories_estimate?: number;
  macros?:            { carb_g: number; protein_g: number; fat_g: number; fiber_g: number };
  glucose_impact?:    { score: number; explanation: string };
  health_score?:      { score: number; pros: string[]; cons: string[] };
  recommendations?:   { modifications: string[]; nutrilite_skus: Array<{ sku: string; reason: string }> };
  alternative_meals?: string[];
  error?: string;
}

const MEAL_OPTIONS = [
  { value: "breakfast", label: "เช้า 🌅" },
  { value: "lunch",     label: "กลางวัน ☀️" },
  { value: "dinner",    label: "เย็น 🌙" },
  { value: "snack",     label: "ของว่าง 🍎" },
];

type InputMode = "image" | "text";

export function NutriScanClient() {
  const [mode,         setMode]         = useState<InputMode>("image");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [textDesc,     setTextDesc]     = useState("");
  const [mealType,     setMealType]     = useState("lunch");
  const [customerId,   setCustomerId]   = useState<string>("");
  const [notes,        setNotes]        = useState("");
  const [customers,    setCustomers]    = useState<CustomerOpt[]>([]);
  const [analyzing,    setAnalyzing]    = useState(false);
  const [result,       setResult]       = useState<AnalysisResult | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [recent,       setRecent]       = useState<ScanRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCustomers = async () => {
    try {
      const res = await fetch("/api/customers/list");
      const json = await res.json();
      setCustomers((json.customers ?? []).map((c: any) => ({ id: c.id, name: c.name })));
    } catch {}
  };
  const loadRecent = async () => {
    try {
      const res = await fetch("/api/nutriscan?limit=30");
      const json = await res.json();
      setRecent(json.scans ?? []);
    } catch {}
  };

  useEffect(() => { loadCustomers(); loadRecent(); }, []);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("ต้องเป็นไฟล์รูปภาพเท่านั้น");
      return;
    }
    const dataUrl = await compressImage(file, 1280, 0.85);
    setImageDataUrl(dataUrl);
    setResult(null);
    setError(null);
  };

  const analyze = async () => {
    if (mode === "image" && !imageDataUrl) return;
    if (mode === "text"  && !textDesc.trim()) return;
    // BYO key เท่านั้น — ไม่มีคีย์ = ไม่ยิง API
    const geminiKey = getGeminiKey();
    if (!geminiKey) {
      const msg = "กรุณาใส่ API Key ก่อน (กด ⚙️ ใส่ API key)";
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
        apiKey: geminiKey,
      };
      if (mode === "image" && imageDataUrl) {
        const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!match) throw new Error("invalid image");
        payload.image_base64 = match[2];
        payload.mime_type    = match[1];
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
      setError(e.message);
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

  const canAnalyze = (mode === "image" && imageDataUrl) || (mode === "text" && textDesc.trim().length > 3);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr,360px]">
      {/* ── Main column ─────────────────────────── */}
      <div className="space-y-6">
        {/* BYO Gemini API key gate (shared with Check FORM) */}
        <GeminiKeyField />

        {/* Upload card */}
        <section className="rounded-3xl border border-ink-10 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-head text-[16px] font-extrabold tracking-tight text-ink">
              บันทึกมื้ออาหาร
            </h2>
            <Link href="/nutriscan/log" className="rounded-full bg-surface px-3 py-1.5 font-thai text-[11px] font-medium text-ink-60 hover:bg-ink-5 transition-colors">
              📅 บันทึกรายวัน →
            </Link>
          </div>

          {/* Customer selector */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr,140px] gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">บันทึกให้ใคร</span>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm focus:border-rose focus:outline-none"
              >
                <option value="">👤 ตัวเอง (Profile ของคุณ)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>👥 {c.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">มื้อ</span>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm focus:border-rose focus:outline-none"
              >
                {MEAL_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Mode tabs */}
          <div className="mt-5 flex gap-1 rounded-full bg-surface p-1 w-fit">
            <button
              onClick={() => { setMode("image"); setResult(null); }}
              className={`rounded-full px-4 py-1.5 font-thai text-[12px] font-medium transition-colors ${
                mode === "image" ? "bg-rose text-white" : "text-ink-60 hover:text-ink"
              }`}
            >
              📷 ถ่ายรูป
            </button>
            <button
              onClick={() => { setMode("text"); setResult(null); }}
              className={`rounded-full px-4 py-1.5 font-thai text-[12px] font-medium transition-colors ${
                mode === "text" ? "bg-rose text-white" : "text-ink-60 hover:text-ink"
              }`}
            >
              ✍️ พิมพ์อธิบาย
            </button>
          </div>

          {/* Image mode */}
          {mode === "image" && (
            <div className="mt-4">
              {!imageDataUrl ? (
                <label className="block cursor-pointer">
                  <input ref={fileRef} type="file" accept="image/*" capture="environment"
                         onChange={onPickFile} className="hidden" />
                  <div className="flex h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-10 bg-surface hover:border-rose hover:bg-rose-ultra transition-colors">
                    <div className="text-4xl mb-2">📷</div>
                    <div className="font-thai text-sm font-semibold text-ink">แตะเพื่อถ่ายรูป / เลือกรูป</div>
                    <div className="mt-1 font-thai text-[11px] text-ink-40">JPG · PNG · WebP</div>
                  </div>
                </label>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-ink-10">
                  <img src={imageDataUrl} alt="food" className="h-72 w-full object-cover" />
                </div>
              )}
            </div>
          )}

          {/* Text mode */}
          {mode === "text" && (
            <div className="mt-4">
              <textarea
                value={textDesc}
                onChange={(e) => setTextDesc(e.target.value)}
                rows={4}
                placeholder="เช่น: ข้าวกะเพราหมูสับไข่ดาว 1 จาน · ข้าว 1 ทัพพี · น้ำเปล่า"
                className="w-full rounded-2xl border border-ink-10 bg-white px-4 py-3 text-sm font-thai placeholder:text-ink-30 focus:border-rose focus:outline-none"
              />
              <div className="mt-1 font-mono text-[10px] text-ink-40">
                💡 บรรยายให้ละเอียดที่สุด · ส่วนประกอบ · ปริมาณ · วิธีปรุง
              </div>
            </div>
          )}

          {/* Notes */}
          <label className="mt-4 block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">หมายเหตุ (optional)</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น กินที่ทำงาน · หลังออกกำลังกาย"
              className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2 text-sm placeholder:text-ink-30 focus:border-rose focus:outline-none"
            />
          </label>

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            <Button variant="rose" size="md" onClick={analyze} disabled={analyzing || !canAnalyze} className="flex-1">
              {analyzing ? "🔍 กำลังวิเคราะห์..." : "วิเคราะห์ + บันทึก ✨"}
            </Button>
            {(imageDataUrl || textDesc) && (
              <Button variant="ghost" size="md" onClick={reset} disabled={analyzing}>
                ล้าง
              </Button>
            )}
          </div>

          {selectedCustomer && (
            <div className="mt-3 font-thai text-[11px] text-ink-60">
              💾 จะบันทึกให้ <span className="font-semibold text-rose">{selectedCustomer.name}</span>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-status-danger/30 bg-status-bg-danger/50 px-4 py-3 font-thai text-sm text-status-danger">
              {error}
            </div>
          )}
        </section>

        {/* Result */}
        {result && <ResultCard result={result} />}
      </div>

      {/* ── Right column · Recent ───────────────── */}
      <aside className="lg:sticky lg:top-20 self-start">
        <div className="rounded-3xl border border-ink-10 bg-white p-6">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">Recent</div>
          <h3 className="mt-1 font-head text-[16px] font-extrabold text-ink">
            ล่าสุด ({recent.length})
          </h3>
          <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {recent.length === 0 ? (
              <div className="font-thai text-[12px] text-ink-40 italic">ยังไม่มีบันทึก</div>
            ) : recent.map((r) => (
              <RecentItem key={r.id} row={r} customers={customers} />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────── */

function ResultCard({ result }: { result: AnalysisResult }) {
  if (result.error) {
    return (
      <div className="rounded-3xl border border-status-danger/30 bg-status-bg-danger/30 p-6">
        <div className="font-thai text-sm text-status-danger">{result.error}</div>
      </div>
    );
  }

  const gi = result.glucose_impact;
  const hs = result.health_score;
  const m  = result.macros;
  const b  = m ? macroBreakdown(m) : null;

  return (
    <section className="rounded-3xl border border-ink-10 bg-white p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">Identified</div>
        <h2 className="mt-1 font-head text-[22px] font-extrabold text-ink">{result.food_identified}</h2>
        {result.estimated_portion && (
          <div className="mt-1 font-thai text-[12px] text-ink-60">{result.estimated_portion}</div>
        )}
        {result.food_components && result.food_components.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.food_components.map((c, i) => (
              <span key={i} className="rounded-full bg-surface px-2.5 py-1 font-thai text-[11px] text-ink-60">{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* Two big scores */}
      {(gi || hs) && (
        <div className="grid grid-cols-2 gap-3">
          {gi && <ScoreCard label="Glucose Impact" score={gi.score} note={gi.explanation}
                            variant={gi.score >= 7 ? "danger" : gi.score >= 4 ? "warn" : "ok"} icon="📈" />}
          {hs && <ScoreCard label="Health Score" score={hs.score} note={hs.pros.slice(0, 2).join(" · ")}
                            variant={hs.score >= 7 ? "ok" : hs.score >= 4 ? "warn" : "danger"} icon="❤️" />}
        </div>
      )}

      {/* Calorie + Macros + Pie */}
      {(result.calories_estimate || m) && b && (
        <div className="rounded-2xl border border-ink-10 bg-surface p-5">
          <div className="grid gap-5 sm:grid-cols-[180px,1fr] items-center">
            {/* Pie chart */}
            <div className="flex justify-center">
              <CPFPie
                carb_pct={b.carb_pct}
                protein_pct={b.protein_pct}
                fat_pct={b.fat_pct}
                total_kcal={result.calories_estimate ?? b.total_kcal}
                size={170}
              />
            </div>

            {/* Right side · macros */}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">Macros breakdown</div>
              <div className="mt-2 space-y-2">
                {m && (
                  <>
                    <MacroRow label="Carbohydrate"   g={m.carb_g}    kcal={b.carb_kcal}    pct={b.carb_pct}    color="rose" />
                    <MacroRow label="Protein"        g={m.protein_g} kcal={b.protein_kcal} pct={b.protein_pct} color="wellness" />
                    <MacroRow label="Fat"            g={m.fat_g}     kcal={b.fat_kcal}     pct={b.fat_pct}     color="amber" />
                  </>
                )}
              </div>
              {m && m.fiber_g > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-science-pale bg-science-ultra px-3 py-2 font-mono text-[11px] text-science">
                  <span>🌱</span>
                  <span><b>Fiber {m.fiber_g}g</b> · ไม่นับใน energy</span>
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
            <div className="rounded-2xl border border-status-optimal/20 bg-status-bg-optimal/30 p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-status-optimal font-bold">✓ จุดดี</div>
              <ul className="mt-2 space-y-1.5">
                {hs.pros.map((p, i) => <li key={i} className="font-thai text-[12px] text-ink leading-relaxed">• {p}</li>)}
              </ul>
            </div>
          )}
          {hs.cons.length > 0 && (
            <div className="rounded-2xl border border-status-danger/20 bg-status-bg-danger/30 p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-status-danger font-bold">⚠ จุดอ่อน</div>
              <ul className="mt-2 space-y-1.5">
                {hs.cons.map((c, i) => <li key={i} className="font-thai text-[12px] text-ink leading-relaxed">• {c}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations && (
        <div className="rounded-2xl border border-rose/20 bg-rose-ultra p-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-rose font-bold">💡 ปรับมื้อนี้</div>
          {result.recommendations.modifications.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {result.recommendations.modifications.map((m, i) =>
                <li key={i} className="font-thai text-[13px] text-ink leading-relaxed">• {m}</li>)}
            </ul>
          )}
          {result.recommendations.nutrilite_skus.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-rose font-bold">Nutrilite SKU</div>
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
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">🔄 ทางเลือกที่ healthier</div>
          <ul className="mt-2 space-y-1.5">
            {result.alternative_meals.map((a, i) =>
              <li key={i} className="font-thai text-[12px] text-ink leading-relaxed">→ {a}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

function ScoreCard({ label, score, note, variant, icon }: {
  label: string; score: number; note: string;
  variant: "ok" | "warn" | "danger"; icon: string;
}) {
  const colors = {
    ok:     { bg: "bg-status-bg-optimal/40", border: "border-status-optimal/30", text: "text-status-optimal" },
    warn:   { bg: "bg-status-bg-warning/40", border: "border-status-warning/30", text: "text-status-warning" },
    danger: { bg: "bg-status-bg-danger/40",  border: "border-status-danger/30",  text: "text-status-danger" },
  }[variant];
  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-4`}>
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">{label}</div>
        <div className="text-lg">{icon}</div>
      </div>
      <div className={`mt-1 font-head text-[28px] font-extrabold ${colors.text}`}>
        {score}<span className="text-[14px] text-ink-40 font-normal"> / 10</span>
      </div>
      <div className="mt-1 font-thai text-[11px] text-ink-60 leading-snug">{note}</div>
    </div>
  );
}

function MacroRow({ label, g, kcal, pct, color }: { label: string; g: number; kcal: number; pct: number; color: string }) {
  const styles = {
    rose:     { dot: "bg-rose",     text: "text-rose" },
    wellness: { dot: "bg-wellness", text: "text-wellness" },
    amber:    { dot: "bg-amber",    text: "text-amber" },
  }[color] ?? { dot: "bg-ink", text: "text-ink" };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-10 bg-white px-3 py-2">
      <span className={`h-3 w-3 rounded-full shrink-0 ${styles.dot}`}></span>
      <div className="min-w-0 flex-1">
        <div className="font-thai text-[12px] font-semibold text-ink">{label}</div>
        <div className="font-mono text-[10px] text-ink-40">{Math.round(kcal)} kcal · {pct}%</div>
      </div>
      <div className={`font-head text-[18px] font-bold ${styles.text}`}>
        {g}<span className="text-[10px] font-normal text-ink-40 ml-0.5">g</span>
      </div>
    </div>
  );
}

function RecentItem({ row, customers }: { row: ScanRow; customers: CustomerOpt[] }) {
  const d = new Date(row.created_at);
  const date = d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const gi = row.glucose_impact_score ?? 0;
  const giColor = gi >= 7 ? "text-status-danger" : gi >= 4 ? "text-status-warning" : "text-status-optimal";
  const customer = row.customer_id ? customers.find((c) => c.id === row.customer_id) : null;
  return (
    <div className="rounded-xl border border-ink-10 px-3 py-2.5 hover:bg-surface transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-thai text-[12px] font-semibold text-ink truncate">{row.food_identified ?? "—"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 font-mono text-[9px] text-ink-40">
            <span>{date} · {time}</span>
            {row.meal_type && <span>· {row.meal_type}</span>}
            {customer && <span className="rounded-full bg-rose-ultra px-1.5 py-0.5 text-rose">👥 {customer.name}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          {row.calories_estimate != null && (
            <div className="font-mono text-[10px] text-ink-60">{row.calories_estimate} kcal</div>
          )}
          {row.glucose_impact_score != null && (
            <div className={`font-mono text-[10px] font-bold ${giColor}`}>GI {gi}/10</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────── */

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
