"use client";

import { useState } from "react";

interface Props {
  customerId: string;
  customerName: string;
  initialDayCount: number;
  initialRange: { start: string; end: string } | null;
}

type FileKey = "cycles" | "sleeps" | "workouts" | "journal";

const FILE_LABELS: Record<FileKey, string> = {
  cycles:   "physiological_cycles.csv",
  sleeps:   "sleeps.csv",
  workouts: "workouts.csv",
  journal:  "journal_entries.csv",
};

export function WhoopImport({ customerId, customerName, initialDayCount, initialRange }: Props) {
  const [files, setFiles] = useState<Partial<Record<FileKey, string>>>({});
  const [fileNames, setFileNames] = useState<Partial<Record<FileKey, string>>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dayCount, setDayCount] = useState(initialDayCount);
  const [range, setRange] = useState(initialRange);
  const [connecting, setConnecting] = useState(false);

  // Detect which file slot a CSV belongs to from its header
  const detectKind = (text: string): FileKey | null => {
    const h = (text.split(/\r?\n/)[0] ?? "").toLowerCase();
    if (h.includes("question text")) return "journal";
    if (h.includes("workout start")) return "workouts";
    if (h.includes("nap")) return "sleeps";
    if (h.includes("recovery score") || h.includes("day strain")) return "cycles";
    return null;
  };

  const onFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    setError(null); setResult(null);
    const next = { ...files };
    const nextNames = { ...fileNames };
    for (const f of Array.from(fileList)) {
      const text = await f.text();
      const kind = detectKind(text) ??
        (f.name.includes("physiological") ? "cycles" :
         f.name.includes("sleep") ? "sleeps" :
         f.name.includes("workout") ? "workouts" :
         f.name.includes("journal") ? "journal" : null);
      if (kind) { next[kind] = text; nextNames[kind] = f.name; }
      else setError(`ไม่รู้จักไฟล์: ${f.name} (ต้องเป็น WHOOP export CSV)`);
    }
    setFiles(next);
    setFileNames(nextNames);
  };

  const doImport = async () => {
    if (Object.keys(files).length === 0) { setError("ยังไม่ได้เลือกไฟล์"); return; }
    setImporting(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/pulse/whoop/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, files }),
      });
      const raw = await res.text();
      if (raw.trim().startsWith("<")) throw new Error(`Server error (HTTP ${res.status})`);
      const json = JSON.parse(raw);
      if (!res.ok) throw new Error(json.error ?? "import failed");
      const imp = json.imported ?? {};
      const parts = Object.entries(imp).map(([k, v]) => `${k}: ${v}`).join(" · ");
      setResult(`✓ นำเข้าสำเร็จ — ${parts}`);
      if (json.date_range) { setRange(json.date_range); }
      if (imp.daily) setDayCount(imp.daily);
      setFiles({}); setFileNames({});
    } catch (e: any) {
      setError(e.message ?? "import error");
    } finally {
      setImporting(false);
    }
  };

  const connectOAuth = async () => {
    setConnecting(true); setError(null);
    try {
      const res = await fetch("/api/pulse/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, provider: "whoop" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "invite failed");
      // Open the consent link (customer would normally receive this via LINE)
      window.open(json.url, "_blank");
      setResult(`สร้างลิงก์เชื่อม WHOOP แล้ว — ส่งให้ ${customerName} เปิดเพื่อยินยอม (เปิดในแท็บใหม่แล้ว)`);
    } catch (e: any) {
      setError(e.message ?? "connect error");
    } finally {
      setConnecting(false);
    }
  };

  const selectedCount = Object.keys(files).length;

  return (
    <div className="rounded-2xl border border-ink-10 bg-white p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="font-head text-[15px] font-bold text-ink flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-[12px] font-bold text-white">W</span>
            WHOOP
          </div>
          <div className="mt-0.5 font-thai text-[12px] text-ink-50">
            {dayCount > 0
              ? `มีข้อมูลแล้ว ${dayCount} วัน${range ? ` (${range.start} → ${range.end})` : ""}`
              : "ยังไม่มีข้อมูล WHOOP"}
          </div>
        </div>
        <button
          onClick={connectOAuth}
          disabled={connecting}
          className="rounded-full border border-ink-10 bg-white px-3.5 py-2 text-[12px] font-bold text-ink-60 hover:border-ink-20 hover:text-ink transition-colors disabled:opacity-50"
          title="สร้างลิงก์ OAuth ให้ลูกค้ายินยอม (sync อัตโนมัติ)"
        >
          {connecting ? "..." : "🔗 เชื่อมผ่าน OAuth"}
        </button>
      </div>

      {/* CSV import */}
      <div className="rounded-xl border border-dashed border-ink-15 bg-surface/50 p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-40 font-bold mb-2">
          นำเข้าจากไฟล์ CSV (WHOOP export)
        </div>
        <p className="font-thai text-[11.5px] text-ink-50 mb-3 leading-relaxed">
          ในแอป WHOOP → More → App Settings → Data Export → ได้ไฟล์ zip · แตกไฟล์แล้วลากทั้ง 4 ไฟล์มาที่นี่
        </p>

        <label className="block cursor-pointer">
          <input
            type="file" accept=".csv" multiple className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <div className="rounded-lg border border-ink-10 bg-white px-4 py-3 text-center text-[12px] font-semibold text-rose hover:border-rose/40 hover:bg-rose-ultra/30 transition-colors">
            📁 เลือกไฟล์ CSV (เลือกได้หลายไฟล์)
          </div>
        </label>

        {/* Selected file chips */}
        {selectedCount > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(Object.keys(FILE_LABELS) as FileKey[]).map((k) => (
              <span
                key={k}
                className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold ${
                  files[k] ? "bg-wellness-ultra text-wellness" : "bg-ink-5 text-ink-30"
                }`}
                title={FILE_LABELS[k]}
              >
                {files[k] ? "✓ " : "○ "}{k}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={doImport}
          disabled={importing || selectedCount === 0}
          className="mt-3 w-full rounded-full bg-rose px-4 py-2.5 text-[13px] font-bold text-white hover:bg-rose-deep transition-colors disabled:opacity-40"
        >
          {importing ? "กำลังนำเข้า..." : `นำเข้า ${selectedCount > 0 ? `(${selectedCount} ไฟล์)` : ""}`}
        </button>
      </div>

      {result && (
        <div className="mt-3 rounded-lg bg-wellness-ultra px-3 py-2 font-thai text-[12px] text-wellness-deep">{result}</div>
      )}
      {error && (
        <div className="mt-3 rounded-lg bg-status-bg-danger/50 px-3 py-2 font-thai text-[12px] text-status-danger">⚠ {error}</div>
      )}
    </div>
  );
}
