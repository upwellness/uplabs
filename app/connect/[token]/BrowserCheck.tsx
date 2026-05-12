"use client";

import { useEffect, useState } from "react";

/**
 * Detects in-app browsers (LINE, Facebook, Instagram, etc.) that Google blocks
 * for OAuth. Shows a friendly prompt to open in real browser.
 */
export function BrowserCheck({ url }: { url: string }) {
  const [inApp,   setInApp]   = useState(false);
  const [copied,  setCopied]  = useState(false);
  const [browser, setBrowser] = useState("");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("line/"))           { setInApp(true); setBrowser("LINE"); }
    else if (ua.includes("fban") || ua.includes("fbav") || ua.includes("instagram")) {
      setInApp(true); setBrowser("Facebook/Instagram");
    }
    else if (ua.includes("micromessenger")) { setInApp(true); setBrowser("WeChat"); }
    else if (/wv\)|; wv\)/.test(ua))    { setInApp(true); setBrowser("Webview"); }
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  if (!inApp) return null;

  return (
    <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
      <div className="font-head text-base font-bold text-amber-900">
        ⚠️ ต้องเปิดในเบราเซอร์ก่อน
      </div>
      <p className="mt-2 font-thai text-[13px] leading-[1.7] text-amber-900">
        ตอนนี้คุณกำลังเปิดผ่าน <strong>{browser}</strong> ซึ่ง Google ไม่อนุญาตให้ login ด้านในแอป —
        ต้องเปิด link นี้ใน <strong>Chrome / Safari / Samsung Internet</strong> ก่อนจึงจะเชื่อมต่อได้
      </p>

      <div className="mt-4 rounded-xl border border-amber-300 bg-white p-3">
        <div className="font-mono text-[11px] break-all text-amber-900">{url}</div>
      </div>

      <button
        onClick={handleCopy}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-700 px-5 py-3 font-head text-sm font-bold text-white shadow-md active:scale-[0.98]"
      >
        {copied ? "✓ คัดลอกแล้ว — paste ใน Chrome ได้เลย" : "📋 คัดลอก link"}
      </button>

      <div className="mt-4 space-y-1 font-thai text-[12px] text-amber-900">
        <div className="font-bold">วิธีเปิด:</div>
        <div><strong>iPhone (LINE):</strong> กดเมนู ⋯ มุมขวาบน → เลือก "Open in Safari"</div>
        <div><strong>Android (LINE):</strong> กดเมนู ⋯ มุมขวาบน → เลือก "Open in browser" / "Chrome"</div>
        <div><strong>ทางอื่น:</strong> คัดลอก link ด้านบน → เปิด Chrome/Safari → paste ที่ address bar</div>
      </div>
    </div>
  );
}
