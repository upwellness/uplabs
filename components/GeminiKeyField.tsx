"use client";

/**
 * GeminiKeyField — shared BYO (bring-your-own) Gemini API key gate.
 *
 * Used by NutriScan + Check FORM. The key is stored in localStorage under the
 * SHARED key `uplabs_gemini_key`, so the user enters it once for both features.
 * There is NO server-env fallback — the key must be provided to use AI actions.
 *
 * Styling matches native uplabs (white card · border-ink-10 · text-ink · wellness accent).
 */

import { useEffect, useState } from "react";

export const GEMINI_KEY_LS = "uplabs_gemini_key";

/** Read the saved key (empty string if none / SSR). Safe to call anywhere. */
export function getGeminiKey(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return (localStorage.getItem(GEMINI_KEY_LS) || "").trim();
  } catch {
    return "";
  }
}

export function GeminiKeyField({
  onChange,
  className = "",
}: {
  onChange?: (key: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);

  // Hydrate from localStorage on mount (avoids SSR/client mismatch)
  useEffect(() => {
    const k = getGeminiKey();
    setDraft(k);
    setSaved(!!k);
    onChange?.(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = () => {
    const k = draft.trim();
    try {
      localStorage.setItem(GEMINI_KEY_LS, k);
    } catch {
      /* storage blocked — ignore */
    }
    setSaved(!!k);
    setOpen(false);
    onChange?.(k);
  };

  return (
    <div className={`rounded-2xl border border-ink-10 bg-white p-3 sm:p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-thai text-sm text-ink-80">
          ⚙️ Gemini API key:{" "}
          {saved ? (
            <span className="font-semibold text-wellness">มีคีย์แล้ว ✓</span>
          ) : (
            <span className="font-semibold text-amber">ยังไม่ใส่คีย์</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg border border-ink-10 bg-white px-3 py-1.5 font-thai text-sm text-wellness transition-colors hover:bg-wellness-ultra"
        >
          {open ? "ปิด" : saved ? "เปลี่ยนคีย์" : "ใส่ API key"}
        </button>
      </div>

      {open && (
        <div className="mt-3 border-t border-ink-10 pt-3">
          <label className="mb-1 block font-thai text-sm text-ink-80">
            API key — Google AI Studio (aistudio.google.com/apikey)
            <span className="text-amber"> · ต้องใส่คีย์เอง</span>
          </label>
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="AIza…"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-ink-10 bg-white px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-wellness/40"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              className="rounded-xl bg-wellness px-4 py-2 font-thai text-sm font-semibold text-white transition-colors hover:bg-wellness-deep"
            >
              บันทึก
            </button>
            <span className="font-thai text-xs text-ink-40">
              🔐 คีย์เก็บในเบราว์เซอร์ของคุณ · ส่งผ่าน HTTPS ตอนเรียก AI เท่านั้น · ไม่เก็บบนเซิร์ฟเวอร์
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
