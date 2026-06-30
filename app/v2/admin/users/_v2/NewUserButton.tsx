"use client";

/**
 * UP Labs v2 · Create user (clinical-warm dialog)
 * Mirrors v1 NewUserButton — reuses the createUser server action unchanged.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { UserPlus, X, Loader2 } from "lucide-react";
import { ROLES, ROLE_LABEL_TH, type Role } from "@/lib/auth/roles";
import { createUser } from "@/app/admin/users/actions";

export function NewUserButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("other");
  const [pending, start] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    firstFieldRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = () => start(async () => {
    const r = await createUser(email, password, role, name || undefined);
    if (r?.error) { alert(r.error); return; }
    setOpen(false);
    setEmail(""); setPassword(""); setName(""); setRole("other");
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
      >
        <UserPlus size={15} strokeWidth={2.25} aria-hidden /> เพิ่มผู้ใช้ใหม่
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm md:items-center" onClick={() => setOpen(false)}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="v2-newuser-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-ink-10 bg-white shadow-[0_20px_50px_-20px_rgba(24,21,26,0.45)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-ink-5 px-5 py-4 lg:px-6">
              <div>
                <div className="text-[11px] font-semibold text-ink-40">สร้างผู้ใช้</div>
                <h2 id="v2-newuser-title" className="mt-0.5 font-head text-[18px] font-extrabold tracking-tight text-ink">เพิ่มผู้ใช้ใหม่</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="ปิด"
                className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-ink-60 hover:bg-ink-5 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
              >
                <X size={18} strokeWidth={2.25} aria-hidden />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5 lg:px-6">
              <Field label="Email" type="email" value={email} onChange={setEmail} inputRef={firstFieldRef} />
              <Field label="Password ชั่วคราว" type="password" value={password} onChange={setPassword} />
              <Field label="ชื่อแสดง (ไม่บังคับ)" value={name} onChange={setName} />
              <label className="block">
                <span className="text-[12px] font-semibold text-ink-60">Role</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="mt-1.5 w-full min-h-[44px] rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-rose focus:ring-2 focus:ring-rose-ultra"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL_TH[r]}</option>)}
                </select>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-ink-5 bg-surface/60 px-5 py-3.5 lg:px-6">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-[44px] items-center rounded-full border border-ink-10 bg-white px-4 py-1.5 text-[13px] font-semibold text-ink-60 transition-colors hover:border-ink-20 hover:text-ink"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}
                สร้างผู้ใช้
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label, type = "text", value, onChange, inputRef,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-ink-60">{label}</span>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-rose focus:ring-2 focus:ring-rose-ultra"
      />
    </label>
  );
}
