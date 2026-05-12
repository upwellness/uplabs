"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ROLES, ROLE_LABEL_TH, type Role } from "@/lib/auth/roles";
import { createUser } from "./actions";

export function NewUserButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("other");
  const [pending, start] = useTransition();

  const submit = () => start(async () => {
    const r = await createUser(email, password, role, name || undefined);
    if (r?.error) { alert(r.error); return; }
    setOpen(false);
    setEmail(""); setPassword(""); setName(""); setRole("other");
  });

  return (
    <>
      <Button variant="rose" onClick={() => setOpen(true)}>+ เพิ่ม user ใหม่</Button>
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-ink-10 px-7 py-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Create User</div>
              <div className="mt-1 font-head text-xl font-extrabold tracking-tight text-ink">เพิ่ม user ใหม่</div>
            </div>
            <div className="space-y-4 p-7">
              <Input label="Email" type="email" value={email} onChange={setEmail} />
              <Input label="Password ชั่วคราว" type="password" value={password} onChange={setPassword} />
              <Input label="ชื่อแสดง (optional)" value={name} onChange={setName} />
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-60">Role</div>
                <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL_TH[r]}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-ink-10 bg-surface px-7 py-4">
              <Button variant="ghost" onClick={() => setOpen(false)}>ยกเลิก</Button>
              <Button variant="rose" onClick={submit} disabled={pending}>{pending ? "..." : "สร้าง user"}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Input({ label, type = "text", value, onChange }: { label: string; type?: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-60">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm outline-none focus:border-rose focus:ring-2 focus:ring-rose-ultra"
      />
    </label>
  );
}
