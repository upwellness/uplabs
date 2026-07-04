"use client";

import { useRef, useState } from "react";
import { Upload, Check, Loader2, AlertTriangle } from "lucide-react";

/**
 * Upload a per-customer report (.html generated via Claude Code / cowork) into the
 * PRIVATE Supabase store — never git/public. `kind` selects the report type and
 * doubles as the API path segment:
 *   - "lab-report" → Longevity Report (also mints a public /r/lab/<token> share link)
 *   - "med-map"    → Medication & Supplement Map (auth-gated only, no public link)
 * On success the report is viewable via the matching auth-gated button on the profile.
 */
type ReportKind = "lab-report" | "med-map";

const KIND_META: Record<ReportKind, { label: string; title: string }> = {
  "lab-report": {
    label: "อัปโหลด Lab Report",
    title: "อัปโหลดไฟล์ Longevity Report (.html) เก็บเข้าระบบแบบส่วนตัว",
  },
  "med-map": {
    label: "อัปโหลด Med-Map",
    title: "อัปโหลดไฟล์ Med-Map แผนผังยา & อาหารเสริม (.html) เก็บเข้าระบบแบบส่วนตัว",
  },
};

export function ReportUploadButton({
  customerId,
  kind = "lab-report",
}: {
  customerId: string;
  kind?: ReportKind;
}) {
  const [state, setState] = useState<"idle" | "up" | "done" | "err">("idle");
  const [msg, setMsg] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const meta = KIND_META[kind];

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setState("up");
    setMsg("");
    try {
      const html = await f.text();
      const res = await fetch(`/api/customers/${customerId}/${kind}`, {
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
        title={meta.title}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60 transition-colors hover:bg-surface disabled:opacity-60"
      >
        {state === "up" ? <Loader2 size={14} className="animate-spin" aria-hidden />
          : state === "done" ? <Check size={14} className="text-wellness" aria-hidden />
          : state === "err" ? <AlertTriangle size={14} className="text-amber" aria-hidden />
          : <Upload size={14} aria-hidden />}
        {state === "up" ? "กำลังอัปโหลด…" : state === "done" ? "อัปโหลดแล้ว" : meta.label}
      </button>
      {state === "err" && <span className="text-[11px] text-amber">{msg}</span>}
    </span>
  );
}
