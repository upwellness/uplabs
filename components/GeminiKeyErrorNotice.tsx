"use client";

import { AI_STUDIO_URL } from "@/lib/gemini-error";

/**
 * Friendly "your Gemini key isn't working — get a free one" panel.
 * Shown wherever a BYO-key AI action fails on an invalid/expired/missing/restricted key,
 * instead of a raw technical error. `settingsHint` = how to open the key field on this page.
 */
export function GeminiKeyErrorNotice({
  settingsHint = "กด ⚙️ เปลี่ยนคีย์ ด้านบนของหน้า",
  onClose,
  className = "",
}: {
  settingsHint?: string;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-ink-10 bg-amber-ultra p-5 text-center ${className}`}>
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl ring-1 ring-ink-10">
        🔑
      </div>
      <div className="mt-3 font-head text-[16px] font-extrabold text-ink">คีย์ Gemini ใช้ไม่ได้แล้ว</div>
      <p className="mt-2 mx-auto max-w-md font-thai text-[13px] leading-relaxed text-ink-80">
        คีย์ AI ที่ใส่ไว้หมดอายุหรือไม่ถูกต้อง — ขอคีย์ใหม่ได้ <b>ฟรี</b> จาก Google AI Studio แล้ว{settingsHint} เพื่อวางคีย์ใหม่
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
        <a
          href={AI_STUDIO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-wellness px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-wellness-deep"
        >
          🔑 ขอคีย์ใหม่ (ฟรี) ที่ Google AI Studio
        </a>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-ink-10 bg-white px-4 py-2 text-[13px] font-semibold text-ink-60 transition-colors hover:text-ink"
          >
            ปิด
          </button>
        )}
      </div>
      <p className="mt-3 font-thai text-[11px] text-ink-40">🔐 คีย์เก็บในเบราว์เซอร์นี้เท่านั้น · ไม่เก็บบนเซิร์ฟเวอร์</p>
    </div>
  );
}
