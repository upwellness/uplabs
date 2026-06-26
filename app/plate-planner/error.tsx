"use client";
/**
 * Segment error boundary — กันหน้าทั้งระบบล่มถ้า Plate Planner เกิด error
 * (แทนที่ "Application error" ดิบ ๆ ด้วยข้อความที่อ่านรู้เรื่อง + ปุ่มลองใหม่ · log digest ไว้ debug)
 */
import { useEffect } from "react";

export default function PlatePlannerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[plate-planner] segment error:", error?.message, error?.digest);
  }, [error]);

  return (
    <div className="mx-auto max-w-content px-6 py-20 text-center font-thai">
      <div className="text-3xl">🍽️</div>
      <h2 className="mt-3 font-head text-xl font-bold text-ink">เปิด Plate Planner ไม่สำเร็จ</h2>
      <p className="mt-2 text-sm text-ink-60">
        เกิดข้อผิดพลาดชั่วคราว — ลองใหม่อีกครั้งได้เลย
        {error?.digest ? <span className="block mt-1 text-xs text-ink-40">รหัส: {error.digest}</span> : null}
      </p>
      <button
        onClick={reset}
        className="mt-5 rounded-xl bg-wellness px-5 py-2.5 text-sm font-semibold text-white hover:bg-wellness-deep transition-colors"
      >
        ลองใหม่
      </button>
    </div>
  );
}
