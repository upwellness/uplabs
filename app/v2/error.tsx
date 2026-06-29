"use client";

/**
 * UP Labs v2 · Segment error boundary (SPEC §5/§8 — graceful failure)
 * ──────────────────────────────────────────────────────────────────
 * Replaces React's raw "Application error" with a clinical-warm screen + a retry
 * button, so any unexpected crash inside /v2 fails softly. Logs the digest for debug.
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function V2Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[v2] segment error:", error?.message, error?.digest);
  }, [error]);

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto flex max-w-content flex-col items-center justify-center px-6 py-24 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-status-bg-danger text-status-danger">
          <AlertTriangle size={26} strokeWidth={2} aria-hidden />
        </span>
        <h1 className="mt-4 font-head text-[22px] font-extrabold tracking-tight text-ink">เกิดข้อผิดพลาดชั่วคราว</h1>
        <p className="mt-2 max-w-md font-thai text-[13px] leading-[1.7] text-ink-60">
          ระบบสะดุดเล็กน้อยตอนเปิดหน้านี้ — ลองโหลดใหม่อีกครั้งได้เลยค่ะ ข้อมูลของลูกค้าไม่ได้รับผลกระทบ
          {error?.digest ? <span className="mt-1 block font-mono text-[11px] text-ink-60">รหัสอ้างอิง: {error.digest}</span> : null}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            <RefreshCw size={15} strokeWidth={2.25} aria-hidden /> ลองใหม่อีกครั้ง
          </button>
          <Link
            href="/v2"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-5 py-2.5 text-[13px] font-semibold text-ink-80 transition-colors hover:border-rose hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            <Home size={15} strokeWidth={2.25} aria-hidden /> กลับหน้าแรก
          </Link>
        </div>
      </div>
    </div>
  );
}
