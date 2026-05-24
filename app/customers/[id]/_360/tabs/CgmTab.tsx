"use client";

import Link from "next/link";

export function CgmTab({ customerId, profiles }: { customerId: string; profiles: string[] }) {
  return (
    <div className="space-y-4">
      <div className="liquid rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-thai text-[14px] font-bold text-ink">📈 CGM Profiles ที่ link</h3>
            <p className="font-mono text-[10px] text-ink-40 mt-0.5">
              {profiles.length === 0 ? "ยังไม่มี profile ที่ link" : `${profiles.length} profile`}
            </p>
          </div>
          <Link href="/cgm" className="rounded-full bg-rose px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-deep transition">
            ดู CGM Analyzer →
          </Link>
        </div>

        {profiles.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {profiles.map(p => (
              <span key={p} className="rounded-full bg-white/60 backdrop-blur-md border border-white/70 px-3 py-1.5 text-[12px] font-mono text-ink">
                🔗 {p}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-4 liquid rounded-xl p-6 text-center border-dashed">
            <p className="font-thai text-[12px] text-ink-60">ยังไม่ได้ link CGM profile</p>
            <p className="mt-1 font-mono text-[10px] text-ink-40">link จาก profile page (legacy view · ?legacy=1)</p>
          </div>
        )}
      </div>

      <div className="liquid-info rounded-2xl p-5">
        <h3 className="font-thai text-[13px] font-bold" style={{ color: "#14532D" }}>💡 CGM Insights ที่กำลังพัฒนา</h3>
        <p className="mt-1 text-[11px]" style={{ color: "#14532D", opacity: 0.85 }}>
          เร็วๆ นี้: Time in Range · spike pattern analysis · meal correlation · dawn phenomenon detection
        </p>
      </div>
    </div>
  );
}
