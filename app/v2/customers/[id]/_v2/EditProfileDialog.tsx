"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, AlertTriangle } from "lucide-react";
import { validateProfileEdit } from "@/lib/v2/identity";

interface EditableCustomer {
  name: string;
  gender: string | null;
  birth_date: string | null;
  height: number | string | null;
}

/**
 * Edit the identity fields on a customer profile: name, gender, date of birth, height.
 *
 * These four exist together because they are what the rest of the app derives from —
 * age drives PhenoAge and every reference range, height drives BMI, gender drives
 * half the clinical thresholds. A profile with the wrong birth year quietly produces
 * wrong numbers everywhere and nothing looks broken, which is why editing them needed
 * to be one click from the profile rather than a trip to the legacy page.
 *
 * Dates are Gregorian (ค.ศ.) throughout the system. The field says so, because Thai
 * lab slips print Buddhist years and typing 2569 here would put the customer's birth
 * 543 years in the future.
 */
export function EditProfileDialog({
  customerId, customer,
}: { customerId: string; customer: EditableCustomer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(customer.name ?? "");
  const [gender, setGender] = useState(customer.gender ?? "");
  const [birthDate, setBirthDate] = useState(customer.birth_date ?? "");
  const [height, setHeight] = useState(customer.height == null ? "" : String(customer.height));

  function reset() {
    setName(customer.name ?? "");
    setGender(customer.gender ?? "");
    setBirthDate(customer.birth_date ?? "");
    setHeight(customer.height == null ? "" : String(customer.height));
    setError(null);
  }

  const thisYear = new Date().getFullYear();
  const birthYear = birthDate ? Number(birthDate.slice(0, 4)) : null;
  // A Buddhist year typed into a Gregorian field is the mistake this catches.
  const looksBuddhist = birthYear != null && birthYear > thisYear;

  async function save() {
    // Same validator the API runs — one set of rules, so the dialog can never accept
    // something the server will then reject with a less helpful message.
    const check = validateProfileEdit({ name, gender, birth_date: birthDate, height });
    if (!check.ok) { setError(check.error!); return; }

    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(check.value),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "บันทึกไม่สำเร็จ");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink-60 transition-colors hover:border-ink-20 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
      >
        <Pencil size={14} strokeWidth={2.25} aria-hidden /> แก้ไขข้อมูล
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
          role="dialog" aria-modal="true" aria-labelledby="edit-title"
          onClick={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h2 id="edit-title" className="text-lg font-semibold text-ink">แก้ไขข้อมูลลูกค้า</h2>
              <button onClick={() => setOpen(false)} disabled={busy} aria-label="ปิด"
                className="rounded-lg p-1 text-ink-40 hover:bg-ink-5 disabled:opacity-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-ink-80">ชื่อ</span>
                <input
                  value={name} onChange={(e) => setName(e.target.value)} autoFocus
                  className="mt-1 min-h-11 w-full rounded-xl border border-ink-10 bg-white px-3 text-sm"
                />
              </label>

              <fieldset>
                <legend className="text-sm font-medium text-ink-80">เพศ</legend>
                <div className="mt-1 flex gap-2">
                  {([["female", "หญิง"], ["male", "ชาย"], ["", "ไม่ระบุ"]] as const).map(([v, label]) => (
                    <label key={v || "none"}
                      className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm transition-colors ${
                        gender === v ? "border-rose bg-rose-ultra font-semibold text-rose" : "border-ink-10 bg-white text-ink-60"
                      }`}>
                      <input type="radio" name="gender" checked={gender === v}
                        onChange={() => setGender(v)} className="sr-only" />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="block">
                <span className="text-sm font-medium text-ink-80">
                  วันเกิด <span className="font-normal text-ink-40">— ปี ค.ศ. (พ.ศ. ลบ 543)</span>
                </span>
                <input
                  type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-ink-10 bg-white px-3 text-sm"
                />
                {looksBuddhist && (
                  <span className="mt-1 block text-xs text-amber">
                    ปี {birthYear} เป็นอนาคต — น่าจะกรอกเป็น พ.ศ. · ค.ศ. คือ {birthYear! - 543}
                  </span>
                )}
                <span className="mt-1 block text-xs text-ink-40">
                  ใช้คำนวณอายุ · เกณฑ์อ้างอิงผลแล็บ · อายุสุขภาพ (PhenoAge)
                </span>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-ink-80">ส่วนสูง <span className="font-normal text-ink-40">(ซม.)</span></span>
                <input
                  value={height} onChange={(e) => setHeight(e.target.value)}
                  inputMode="decimal" placeholder="เช่น 165"
                  className="mt-1 min-h-11 w-full rounded-xl border border-ink-10 bg-white px-3 text-sm"
                />
                <span className="mt-1 block text-xs text-ink-40">ใช้คำนวณ BMI จากค่า BCA</span>
              </label>
            </div>

            {error && (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-pale px-3 py-2 text-sm text-rose-deep">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button onClick={save} disabled={busy}
                className="min-h-11 flex-1 rounded-xl bg-rose px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-deep disabled:opacity-50">
                {busy ? "กำลังบันทึก…" : "บันทึก"}
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
