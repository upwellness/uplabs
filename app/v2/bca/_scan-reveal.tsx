"use client";

/**
 * UP Labs v2 · BCA Scan-Reveal — full-screen overlay
 * ──────────────────────────────────────────────────
 * A cinematic "body scan" reveal shown to the customer after a new BCA is
 * saved (and replayable via the "ดูผลแบบสแกน" button). The scan is a
 * self-contained HTML document (SCAN_TEMPLATE) rendered in an <iframe srcDoc>
 * so its bespoke CSS/JS/animation stays fully isolated from the app — and the
 * customer's real numbers are injected only at runtime (window.__SCAN_DATA__),
 * never committed to this public repo.
 *
 * Heavy (~40KB template) → this module is dynamic-imported by the BCA page.
 */
import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { SCAN_TEMPLATE } from "./_scan-template";
import type { ScanRevealData } from "./_scan-data";

export function BcaScanReveal({ data, onClose }: { data: ScanRevealData; onClose: () => void }) {
  const srcDoc = useMemo(() => {
    // Escape "<" so nothing in the data (e.g. a name) can break out of the
    // injected <script>. A function replacer avoids `$` substitution surprises.
    const json = JSON.stringify(data).replace(/</g, "\\u003c");
    const inject = `<head><script>window.__SCAN_DATA__=${json};<\/script>`;
    return SCAN_TEMPLATE.replace("<head>", () => inject);
  }, [data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ผลสแกนองค์ประกอบร่างกาย"
      className="fixed inset-0 z-[60] flex flex-col bg-ink/70 p-2 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="mx-auto flex w-full max-w-5xl items-center justify-between px-1 pb-2"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="font-head text-[13px] font-bold text-white/90">UP Labs · Body Scan</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X size={18} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      <iframe
        title="ผลสแกนองค์ประกอบร่างกาย"
        srcDoc={srcDoc}
        className="mx-auto w-full max-w-5xl flex-1 rounded-2xl border-0 bg-white shadow-2xl"
      />
    </div>
  );
}
