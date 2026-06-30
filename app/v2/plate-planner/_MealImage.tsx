"use client";

/**
 * UP Labs v2 · Plate Planner — per-meal AI photo (lazy-loaded)
 * ───────────────────────────────────────────────────────────
 * "สร้างรูป" button → POST /api/plate-image (BYO Gemini key via getGeminiKey) using the
 * SHARED v1-compatible cache in ./_imageCache (L1 memory → L2 IndexedDB "plateplanner/img"
 * → L3 Supabase "meal-images"). A photo already generated in v1 (or by another user) shows
 * up here automatically with no API call. Loading + error + zoom states included.
 *
 * Loaded only on demand via next/dynamic from page.tsx (keeps the cache/SubtleCrypto/IDB
 * code and this view out of the planner's first-load JS, per SPEC §8 "lazy heavy bits").
 * Clinical-warm: white surface, Lucide, status TEXT colors, ≥44px touch targets.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, ZoomIn, RefreshCw, AlertTriangle, X } from "lucide-react";
import type { Meal } from "@/lib/plate-planner/engine";
import { getGeminiKey } from "@/components/GeminiKeyField";
import { statusTextHex } from "@/lib/v2/status";
import {
  mealSig, peekImg, isInflight, resolveCachedImage, generateMealImage, clearMealImage,
} from "./_imageCache";

export default function MealImage({ meal }: { meal: Meal }) {
  const sig = mealSig(meal);
  const sigRef = useRef(sig);
  sigRef.current = sig;

  const [img, setImg] = useState<string | null>(() => peekImg(sig));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);

  // On meal change: reset, then resolve any cached image (L1→L2→L3) without generating.
  useEffect(() => {
    setErr(null);
    setZoom(false);
    setLoading(isInflight(sig));
    const cached = peekImg(sig);
    if (cached) { setImg(cached); return; }
    setImg(null);
    let alive = true;
    void resolveCachedImage(sig).then((found) => {
      if (alive && sigRef.current === sig && found) setImg(found);
    });
    return () => { alive = false; };
  }, [sig]);

  const onGenerate = useCallback(async () => {
    const cached = peekImg(sig);
    if (cached) { setImg(cached); return; }
    const key = getGeminiKey();
    if (!key) {
      const msg = "กรุณาใส่ Gemini API key ก่อน (กดปุ่มตั้งค่า API key ด้านบน)";
      setErr(msg);
      if (typeof window !== "undefined") window.alert(msg);
      return;
    }
    setLoading(true);
    setErr(null);
    const res = await generateMealImage(meal, key, "gemini");
    if (sigRef.current !== sig) return; // meal changed mid-flight — drop result
    if ("image" in res) setImg(res.image);
    else setErr(res.error);
    setLoading(false);
  }, [meal, sig]);

  const onRegenerate = useCallback(() => {
    clearMealImage(sig);
    setImg(null);
    setErr(null);
    void onGenerate();
  }, [sig, onGenerate]);

  return (
    <div className="mt-3 border-t border-ink-5 pt-3">
      {img ? (
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setZoom(true)}
            aria-label="ขยายรูปจานอาหาร"
            className="group relative h-[96px] w-[96px] shrink-0 overflow-hidden rounded-xl border border-ink-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={`ภาพจำลองมื้อ ${meal.name}`} className="h-full w-full object-cover" />
            <span className="absolute bottom-1 right-1 inline-flex items-center gap-0.5 rounded-md bg-ink/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
              <ZoomIn size={11} strokeWidth={2.5} aria-hidden /> ขยาย
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-thai text-[12px] leading-relaxed text-ink-60">
              ภาพ AI ไว้เทียบหน้าตาจาน · ปริมาณจริงดูจากรายการด้านบน
            </p>
            <button
              type="button"
              onClick={onRegenerate}
              disabled={loading}
              className="mt-1.5 inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60 transition-colors hover:border-wellness hover:text-wellness disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness"
            >
              {loading ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <RefreshCw size={13} strokeWidth={2.25} aria-hidden />}
              สร้างใหม่
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onGenerate}
            disabled={loading}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-wellness-pale bg-wellness-ultra px-4 py-2.5 text-[13px] font-semibold text-wellness transition-colors hover:bg-wellness-pale disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2"
          >
            {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <ImagePlus size={15} strokeWidth={2.25} aria-hidden />}
            {loading ? "กำลังสร้างรูป…" : "สร้างรูปจานอาหาร"}
          </button>
          <span className="font-thai text-[11px] text-ink-40">ภาพเสมือนจริง (ใช้ Gemini key ของคุณ)</span>
        </div>
      )}

      {err && (
        <div className="mt-2 flex items-start gap-1.5 font-thai text-[12px]" role="alert" style={{ color: statusTextHex.warning }}>
          <AlertTriangle size={13} strokeWidth={2.25} className="mt-0.5 shrink-0" aria-hidden />
          <span>{err}</span>
        </div>
      )}

      {/* Zoom lightbox */}
      {zoom && img && (
        <div
          onClick={() => setZoom(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`รูปจานอาหาร ${meal.name}`}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm"
        >
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setZoom(false)}
              aria-label="ปิด"
              className="absolute right-3 top-3 z-10 inline-flex h-[44px] w-[44px] items-center justify-center rounded-full bg-white/90 text-ink-60 shadow-sm backdrop-blur transition-colors hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness"
            >
              <X size={18} strokeWidth={2.25} aria-hidden />
            </button>
            <div className="grid gap-0 sm:grid-cols-[1fr,260px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={`รูปจานอาหาร ${meal.name}`} className="max-h-[70vh] w-full object-contain bg-surface" />
              <div className="max-h-[70vh] overflow-auto border-t border-ink-10 p-4 sm:border-l sm:border-t-0">
                <div className="font-head text-[15px] font-bold text-ink">{meal.name}{meal.style ? ` · ${meal.style}` : ""}</div>
                <div className="mt-0.5 font-mono text-[11px] text-ink-40">รวม {meal.tot.kcal} kcal · ปริมาณบนจานนี้</div>
                <ul className="mt-3 space-y-2">
                  {meal.items.map((it, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-2 font-thai text-[13px] text-ink">
                      <span className="min-w-0 font-semibold">{it.cat === "shake" ? it.th : it.th.replace(/\s*\(.*?\)/, "")}</span>
                      <span className="shrink-0 font-mono text-[11px] text-ink-60">{it.cat === "shake" ? "1 แก้ว" : `${it.g}g`}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
