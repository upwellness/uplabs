"use client";

import { useState } from "react";
import { unzipSync, strFromU8 } from "fflate";
import { parseAppleHealthXml, type AppleDaily } from "@/lib/pulse/apple-health";

interface Props {
  customerId: string;
  customerName: string;
}

export function AppleImport({ customerId, customerName }: Props) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true); setError(null); setResult(null); setProgress(0);
    try {
      // 1) get export.xml text (from .zip or .xml)
      setStage("กำลังอ่านไฟล์...");
      let xml: string;
      if (file.name.toLowerCase().endsWith(".zip")) {
        setStage("กำลังแตกไฟล์ zip...");
        const buf = new Uint8Array(await file.arrayBuffer());
        const files = unzipSync(buf, {
          filter: (f) => f.name.endsWith("export.xml") && !f.name.includes("cda"),
        });
        const key = Object.keys(files).find((k) => k.endsWith("export.xml"));
        if (!key) throw new Error("ไม่พบ export.xml ใน zip (ต้องเป็นไฟล์จาก Health app)");
        xml = strFromU8(files[key]);
      } else if (file.name.toLowerCase().endsWith(".xml")) {
        xml = await file.text();
      } else {
        throw new Error("ต้องเป็นไฟล์ .zip หรือ export.xml");
      }

      // 2) parse client-side (memory-safe)
      setStage("กำลังวิเคราะห์ข้อมูล (อาจใช้เวลาสักครู่)...");
      await new Promise((r) => setTimeout(r, 30)); // let UI paint
      const days: AppleDaily[] = parseAppleHealthXml(xml, (f) => setProgress(Math.round(f * 100)));
      if (days.length === 0) throw new Error("ไม่พบข้อมูลสุขภาพในไฟล์");

      // 3) POST compact summary
      setStage(`กำลังบันทึก ${days.length} วัน...`);
      const res = await fetch("/api/pulse/apple/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, days }),
      });
      const raw = await res.text();
      if (raw.trim().startsWith("<")) throw new Error(`Server error (HTTP ${res.status})`);
      const json = JSON.parse(raw);
      if (!res.ok) throw new Error(json.error ?? "import failed");

      const dr = json.date_range;
      setResult(`✓ นำเข้าสำเร็จ — ${json.days} วัน (${dr.start} → ${dr.end}) · ${json.metrics_written} ค่า`);
    } catch (e: any) {
      setError(e.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false); setStage(""); setProgress(0);
    }
  };

  return (
    <div className="rounded-2xl border border-ink-10 bg-white p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-head text-[15px] font-bold text-ink flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-[13px] text-white"></span>
            Apple Watch / Health
          </div>
          <div className="mt-0.5 font-thai text-[12px] text-ink-50">นำเข้าจากไฟล์ Export (ไม่ต้องลงแอป)</div>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-full border border-ink-10 bg-white px-3.5 py-2 text-[12px] font-bold text-ink-60 hover:border-ink-20 hover:text-ink transition-colors"
        >
          {open ? "ซ่อนวิธีทำ" : "📖 วิธีทำ"}
        </button>
      </div>

      {open && (
        <ol className="mt-3 rounded-xl bg-surface/60 border border-ink-10 p-4 space-y-1.5 font-thai text-[12.5px] text-ink-70 leading-relaxed list-decimal list-inside">
          <li>ในมือถือลูกค้า เปิดแอป <b>Health</b> (สุขภาพ)</li>
          <li>แตะรูปโปรไฟล์มุมขวาบน → เลื่อนลงสุด → <b>Export All Health Data</b> (ส่งออกข้อมูลสุขภาพทั้งหมด)</li>
          <li>รอสร้างไฟล์ → ได้ <b>export.zip</b> → ส่งไฟล์มา (AirDrop / อีเมล / LINE)</li>
          <li>เอาไฟล์ <b>export.zip</b> มาอัปโหลดที่นี่ (หรือแตก zip แล้วเอา <b>export.xml</b>)</li>
        </ol>
      )}

      {/* upload */}
      <label className={`mt-4 block ${busy ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
        <input type="file" accept=".zip,.xml" className="hidden" disabled={busy}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
        <div className="rounded-lg border border-dashed border-ink-15 bg-surface/50 px-4 py-5 text-center transition-colors hover:border-ink/40 hover:bg-ink-5/40">
          <div className="text-[13px] font-semibold text-ink">📁 เลือก export.zip หรือ export.xml</div>
          <div className="mt-1 font-thai text-[11px] text-ink-50">ไฟล์ถูกอ่านในเครื่องนี้ · ส่งเฉพาะสรุปรายวันขึ้นระบบ</div>
        </div>
      </label>

      {busy && (
        <div className="mt-3">
          <div className="font-thai text-[12px] text-ink-60">{stage}</div>
          {progress > 0 && (
            <div className="mt-1.5 h-1.5 rounded-full bg-ink-5 overflow-hidden">
              <div className="h-full bg-rose transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}
      {result && <div className="mt-3 rounded-lg bg-wellness-ultra px-3 py-2 font-thai text-[12px] text-wellness-deep">{result}</div>}
      {error && <div className="mt-3 rounded-lg bg-status-bg-danger/50 px-3 py-2 font-thai text-[12px] text-status-danger">⚠ {error}</div>}

      <div className="mt-3 rounded-lg bg-amber-ultra/50 px-3 py-2 font-thai text-[11px] text-ink-60 leading-relaxed">
        ℹ️ HRV ของ Apple วัดแบบ <b>SDNN</b> (ต่างจาก WHOOP ที่ใช้ RMSSD) · Apple ไม่มีค่า Recovery/Strain
      </div>
    </div>
  );
}
