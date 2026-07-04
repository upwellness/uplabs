"use client";

import { useRef, useState } from "react";
import { Upload, Check, Loader2, AlertTriangle } from "lucide-react";

/**
 * Upload a Longevity Report (.html generated via Claude Code / cowork) into the
 * PRIVATE Supabase store — never git/public. On success the report is viewable via
 * the auth-gated "Longevity Report" button and the public /r/lab/<token> share link.
 */
export function LabReportUploadButton({ customerId }: { customerId: string }) {
  const [state, setState] = useState<"idle" | "up" | "done" | "err">("idle");
  const [msg, setMsg] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setState("up");
    setMsg("");
    try {
      const html = await f.text();
      const res = await fetch(`/api/customers/${customerId}/lab-report`, {
        method: "PUT",
        headers: { "content-type": "text/html" },
        body: html,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "อัปโหลดไม่สำเร็จ");
      setState("done");
      setMsg("อัปโหลดแล้ว");
      setTimeout(() => setState("idle"), 2500);
    } catch (err: unknown) {
      setState("err");
      setMsg(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    }
    if (ref.current) ref.current.value = "";
  };

  return (
    <span className="inline-flex items-center gap-2">
      <input ref={ref} type="file" accept=".html,text/html" onChange={onFile} className="hidden" />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={state === "up"}
        title="อัปโหลดไฟล์ Longevity Report (.html) เก็บเข้าระบบแบบส่วนตัว"
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60 transition-colors hover:bg-surface disabled:opacity-60"
      >
        {state === "up" ? <Loader2 size={14} className="animate-spin" aria-hidden />
          : state === "done" ? <Check size={14} className="text-wellness" aria-hidden />
          : state === "err" ? <AlertTriangle size={14} className="text-amber" aria-hidden />
          : <Upload size={14} aria-hidden />}
        {state === "up" ? "กำลังอัปโหลด…" : state === "done" ? "อัปโหลดแล้ว" : "อัปโหลด Report"}
      </button>
      {state === "err" && <span className="text-[11px] text-amber">{msg}</span>}
    </span>
  );
}
