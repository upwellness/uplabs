"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Customer, Measurement } from "@/lib/types";

interface MeasurementFormProps {
  customer: Customer;
  onCancel: () => void;
  onSubmit: (m: Omit<Measurement, "id" | "customer_id">) => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function MeasurementForm({ customer, onCancel, onSubmit }: MeasurementFormProps) {
  const [weight, setWeight] = useState<string>("");
  const [fat, setFat] = useState<string>("");
  const [muscle, setMuscle] = useState<string>("");
  const [visceral, setVisceral] = useState<string>("");
  const [bodyAge, setBodyAge] = useState<string>("");
  const [bmr, setBmr] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());

  const num = (v: string) => (v === "" ? null : Number(v));

  const submit = () => {
    if (!weight) return alert("กรุณากรอกน้ำหนัก");
    onSubmit({
      recorded_at: new Date(date).toISOString(),
      weight: Number(weight),
      fat_pct: num(fat),
      muscle_pct: num(muscle),
      visceral: num(visceral),
      body_age: num(bodyAge),
      bmr: num(bmr),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm md:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-ink-10 px-7 py-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">New Measurement</div>
          <div className="mt-1 font-head text-xl font-extrabold tracking-tight text-ink">
            บันทึกค่าการวัด — {customer.name}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 p-7">
          <Field label="วันที่วัด" value={date} onChange={setDate} type="date" full />
          <Field label="น้ำหนัก (kg)" value={weight} onChange={setWeight} placeholder="65.0" required />
          <Field label="Body Fat %" value={fat} onChange={setFat} placeholder="22.0" />
          <Field label="Muscle %" value={muscle} onChange={setMuscle} placeholder="32.0" />
          <Field label="Visceral Fat (lv)" value={visceral} onChange={setVisceral} placeholder="6" />
          <Field label="Body Age (yr)" value={bodyAge} onChange={setBodyAge} placeholder="32" />
          <Field label="BMR (kcal)" value={bmr} onChange={setBmr} placeholder="1340" full />
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-ink-10 bg-surface px-7 py-4">
          <Button variant="ghost" onClick={onCancel}>ยกเลิก</Button>
          <Button variant="rose" onClick={submit}>บันทึกการวัด</Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", required, full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-60">
        {label} {required && <span className="text-rose">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm font-medium text-ink outline-none transition-all focus:border-rose focus:ring-2 focus:ring-rose-ultra placeholder:text-ink-20"
      />
    </label>
  );
}
