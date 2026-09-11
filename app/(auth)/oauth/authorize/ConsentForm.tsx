"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { decide } from "./actions";

export interface ScopeOption { key: string; label: string; checked: boolean; clinical: boolean }

export function ConsentForm({ params, scopes }: { params: Record<string, string>; scopes: ScopeOption[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (fd: FormData) => {
    setError(null);
    start(async () => {
      const r = await decide(fd);
      if (r?.error) setError(r.error);
    });
  };

  return (
    <form action={submit} className="space-y-5">
      {Object.entries(params).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      <fieldset className="space-y-2">
        <legend className="mb-2 font-thai text-sm font-semibold text-ink">สิทธิ์ที่จะให้</legend>
        {scopes.map((s) => (
          <label key={s.key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-10 px-3 py-2 hover:bg-ink-5">
            <input type="checkbox" name="scopes" value={s.key} defaultChecked={s.checked} className="mt-1 h-4 w-4 accent-rose" />
            <span className="font-thai text-sm text-ink">
              {s.label}
              <span className="ml-2 font-mono text-[11px] text-ink-40">{s.key}</span>
              {s.key === "labs:write" && <span className="ml-2 rounded bg-status-bg-danger px-1.5 py-0.5 text-[10px] text-status-danger">เขียนประวัติตรง ไม่ผ่านคิวตรวจ</span>}
            </span>
          </label>
        ))}
      </fieldset>

      {error && <div className="rounded-xl border border-status-bg-danger bg-status-bg-danger px-4 py-3 text-sm text-status-danger">{error}</div>}

      <div className="flex gap-3">
        <Button type="submit" name="decision" value="deny" variant="outline" size="lg" className="flex-1" disabled={pending}>ไม่อนุญาต</Button>
        <Button type="submit" name="decision" value="allow" variant="rose" size="lg" className="flex-1" disabled={pending}>{pending ? "กำลังเชื่อมต่อ…" : "อนุญาต"}</Button>
      </div>
    </form>
  );
}
