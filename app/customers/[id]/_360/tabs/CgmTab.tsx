"use client";

import Link from "next/link";

export function CgmTab({ customerId, profiles }: { customerId: string; profiles: string[] }) {
  return (
    <div className="space-y-4">
      <div className="liquid rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-thai text-[14px] font-bold text-ink">📈 CGM Profile ที่เชื่อมไว้</h3>
            <p className="font-mono text-[10px] text-ink-40 mt-0.5">
              {profiles.length === 0 ? "ยังไม่มีการเชื่อมต่อ" : `${profiles.length} profile`}
            </p>
          </div>
          <Link href="/cgm" className="rounded-full bg-rose px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-deep transition">
            ไปดู CGM Analyzer →
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
            <p className="font-thai text-[12px] text-ink-60">ยังไม่ได้เชื่อม CGM Profile ของคนไข้คนนี้</p>
            <p className="mt-1 font-thai text-[11px] text-ink-60">เชื่อมได้จากหน้า Profile (มุมมองเดิม · ?legacy=1)</p>
          </div>
        )}
      </div>

      <div className="liquid-info rounded-2xl p-5">
        <h3 className="font-thai text-[13px] font-bold" style={{ color: "#14532D" }}>💡 ฟีเจอร์ CGM ที่กำลังพัฒนา</h3>
        <p className="mt-1 text-[11px]" style={{ color: "#14532D", opacity: 0.85 }}>
          เร็วๆ นี้ · เวลาที่น้ำตาลอยู่ในเกณฑ์ดี · จับ pattern น้ำตาลพุ่ง · เชื่อมกับมื้ออาหาร · ตรวจ dawn phenomenon
        </p>
      </div>
    </div>
  );
}
