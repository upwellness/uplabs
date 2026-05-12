"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { signIn } from "../actions";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, start] = useTransition();

  const submit = (formData: FormData) => {
    setError(null);
    start(async () => {
      const result = await signIn(formData);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />

      <Field name="identifier" type="text" label="Email / ABO / เบอร์โทร" placeholder="you@example.com · 7866861 · 0812345678" required autoFocus autoComplete="username" />
      <Field name="password" type="password" label="Password" placeholder="••••••••" required />

      {error && (
        <div className="rounded-xl border border-status-bg-danger bg-status-bg-danger px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      <Button type="submit" variant="rose" size="lg" className="w-full" disabled={pending}>
        {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
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
        className="w-full rounded-xl border border-ink-10 bg-white px-4 py-3 text-sm font-medium text-ink outline-none transition-all focus:border-rose focus:ring-2 focus:ring-rose-ultra placeholder:text-ink-20"
      />
    </label>
  );
}
