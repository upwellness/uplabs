"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function NewCustomerForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [birthYear, setBirthYear] = useState("");
  const [height, setHeight] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const submit = async () => {
    if (!name || !gender) { setError("กรุณากรอกชื่อและเลือกเพศ"); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          gender,
          birth_year: birthYear ? +birthYear : null,
          height: height ? +height : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "สร้างไม่สำเร็จ");
      router.push(`/customers/${json.customer.id}`);
      onCreated();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm md:items-center" onClick={onCancel}>
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-ink-10 px-7 py-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">New Customer</div>
          <div className="mt-1 font-head text-xl font-extrabold tracking-tight text-ink">เพิ่มลูกค้าใหม่</div>
        </div>
        <div className="space-y-4 p-7">
          <Field label="ชื่อ" value={name} onChange={setName} required placeholder="คุณ___" />
          <div>
            <Label>เพศ <span className="text-rose">*</span></Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <Chip checked={gender === "male"}   onClick={() => setGender("male")}>ชาย</Chip>
              <Chip checked={gender === "female"} onClick={() => setGender("female")}>หญิง</Chip>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ปีเกิด" value={birthYear} onChange={setBirthYear} type="number" placeholder="1985" />
            <Field label="ส่วนสูง (cm)" value={height} onChange={setHeight} type="number" placeholder="165" />
          </div>
          {error && <div className="rounded-xl border border-status-bg-danger bg-status-bg-danger px-4 py-3 text-sm text-status-danger">{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-ink-10 bg-surface px-7 py-4">
          <Button variant="ghost" onClick={onCancel}>ยกเลิก</Button>
          <Button variant="rose" onClick={submit} disabled={submitting}>{submitting ? "..." : "สร้าง"}</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <Label>{label}{required && <span className="text-rose ml-1">*</span>}</Label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30 focus:border-rose focus:outline-none" />
    </label>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">{children}</div>;
}

function Chip({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all ${checked ? "border-rose bg-rose-ultra text-rose" : "border-ink-10 bg-white text-ink hover:border-ink-20"}`}>
      {checked && <span className="mr-1.5">✓</span>}{children}
    </button>
  );
}
