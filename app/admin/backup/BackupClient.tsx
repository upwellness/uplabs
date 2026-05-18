"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { TableInfo } from "@/lib/backup/tables";

interface TablesResp {
  tables: TableInfo[];
  counts: Record<string, number | null>;
}

type Mode = "backup" | "restore";

const GROUP_LABEL: Record<TableInfo["group"], string> = {
  core:      "Core",
  bca:       "BCA",
  cgm:       "CGM",
  pulse:     "Pulse",
  leads:     "Leads",
  nutriscan: "NutriScan",
  auth:      "Auth",
};

const GROUP_ACCENT: Record<TableInfo["group"], string> = {
  core:      "border-rose/40 text-rose bg-rose-ultra",
  bca:       "border-science/40 text-science bg-science-ultra",
  cgm:       "border-wellness/40 text-wellness bg-wellness-ultra",
  pulse:     "border-amber/40 text-amber bg-amber-ultra",
  leads:     "border-rose/40 text-rose bg-rose-ultra",
  nutriscan: "border-wellness/40 text-wellness bg-wellness-ultra",
  auth:      "border-ink-20 text-ink-60 bg-ink-5",
};

export function BackupClient() {
  const [mode, setMode] = useState<Mode>("backup");
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeStructure, setIncludeStructure] = useState(true);
  const [includeAuthUsers, setIncludeAuthUsers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<{ filename: string; size: number; total: number } | null>(null);

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreParsed, setRestoreParsed] = useState<any | null>(null);
  const [restoreResult, setRestoreResult] = useState<any | null>(null);
  const [restoreMode, setRestoreMode] = useState<"preview" | "execute">("preview");
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/backup");
        if (!res.ok) throw new Error((await res.json()).error ?? "failed to load tables");
        const json: TablesResp = await res.json();
        setTables(json.tables);
        setCounts(json.counts);
        setSelected(new Set(json.tables.map((t) => t.name)));
      } catch (e: any) {
        setError(e.message);
      } finally { setLoading(false); }
    })();
  }, []);

  const grouped = useMemo(() => {
    const byGroup: Record<TableInfo["group"], TableInfo[]> = {
      core: [], bca: [], cgm: [], pulse: [], leads: [], nutriscan: [], auth: [],
    };
    for (const t of tables) byGroup[t.group].push(t);
    return byGroup;
  }, [tables]);

  const totalRows = useMemo(
    () => Array.from(selected).reduce((sum, name) => sum + (counts[name] ?? 0), 0),
    [selected, counts],
  );

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll  = () => setSelected(new Set(tables.map((t) => t.name)));
  const selectNone = () => setSelected(new Set());

  const runBackup = async () => {
    if (selected.size === 0) { setError("เลือกอย่างน้อย 1 table"); return; }
    setBusy(true); setError(null); setLastBackup(null);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tables: Array.from(selected),
          includeStructure,
          includeAuthUsers,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "backup failed");

      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m?.[1] ?? `upwellness-backup-${Date.now()}.json`;

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a);
      a.click(); a.remove();
      URL.revokeObjectURL(url);

      setLastBackup({ filename, size: blob.size, total: totalRows });
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const handleRestoreFile = async (file: File) => {
    setRestoreFile(file); setRestoreParsed(null); setRestoreResult(null); setError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || !parsed.tables) {
        throw new Error("ไฟล์ไม่ถูกต้อง · ต้องเป็น JSON ที่มี key 'tables'");
      }
      setRestoreParsed(parsed);
    } catch (e: any) { setError(`อ่านไฟล์ไม่ได้: ${e.message}`); }
  };

  const runRestore = async (execute: boolean) => {
    if (!restoreParsed) return;
    setBusy(true); setError(null); setRestoreResult(null);
    try {
      const res = await fetch(`/api/admin/restore?mode=${execute ? "execute" : "preview"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restoreParsed),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "restore failed");
      setRestoreResult(json);
      if (execute) setRestoreConfirmOpen(false);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-8">
      {/* Mode tabs */}
      <div className="flex items-center gap-1 mb-6 rounded-2xl border border-ink-10 bg-white p-1 w-fit">
        {([
          { v: "backup",  label: "📦 Backup",  desc: "Download" },
          { v: "restore", label: "♻️ Restore", desc: "Upload" },
        ] as const).map((t) => (
          <button
            key={t.v}
            onClick={() => setMode(t.v)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              mode === t.v ? "bg-ink text-white" : "text-ink-60 hover:bg-ink-5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-status-bg-danger bg-status-bg-danger px-4 py-3 text-sm text-status-danger">
          ⚠ {error}
        </div>
      )}

      {mode === "backup" ? (
        loading ? (
          <SkeletonGroups />
        ) : (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
            {/* Tables picker */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-40 font-bold">
                  เลือก tables ({selected.size}/{tables.length})
                </div>
                <div className="flex gap-2">
                  <button onClick={selectAll}  className="rounded-full border border-ink-10 bg-white px-3 py-1 text-[11px] font-semibold text-ink-60 hover:border-ink-20">ทั้งหมด</button>
                  <button onClick={selectNone} className="rounded-full border border-ink-10 bg-white px-3 py-1 text-[11px] font-semibold text-ink-60 hover:border-ink-20">ล้าง</button>
                </div>
              </div>

              {(["core", "bca", "cgm", "pulse", "leads", "nutriscan", "auth"] as const).map((g) =>
                grouped[g].length > 0 && (
                  <div key={g} className="rounded-3xl border border-ink-10 bg-white p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${GROUP_ACCENT[g]}`}>{GROUP_LABEL[g]}</span>
                      <span className="font-mono text-[10px] text-ink-40">{grouped[g].length} tables</span>
                    </div>
                    <div className="space-y-2">
                      {grouped[g].map((t) => {
                        const checked = selected.has(t.name);
                        const count = counts[t.name];
                        return (
                          <label key={t.name} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${checked ? "border-ink-20 bg-ink-5/40" : "border-ink-10 hover:border-ink-20"}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(t.name)}
                              className="mt-1 h-4 w-4 accent-rose"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="font-mono text-[13px] font-bold text-ink">{t.name}</span>
                                <span className="font-thai text-[12px] text-ink-60">— {t.label}</span>
                              </div>
                              <div className="mt-0.5 font-thai text-[12px] text-ink-50">{t.description}</div>
                            </div>
                            <span className="shrink-0 font-mono text-[11px] font-bold text-ink-60">
                              {count == null ? "—" : `${count.toLocaleString()} rows`}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Sidebar — options + action */}
            <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-3xl border border-ink-10 bg-white p-5">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-40 font-bold mb-3">Options</div>
                <label className="flex items-start gap-3 mb-3 cursor-pointer">
                  <input type="checkbox" checked={includeStructure} onChange={(e) => setIncludeStructure(e.target.checked)} className="mt-1 h-4 w-4 accent-rose" />
                  <div>
                    <div className="font-thai text-sm font-semibold text-ink">รวม structure</div>
                    <div className="mt-0.5 font-thai text-[11px] text-ink-50">เก็บชื่อ column ไว้ด้วย · เผื่อ restore ที่อื่น</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={includeAuthUsers} onChange={(e) => setIncludeAuthUsers(e.target.checked)} className="mt-1 h-4 w-4 accent-rose" />
                  <div>
                    <div className="font-thai text-sm font-semibold text-ink">รวม auth.users</div>
                    <div className="mt-0.5 font-thai text-[11px] text-ink-50">รายชื่อ user + email · admin API</div>
                  </div>
                </label>
              </div>

              <div className="rounded-3xl border border-ink-10 bg-gradient-to-br from-rose-ultra to-warm-white p-5">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-40 font-bold mb-3">Summary</div>
                <div className="space-y-2 mb-4">
                  <Row label="Tables" value={`${selected.size}`} />
                  <Row label="Total rows" value={totalRows.toLocaleString()} />
                  <Row label="Format" value="JSON" />
                </div>
                <Button variant="rose" onClick={runBackup} disabled={busy || selected.size === 0} className="w-full">
                  {busy ? "กำลัง backup..." : `⬇ Download backup`}
                </Button>
              </div>

              {lastBackup && (
                <div className="rounded-2xl border border-status-bg-optimal bg-status-bg-optimal/50 px-4 py-3 text-[12px] font-thai text-status-optimal">
                  ✓ บันทึก <b className="font-mono text-[11px]">{lastBackup.filename}</b> · {formatBytes(lastBackup.size)} · {lastBackup.total.toLocaleString()} rows
                </div>
              )}
            </div>
          </div>
        )
      ) : (
        // Restore mode
        <div className="space-y-5">
          <div className="rounded-3xl border border-amber/30 bg-amber-ultra p-5">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber font-bold mb-2">⚠ Warning</div>
            <p className="font-thai text-[13px] leading-relaxed text-ink-80">
              Restore = <b>upsert by id</b> · ถ้า row id ซ้ำกับใน DB จะถูก<b>เขียนทับ</b> · ถ้าไม่มีจะ insert ใหม่
              <br />
              <b>ไม่</b>ลบ row ที่อยู่ใน DB แต่ไม่อยู่ใน backup file (additive only)
              <br />
              แนะนำให้รัน <b>Preview</b> ก่อนเสมอ · ตรวจ count แล้วค่อย Execute
            </p>
          </div>

          <div className="rounded-3xl border border-ink-10 bg-white p-6">
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-40 font-bold">เลือกไฟล์ backup (.json)</span>
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRestoreFile(f); }}
                className="mt-2 block w-full text-sm text-ink-60 file:mr-4 file:rounded-full file:border-0 file:bg-rose file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-rose-deep cursor-pointer"
              />
            </label>

            {restoreFile && restoreParsed && (
              <div className="mt-5 space-y-2">
                <div className="rounded-xl border border-ink-10 bg-ink-5/40 px-4 py-3 font-mono text-[12px]">
                  <div><b className="text-ink">{restoreFile.name}</b> · {formatBytes(restoreFile.size)}</div>
                  {restoreParsed._meta && (
                    <div className="mt-1 text-ink-60">
                      backed up: {new Date(restoreParsed._meta.backed_up_at).toLocaleString("th-TH")} · {restoreParsed._meta.table_count} tables · {restoreParsed._meta.total_rows?.toLocaleString()} rows
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => runRestore(false)} disabled={busy}>
                    {busy && restoreMode === "preview" ? "..." : "🔍 Preview only"}
                  </Button>
                  <Button variant="rose" onClick={() => { setRestoreMode("execute"); setRestoreConfirmOpen(true); }} disabled={busy}>
                    ⚡ Execute restore
                  </Button>
                </div>
              </div>
            )}
          </div>

          {restoreResult && (
            <div className="rounded-3xl border border-ink-10 bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-40 font-bold">
                  {restoreResult.mode === "execute" ? "Executed" : "Preview"} · {restoreResult.summary.tables_processed} tables
                </div>
                <div className="font-mono text-[11px] text-ink-60">
                  {restoreResult.summary.total_rows_upserted.toLocaleString()} / {restoreResult.summary.total_rows_provided.toLocaleString()} rows
                  {restoreResult.summary.total_errors > 0 && <span className="ml-2 text-status-danger">· {restoreResult.summary.total_errors} errors</span>}
                </div>
              </div>
              <div className="space-y-1.5">
                {restoreResult.report.map((r: any) => (
                  <div key={r.table} className="flex items-center justify-between rounded-lg bg-ink-5/40 px-3 py-2 font-mono text-[12px]">
                    <span className="font-bold text-ink">{r.table}</span>
                    {r.skipped ? (
                      <span className="text-ink-40 text-[11px]">skipped · {r.reason}</span>
                    ) : r.errors?.length ? (
                      <span className="text-status-danger text-[11px]">{r.upserted}/{r.provided} · {r.errors.length} errors</span>
                    ) : (
                      <span className="text-status-optimal">{restoreResult.mode === "execute" ? `${r.upserted.toLocaleString()} upserted` : `${r.provided.toLocaleString()} ready`}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {restoreConfirmOpen && (
            <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={() => !busy && setRestoreConfirmOpen(false)}>
              <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="border-b border-ink-10 px-6 py-5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-status-danger font-bold">⚠ Execute Restore</div>
                  <div className="mt-1 font-head text-lg font-extrabold tracking-tight text-ink">เขียนข้อมูลทับ?</div>
                </div>
                <div className="space-y-3 px-6 py-5 font-thai text-sm text-ink-80">
                  <p>กำลังจะ upsert ข้อมูลทั้งหมดจาก backup file เข้าฐานข้อมูล production</p>
                  <ul className="ml-4 list-disc text-[13px] text-ink-60 space-y-0.5">
                    <li>Row ที่มี id เดิม → <b className="text-ink">เขียนทับ</b></li>
                    <li>Row ที่ id ไม่มี → insert ใหม่</li>
                    <li>Row ที่มีใน DB แต่ไม่อยู่ใน file → <b>ยังอยู่</b></li>
                  </ul>
                  <p className="text-status-danger text-[13px]">การกระทำนี้ไม่สามารถย้อนกลับได้ · กรุณา backup ก่อนเสมอ</p>
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-ink-10 bg-surface px-6 py-3">
                  <Button variant="ghost" size="sm" onClick={() => setRestoreConfirmOpen(false)} disabled={busy}>ยกเลิก</Button>
                  <button
                    onClick={() => runRestore(true)}
                    disabled={busy}
                    className="rounded-xl bg-status-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90"
                  >
                    {busy ? "กำลัง restore..." : "ยืนยัน · เขียนทับ"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="font-mono text-[11px] uppercase tracking-wide text-ink-40">{label}</span>
      <span className="font-head text-base font-extrabold text-ink">{value}</span>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function SkeletonGroups() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-3xl border border-ink-10 bg-white p-5">
          <div className="h-3 w-20 rounded bg-ink-5 animate-pulse" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="h-12 rounded-xl bg-ink-5 animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
