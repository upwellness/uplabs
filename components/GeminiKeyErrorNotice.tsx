"use client";

import { AI_STUDIO_URL, ENABLE_API_URL, isGeminiForbidden } from "@/lib/gemini-error";

/**
 * Friendly guidance when a BYO-key AI action fails, instead of a raw technical error.
 *
 * TWO different problems, two different fixes — do not merge them:
 *  • invalid  (400) → key is wrong/expired/revoked → get a NEW key
 *  • forbidden (403) → key is fine but has no permission (Generative Language API not
 *    enabled on its project, or the key is restricted) → getting another key from the
 *    same project will NOT help; enable the API / create the key from AI Studio.
 *
 * Pass the raw error message via `error` so the right variant is shown.
 */
export function GeminiKeyErrorNotice({
  error,
  settingsHint = "กด ⚙️ เปลี่ยนคีย์ ด้านบนของหน้า",
  onClose,
  className = "",
}: {
  error?: string | null;
  settingsHint?: string;
  onClose?: () => void;
  className?: string;
}) {
  const forbidden = isGeminiForbidden(error);

  return (
    <div className={`rounded-2xl border border-ink-10 bg-amber-ultra p-5 text-center ${className}`}>
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl ring-1 ring-ink-10">
        {forbidden ? "🚧" : "🔑"}
      </div>

      {forbidden ? (
        <>
          <div className="mt-3 font-head text-[16px] font-extrabold text-ink">คีย์ถูกต้อง แต่ยังไม่มีสิทธิ์ใช้งาน</div>
          <p className="mt-2 mx-auto max-w-lg font-thai text-[13px] leading-relaxed text-ink-80">
            Google ตอบกลับว่า <b>ไม่อนุญาต (403)</b> — แปลว่าคีย์ใช้ได้ แต่โปรเจกต์ของคีย์ยัง<b>ไม่ได้เปิดบริการ Generative Language API</b> หรือคีย์ถูกตั้งข้อจำกัดไว้
            <br />
            <b>ขอคีย์ใหม่ซ้ำ ๆ จะไม่ช่วย</b> ต้องแก้ 1 ใน 2 ทางนี้
          </p>
          <ol className="mx-auto mt-3 max-w-md text-left font-thai text-[13px] leading-relaxed text-ink-80">
            <li><b>ทางที่ง่ายที่สุด</b> — สร้างคีย์ใหม่จาก Google AI Studio แล้วเลือก <i>“Create API key in new project”</i> (โปรเจกต์ใหม่จะเปิดบริการให้อัตโนมัติ)</li>
            <li className="mt-1"><b>หรือ</b> เปิดบริการให้โปรเจกต์เดิม แล้วรอ 1–2 นาที ค่อยลองใหม่</li>
          </ol>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <a
              href={AI_STUDIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-wellness px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-wellness-deep"
            >
              🔑 สร้างคีย์ในโปรเจกต์ใหม่ (AI Studio)
            </a>
            <a
              href={ENABLE_API_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-ink-10 bg-white px-4 py-2.5 text-[13px] font-semibold text-ink-80 transition-colors hover:text-ink"
            >
              ⚙️ เปิดบริการให้โปรเจกต์เดิม
            </a>
            {onClose && (
              <button type="button" onClick={onClose} className="rounded-full border border-ink-10 bg-white px-4 py-2 text-[13px] font-semibold text-ink-60 transition-colors hover:text-ink">
                ปิด
              </button>
            )}
          </div>
        </>
      ) : (
        <>
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
              <button type="button" onClick={onClose} className="rounded-full border border-ink-10 bg-white px-4 py-2 text-[13px] font-semibold text-ink-60 transition-colors hover:text-ink">
                ปิด
              </button>
            )}
          </div>
        </>
      )}

      <p className="mt-3 font-thai text-[11px] text-ink-40">
        🔐 คีย์เก็บในเบราว์เซอร์นี้เท่านั้น · ใส่ครั้งเดียวใช้ได้ทั้ง CheckForm และ NutriScan
      </p>
    </div>
  );
}
