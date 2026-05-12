"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { CGMMeal } from "@/lib/types-cgm";

interface MealFormProps {
  profileName: string;
  initial?: Partial<CGMMeal>;
  onCancel: () => void;
  onSubmit: (m: { meal_timestamp: number; description: string; carbs: number | null; protein: number | null; fat: number | null }) => void;
}

const tsToLocalInput = (ts?: number | null): string => {
  const d = ts ? new Date(ts) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function MealForm({ profileName, initial, onCancel, onSubmit }: MealFormProps) {
  const isEdit = Boolean(initial?.id);

  const [time, setTime] = useState(tsToLocalInput(initial?.meal_timestamp ?? null));
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [c,    setC]    = useState(initial?.carbs   != null ? String(initial.carbs)   : "");
  const [p,    setP]    = useState(initial?.protein != null ? String(initial.protein) : "");
  const [f,    setF]    = useState(initial?.fat     != null ? String(initial.fat)     : "");

  const num = (v: string) => (v === "" ? null : Number(v));

  const submit = () => {
    if (!time) return alert("กรุณาเลือกเวลา");
    onSubmit({
      meal_timestamp: new Date(time).getTime(),
      description:    desc || "มื้ออาหาร",
      carbs:   num(c),
      protein: num(p),
      fat:     num(f),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm md:items-center"
      onClick={onCancel}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-ink-10 px-7 py-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
            {isEdit ? "Edit Meal" : "Log Meal"}
          </div>
          <div className="mt-1 font-head text-xl font-extrabold tracking-tight text-ink">
            {isEdit ? "แก้ไขมื้ออาหาร" : "บันทึกมื้ออาหาร"} — {profileName}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 p-7">
          <Field label="วันเวลา" type="datetime-local" value={time} onChange={setTime} full />
          <Field label="รายการอาหาร" value={desc} onChange={setDesc} placeholder="ข้าวกะเพรา + ไข่ดาว" full />
          <Field label="คาร์บ (g)"     value={c} onChange={setC} placeholder="45" />
          <Field label="โปรตีน (g)"    value={p} onChange={setP} placeholder="25" />
          <Field label="ไขมัน (g)"     value={f} onChange={setF} placeholder="15" full />
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-ink-10 bg-surface px-7 py-4">
          <Button variant="ghost" onClick={onCancel}>ยกเลิก</Button>
          <Button variant="rose" onClick={submit}>{isEdit ? "บันทึกการแก้ไข" : "บันทึกมื้อ"}</Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", full,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; full?: boolean;
}) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-60">{label}</span>
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
