"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { updatePassword } from "../actions";

export function ResetForm() {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, start] = useTransition();

  // The recovery link routes through /auth/callback, which exchanges the code
  // and writes the auth cookies before redirecting here. The @supabase/ssr
  // browser client reads that same cookie session on mount.
  useEffect(() => {
    const supa = createClient();
    supa.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
      if (!data.session) setError("Link หมดอายุหรือไม่ถูกต้อง — กดขอ link ใหม่อีกครั้ง");
    });
  }, []);

  const submit = (fd: FormData) => {
    setError(null);
    start(async () => {
      const r = await updatePassword(fd);
      if (r?.error) setError(r.error);
    });
  };

  return (
    <form action={submit} className="space-y-4">
      <Field name="password" type="password" label="Password ใหม่" placeholder="อย่างน้อย 8 ตัว" required disabled={!ready} />
      <Field name="confirm"  type="password" label="ยืนยัน password" placeholder="พิมพ์ซ้ำ" required disabled={!ready} />

      {error && (
        <div className="rounded-xl border border-status-bg-danger bg-status-bg-danger px-4 py-3 text-sm text-status-danger">{error}</div>
      )}

      <Button type="submit" variant="rose" size="lg" className="w-full" disabled={!ready || pending}>
        {pending ? "กำลังบันทึก..." : "บันทึก password ใหม่"}
      </Button>
    </form>
  );
}

function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-60">{label}</span>
      <input
        {...rest}
        className="w-full rounded-xl border border-ink-10 bg-white px-4 py-3 text-sm font-medium text-ink outline-none transition-all focus:border-rose focus:ring-2 focus:ring-rose-ultra placeholder:text-ink-20 disabled:bg-ink-5"
      />
    </label>
  );
}
