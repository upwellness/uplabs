"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function RegisterForm({ token }: { token: string }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) { setError("กรุณากรอก email จริง"); return; }
    if (password.length < 8) { setError("password ต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    if (password !== confirm) { setError("password ไม่ตรงกัน"); return; }

    setSubmitting(true); setError(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email: email.trim(), password, display_name: displayName.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "สมัครไม่สำเร็จ");

      // Auto sign-in with the credentials they just set, then enter the app.
      const supa = createClient();
      const { error: signErr } = await supa.auth.signInWithPassword({ email: email.trim(), password });
      if (signErr) {
        // Account exists but sign-in failed — fall back to the login page.
        window.location.href = "/login";
        return;
      }
      window.location.href = "/v2";
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="ชื่อ-นามสกุล" value={displayName} onChange={setDisplayName} placeholder="ชื่อที่แสดงในระบบ" />
      <Field label="Email (จริง)" value={email} onChange={setEmail} type="email" required placeholder="you@email.com" />
      <Field label="ตั้ง Password" value={password} onChange={setPassword} type="password" required placeholder="อย่างน้อย 8 ตัว" />
      <Field label="ยืนยัน Password" value={confirm} onChange={setConfirm} type="password" required placeholder="พิมพ์ซ้ำอีกครั้ง" />
      {error && <div className="rounded-xl border border-status-bg-danger bg-status-bg-danger px-4 py-3 text-sm text-status-danger">{error}</div>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-rose px-5 py-3 text-[14px] font-bold text-white transition-colors hover:bg-rose-mid disabled:opacity-50"
      >
        {submitting ? "กำลังสมัคร…" : "สมัครและเข้าสู่ระบบ"}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">
        {label}{required && <span className="text-rose ml-1">*</span>}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30 focus:border-rose focus:outline-none"
      />
    </label>
  );
}
