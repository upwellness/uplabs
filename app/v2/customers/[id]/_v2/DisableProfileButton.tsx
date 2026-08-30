"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, X, AlertTriangle } from "lucide-react";

/**
 * Retire / restore a customer profile.
 *
 * "Disable" here means hidden from lists and search — never deleted. Lab history is
 * the record; a duplicate profile is a naming problem, not a reason to destroy two
 * years of results. So the copy in this dialog says plainly what survives, because
 * the fear that stops people tidying up is not knowing whether it is reversible.
 *
 * The reason field is optional but offered, since six months later "why is this one
 * off?" is exactly the question nobody can answer.
 */
export function DisableProfileButton({
  customerId, customerName, disabledAt,
}: { customerId: string; customerName: string; disabledAt: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDisabled = !!disabledAt;

  async function submit(next: boolean) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: next, disabled_reason: next ? reason : undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "ทำรายการไม่สำเร็จ");
      setOpen(false); setReason("");
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  // Restoring is harmless and reversible — no dialog, just do it.
  if (isDisabled) {
    return (
      <button
        onClick={() => submit(false)}
        disabled={busy}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-wellness/25 bg-wellness-ultra px-3.5 py-1.5 text-[12px] font-semibold text-wellness transition-colors hover:bg-wellness hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2 disabled:opacity-50"
      >
        <ArchiveRestore size={14} strokeWidth={2.25} aria-hidden />
        {busy ? "กำลังเปิด…" : "เปิดใช้งานอีกครั้ง"}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink-60 transition-colors hover:border-ink-20 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
        title="ซ่อนโปรไฟล์นี้จากรายการ (ข้อมูลไม่ถูกลบ)"
      >
        <Archive size={14} strokeWidth={2.25} aria-hidden /> ปิดใช้งานโปรไฟล์
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
          role="dialog" aria-modal="true" aria-labelledby="disable-title"
          onClick={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h2 id="disable-title" className="text-lg font-semibold text-ink">
                ปิดใช้งานโปรไฟล์ &ldquo;{customerName}&rdquo;
              </h2>
              <button onClick={() => setOpen(false)} disabled={busy} aria-label="ปิด"
                className="rounded-lg p-1 text-ink-40 hover:bg-ink-5 disabled:opacity-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 rounded-xl bg-wellness-ultra px-3 py-2.5 text-sm text-wellness">
              <b>ข้อมูลทั้งหมดยังอยู่ครบ</b> — ผลแล็บ · BCA · โน้ต · รายงาน ไม่ถูกลบสักอย่าง
              และเปิดกลับมาใช้ได้ทุกเมื่อ
            </div>

            <p className="mt-3 text-sm text-ink-60">สิ่งที่จะเปลี่ยนไป:</p>
            <ul className="mt-1 space-y-1 pl-5 text-sm text-ink-60" style={{ listStyle: "disc" }}>
              <li>หายจากรายการลูกค้าและช่องค้นหา (เปิดดูได้ถ้ากด &ldquo;แสดงที่ปิดใช้งาน&rdquo;)</li>
              <li>ผู้ช่วย AI ที่ต่อผ่าน API จะไม่เจอโปรไฟล์นี้ตอนค้นชื่อ</li>
              <li>ยังเปิดหน้านี้ได้จากลิงก์ตรง และจะมีป้ายบอกว่าปิดใช้งานอยู่</li>
            </ul>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-ink-80">เหตุผล <span className="font-normal text-ink-40">(ไม่บังคับ แต่ช่วยเตือนความจำ)</span></span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="เช่น โปรไฟล์ซ้ำ · เลิกใช้บริการ · สร้างไว้ทดสอบ"
                maxLength={200}
                className="mt-1 min-h-11 w-full rounded-xl border border-ink-10 bg-white px-3 text-sm"
              />
            </label>

            {error && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-pale px-3 py-2 text-sm text-rose-deep">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button onClick={() => submit(true)} disabled={busy}
                className="min-h-11 flex-1 rounded-xl bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-rose disabled:opacity-50">
                {busy ? "กำลังปิด…" : "ปิดใช้งาน"}
              </button>
              <button onClick={() => setOpen(false)} disabled={busy}
                className="min-h-11 rounded-xl border border-ink-10 bg-white px-4 text-sm text-ink-60 disabled:opacity-50">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Banner shown at the top of a retired profile so nobody reads it as current. */
export function DisabledBanner({ disabledAt, reason }: { disabledAt: string; reason?: string | null }) {
  const when = new Date(disabledAt);
  const label = Number.isNaN(when.getTime())
    ? null
    : when.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-amber/30 bg-amber-ultra px-4 py-3 text-sm text-amber"
    >
      <span className="inline-flex items-center gap-2 font-semibold">
        <Archive size={16} strokeWidth={2.25} aria-hidden /> โปรไฟล์นี้ปิดใช้งานอยู่
      </span>
      {label && <span className="text-ink-60">ตั้งแต่ {label}</span>}
      {reason && <span className="text-ink-60">· {reason}</span>}
      <span className="text-ink-60">· ข้อมูลยังอยู่ครบ ไม่ได้ถูกลบ</span>
    </div>
  );
}
