"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

/**
 * Copies the PUBLIC Longevity Report link (no-login share) to the clipboard so
 * the coach can send it straight to the customer. The link resolves a random
 * share token, never the customer UUID.
 */
export function ShareLabLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = `${window.location.origin}/r/lab/${token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("คัดลอกลิงก์นี้เพื่อส่งให้ลูกค้า:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="คัดลอกลิงก์รายงานสาธารณะ — ลูกค้าเปิดได้โดยไม่ต้องล็อกอิน"
      title="คัดลอกลิงก์สำหรับส่งให้ลูกค้า (เปิดได้ไม่ต้องล็อกอิน)"
      className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 border border-ink/10 px-3 py-1.5 text-[12px] font-semibold text-ink-60 hover:bg-ink/10 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2"
    >
      {copied
        ? <Check size={14} strokeWidth={2.5} className="text-wellness" aria-hidden="true" />
        : <Link2 size={14} strokeWidth={2.25} aria-hidden="true" />}
      {copied ? "คัดลอกแล้ว" : "ลิงก์ลูกค้า"}
    </button>
  );
}
