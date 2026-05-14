"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

interface ScanRow {
  id: string;
  food_identified: string | null;
  meal_type: string | null;
  calories_estimate: number | null;
  glucose_impact_score: number | null;
  health_score: number | null;
  created_at: string;
  customer_id: string | null;
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

export function NutriScanClient() {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [mealType,     setMealType]     = useState("lunch");
  const [analyzing,    setAnalyzing]    = useState(false);
  const [result,       setResult]       = useState<AnalysisResult | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [recent,       setRecent]       = useState<ScanRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadRecent = async () => {
    try {
      const res = await fetch("/api/nutriscan");
      const json = await res.json();
      setRecent(json.scans ?? []);
    } catch {}
  };

  useEffect(() => { loadRecent(); }, []);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("ต้องเป็นไฟล์รูปภาพเท่านั้น");
      return;
    }
    // Resize/compress before sending to keep payload small
    const dataUrl = await compressImage(file, 1280, 0.85);
    setImageDataUrl(dataUrl);
    setResult(null);
    setError(null);
  };

  const analyze = async () => {
    if (!imageDataUrl) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) throw new Error("invalid image data");
      const [, mimeType, base64] = match;

      const res = await fetch("/api/nutriscan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: base64,
          mime_type:    mimeType,
          meal_type:    mealType,
        }),
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
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr,360px]">
      {/* ── Main column ─────────────────────────── */}
      <div className="space-y-6">
        {/* Upload card */}
        <section className="rounded-3xl border border-ink-10 bg-white p-6">
          <h2 className="mb-4 font-head text-[16px] font-extrabold tracking-tight text-ink">
            อัปโหลดรูปอาหาร
          </h2>

          {/* Meal type selector */}
          <div className="mb-4 flex flex-wrap gap-2">
            {MEAL_OPTIONS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMealType(m.value)}
                className={`rounded-full px-4 py-1.5 font-thai text-[12px] font-medium transition-colors ${
                  mealType === m.value
                    ? "bg-rose text-white"
                    : "bg-surface text-ink-60 hover:bg-ink-5"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {!imageDataUrl ? (
            <label className="block cursor-pointer">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onPickFile}
                className="hidden"
              />
              <div className="flex h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-10 bg-surface hover:border-rose hover:bg-rose-ultra transition-colors">
                <div className="text-4xl mb-2">📷</div>
                <div className="font-thai text-sm font-semibold text-ink">แตะเพื่อถ่ายรูป / เลือกรูป</div>
                <div className="mt-1 font-thai text-[11px] text-ink-40">รองรับ JPG · PNG · WebP</div>
              </div>
            </label>
          ) : (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-ink-10">
                <img src={imageDataUrl} alt="food" className="h-72 w-full object-cover" />
              </div>
              <div className="flex gap-2">
                <Button variant="rose" size="md" onClick={analyze} disabled={analyzing} className="flex-1">
                  {analyzing ? "🔍 กำลังวิเคราะห์..." : "วิเคราะห์ด้วย AI ✨"}
                </Button>
                <Button variant="ghost" size="md" onClick={reset} disabled={analyzing}>
                  เปลี่ยนรูป
                </Button>
              </div>
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
            ประวัติการวิเคราะห์ ({recent.length})
          </h3>
          <div className="mt-4 space-y-2 max-h-[500px] overflow-y-auto">
            {recent.length === 0 ? (
              <div className="font-thai text-[12px] text-ink-40 italic">ยังไม่มีประวัติ · ลองอัปโหลดดู</div>
            ) : recent.map((r) => (
              <RecentItem key={r.id} row={r} />
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
      <div className="rounded-3xl border border-status-danger/30 bg-status-bg-danger p-6">
        <div className="font-thai text-sm text-status-danger">{result.error}</div>
      </div>
    );
  }

  const gi = result.glucose_impact;
  const hs = result.health_score;
  const m = result.macros;

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
          {gi && (
            <ScoreCard
              label="Glucose Impact"
              score={gi.score}
              note={gi.explanation}
              variant={gi.score >= 7 ? "danger" : gi.score >= 4 ? "warn" : "ok"}
              icon="📈"
            />
          )}
          {hs && (
            <ScoreCard
              label="Health Score"
              score={hs.score}
              note={hs.pros.slice(0, 2).join(" · ")}
              variant={hs.score >= 7 ? "ok" : hs.score >= 4 ? "warn" : "danger"}
              icon="❤️"
              inverse
            />
          )}
        </div>
      )}

      {/* Calories + Macros */}
      {(result.calories_estimate || m) && (
        <div className="rounded-2xl border border-ink-10 bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-40">Calories</div>
            <div className="font-mono text-[10px] text-ink-40">estimate</div>
          </div>
          <div className="mt-1 font-head text-[32px] font-extrabold text-ink">
            {result.calories_estimate ?? "—"} <span className="text-[14px] font-normal text-ink-40">kcal</span>
          </div>
          {m && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              <MacroPill label="Carb"    value={`${m.carb_g}g`}   color="rose" />
              <MacroPill label="Protein" value={`${m.protein_g}g`} color="green" />
              <MacroPill label="Fat"     value={`${m.fat_g}g`}     color="amber" />
              <MacroPill label="Fiber"   value={`${m.fiber_g}g`}   color="blue" />
            </div>
          )}
        </div>
      )}

      {/* Pros / Cons */}
      {hs && (hs.pros.length > 0 || hs.cons.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {hs.pros.length > 0 && (
            <div className="rounded-2xl border border-status-optimal/20 bg-status-bg-optimal/30 p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-status-optimal font-bold">✓ จุดดี</div>
              <ul className="mt-2 space-y-1.5">
                {hs.pros.map((p, i) => (
                  <li key={i} className="font-thai text-[12px] text-ink leading-relaxed">• {p}</li>
                ))}
              </ul>
            </div>
          )}
          {hs.cons.length > 0 && (
            <div className="rounded-2xl border border-status-danger/20 bg-status-bg-danger/30 p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-status-danger font-bold">⚠ จุดอ่อน</div>
              <ul className="mt-2 space-y-1.5">
                {hs.cons.map((c, i) => (
                  <li key={i} className="font-thai text-[12px] text-ink leading-relaxed">• {c}</li>
                ))}
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
              {result.recommendations.modifications.map((m, i) => (
                <li key={i} className="font-thai text-[13px] text-ink leading-relaxed">• {m}</li>
              ))}
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
            {result.alternative_meals.map((a, i) => (
              <li key={i} className="font-thai text-[12px] text-ink leading-relaxed">→ {a}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ScoreCard({
  label, score, note, variant, icon, inverse,
}: {
  label: string; score: number; note: string;
  variant: "ok" | "warn" | "danger"; icon: string; inverse?: boolean;
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

function MacroPill({ label, value, color }: { label: string; value: string; color: string }) {
  const bg = {
    rose:  "bg-rose-ultra text-rose",
    green: "bg-status-bg-optimal text-status-optimal",
    amber: "bg-status-bg-warning text-status-warning",
    blue:  "bg-science-ultra text-science",
  }[color] ?? "bg-surface text-ink";

  return (
    <div className={`rounded-xl ${bg} px-2.5 py-2 text-center`}>
      <div className="font-mono text-[9px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-0.5 font-head text-[14px] font-bold">{value}</div>
    </div>
  );
}

function RecentItem({ row }: { row: ScanRow }) {
  const d = new Date(row.created_at);
  const date = d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const gi = row.glucose_impact_score ?? 0;
  const giColor = gi >= 7 ? "text-status-danger" : gi >= 4 ? "text-status-warning" : "text-status-optimal";
  return (
    <div className="rounded-xl border border-ink-10 px-3 py-2.5 hover:bg-surface transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-thai text-[12px] font-semibold text-ink truncate">{row.food_identified ?? "—"}</div>
          <div className="mt-0.5 font-mono text-[9px] text-ink-40">{date} · {time} · {row.meal_type ?? "—"}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-[10px] text-ink-40">GI</div>
          <div className={`font-mono text-[12px] font-bold ${giColor}`}>{gi}/10</div>
        </div>
      </div>
      {row.calories_estimate && (
        <div className="mt-1 font-mono text-[10px] text-ink-60">{row.calories_estimate} kcal</div>
      )}
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
