"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { requestPasswordReset } from "../actions";

export function ForgotForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  const submit = (formData: FormData) => {
    setError(null);
    start(async () => {
      const r = await requestPasswordReset(formData);
      if (r?.error) setError(r.error);
      else setSent(true);
    });
  };

  if (sent) {
    return (
      <div className="rounded-xl border border-status-bg-optimal bg-status-bg-optimal p-5 text-sm text-status-optimal">
        ส่ง email สำเร็จ — โปรดเช็ค inbox (และ spam) สำหรับ link reset password
      </div>
    );
  }

  return (
    <form action={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-60">Email</span>
        <input
          name="email"
          type="email"
          required
          autoFocus
          placeholder="you@example.com"
          className="w-full rounded-xl border border-ink-10 bg-white px-4 py-3 text-sm font-medium text-ink outline-none transition-all focus:border-rose focus:ring-2 focus:ring-rose-ultra placeholder:text-ink-20"
        />
      </label>

      {error && (
        <div className="rounded-xl border border-status-bg-danger bg-status-bg-danger px-4 py-3 text-sm text-status-danger">{error}</div>
      )}

      <Button type="submit" variant="rose" size="lg" className="w-full" disabled={pending}>
        {pending ? "กำลังส่ง..." : "ส่ง link reset password"}
      </Button>
    </form>
  );
}
