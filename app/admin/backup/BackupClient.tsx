"use client";

/**
 * Admin · Backup / Restore — whole database (PRD §5.10).
 *
 *   1. Snapshots in Storage — nightly automatic (03:00) + "take one now"; download / restore / delete
 *   2. Download now — build a snapshot of all (or chosen) tables straight to the browser
 *   3. Restore — from a stored snapshot or an uploaded file; always a dry run first;
 *      real run needs the confirmation word; replace mode clears the chosen tables
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatBytes, isForeignTable, type CatalogEntry, type RestorePlan } from "@/lib/backup/snapshot";

interface Stored { name: string; created_at: string; bytes: number }
interface Report { dry_run: boolean; mode: string; snapshot: { created_at: string; created_by: string; version: number; totals: { tables: number; rows: number } }; plan: RestorePlan; results: { table: string; cleared?: number; written: number; errors: string[] }[]; sequences_reset: number; ok: boolean }

const fmtDate = (s: string) => (s ? new Date(s).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "—");

export function BackupClient() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [totals, setTotals] = useState<{ tables: number; rows: number } | null>(null);
  const [snapshots, setSnapshots] = useState<Stored[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null);
  // restore
  const [source, setSource] = useState<{ kind: "stored"; name: string } | { kind: "file"; file: File } | null>(null);
  const [mode, setMode] = useState<"upsert" | "replace">("upsert");
  const [onlySelected, setOnlySelected] = useState(false);
  const [includeForeign, setIncludeForeign] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [report, setReport] = useState<Report | null>(null);

  const load = useCallback(async () => {
    setBusy("load");
    try {
      const [c, s] = await Promise.all([fetch("/api/admin/backup/catalog", { cache: "no-store" }).then((r) => r.json()), fetch("/api/admin/backup/snapshots", { cache: "no-store" }).then((r) => r.json())]);
      if (c.error) throw new Error(c.error);
      setCatalog(c.catalog ?? []); setOrder(c.order ?? []); setTotals(c.totals ?? null);
      setSnapshots(s.snapshots ?? []);
      if (s.error) setMsg({ tone: "err", text: `รายการ snapshot: ${s.error}` });
    } catch (e: any) { setMsg({ tone: "err", text: e.message ?? "โหลดไม่สำเร็จ" }); }
    finally { setBusy(null); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const ordered = useMemo(() => order.map((t) => catalog.find((c) => c.table_name === t)!).filter(Boolean), [order, catalog]);
  const toggle = (t: string) => setSelected((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; });

  const downloadNow = async () => {
    setBusy("download"); setMsg(null);
    try {
      const r = await fetch("/api/admin/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tables: selected.size ? [...selected] : null, includeAuthUsers: true, includeForeign }) });
      if (!r.ok) throw new Error((await r.json()).error ?? "backup failed");
      const blob = await r.blob(); const name = r.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "uplabs_snapshot.json";
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
      setMsg({ tone: "ok", text: `ดาวน์โหลดแล้ว ${name} (${formatBytes(blob.size)})` });
    } catch (e: any) { setMsg({ tone: "err", text: e.message }); } finally { setBusy(null); }
  };

  const snapshotNow = async () => {
    setBusy("snapshot"); setMsg(null);
    try {
      const r = await fetch("/api/admin/backup/snapshots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ includeForeign }) }); const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "snapshot failed");
      setMsg({ tone: "ok", text: `เก็บ snapshot แล้ว: ${j.stored.name} · ${j.totals.tables} ตาราง · ${j.totals.rows.toLocaleString()} แถว · ${formatBytes(j.stored.bytes)} (บีบอัด)` });
      await load();
    } catch (e: any) { setMsg({ tone: "err", text: e.message }); } finally { setBusy(null); }
  };

  const removeSnapshot = async (name: string) => {
    if (!window.confirm(`ลบ snapshot ${name}?`)) return;
    setBusy(name);
    try { const r = await fetch(`/api/admin/backup/snapshots/${encodeURIComponent(name)}`, { method: "DELETE" }); if (!r.ok) throw new Error((await r.json()).error); await load(); }
    catch (e: any) { setMsg({ tone: "err", text: e.message }); } finally { setBusy(null); }
  };

  const runRestore = async (dryRun: boolean) => {
    if (!source) return;
    setBusy(dryRun ? "dry" : "restore"); setMsg(null); if (dryRun) setReport(null);
    try {
      const only = onlySelected && selected.size ? [...selected] : null;
      let r: Response;
      if (source.kind === "file") {
        const fd = new FormData(); fd.append("file", source.file); fd.append("mode", mode); fd.append("dry_run", String(dryRun)); fd.append("confirm", confirm); if (only) fd.append("only", only.join(","));
        r = await fetch("/api/admin/restore", { method: "POST", body: fd });
      } else {
        r = await fetch("/api/admin/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshot_name: source.name, mode, only, dry_run: dryRun, confirm }) });
      }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "restore failed");
      setReport(j);
      if (!dryRun) { setMsg({ tone: j.ok ? "ok" : "err", text: j.ok ? `กู้คืนเสร็จ · ${j.plan.totals.tables} ตาราง · ${j.plan.totals.rows.toLocaleString()} แถว · sequences ${j.sequences_reset}` : "กู้คืนมีบางตารางล้มเหลว — ดูรายงานด้านล่าง" }); setConfirm(""); await load(); }
    } catch (e: any) { setMsg({ tone: "err", text: e.message }); } finally { setBusy(null); }
  };

  const word = mode === "replace" ? "REPLACE" : "RESTORE";
  const box = "rounded-3xl border border-ink-10 bg-white p-6";
  return (
    <div className="mt-6 space-y-6">
      {msg && <div className={`rounded-xl px-4 py-3 font-thai text-sm ${msg.tone === "ok" ? "bg-status-bg-optimal text-status-optimal" : msg.tone === "err" ? "bg-status-bg-danger text-status-danger" : "bg-surface text-ink"}`}>{msg.text}</div>}

      {/* 1 · stored snapshots */}
      <section className={box}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-head text-[16px] font-extrabold text-ink">Snapshot ในระบบ</h2>
            <p className="font-thai text-[12px] text-ink-60">อัตโนมัติทุกคืน 03:00 (เก็บ 14 ชุดล่าสุด · เฉพาะตาราง UP Labs) · ที่กดเก็บเองไม่ถูกลบอัตโนมัติ · ทั้งฐาน {totals ? `${totals.tables} ตาราง · ${totals.rows.toLocaleString()} แถว` : "…"}</p>
          </div>
          <Button variant="rose" size="sm" onClick={snapshotNow} disabled={!!busy}>{busy === "snapshot" ? "กำลังเก็บ…" : "📸 เก็บ snapshot ตอนนี้"}</Button>
        </div>
        <div className="mt-4 divide-y divide-ink-10 rounded-2xl border border-ink-10">
          {snapshots.length === 0 && <div className="p-4 font-thai text-[12px] text-ink-40">ยังไม่มี snapshot — กด "เก็บ snapshot ตอนนี้" หรือรอรอบ 03:00</div>}
          {snapshots.map((s) => (
            <div key={s.name} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[12px]">
              <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${s.name.startsWith("auto_") ? "bg-ink-5 text-ink-60" : "bg-rose-ultra text-rose"}`}>{s.name.startsWith("auto_") ? "auto" : "manual"}</span>
              <span className="font-mono text-ink">{s.name.replace(/\.json\.gz$/, "")}</span>
              <span className="text-ink-40">{formatBytes(s.bytes)}</span>
              <span className="ml-auto flex gap-2">
                <a href={`/api/admin/backup/snapshots/${encodeURIComponent(s.name)}`} className="underline text-ink-60 hover:text-ink">ดาวน์โหลด</a>
                <button type="button" className="underline text-ink-60 hover:text-ink" onClick={() => { setSource({ kind: "stored", name: s.name }); setReport(null); document.getElementById("restore")?.scrollIntoView({ behavior: "smooth" }); }}>กู้คืนจากชุดนี้</button>
                <button type="button" className="underline text-status-danger" disabled={busy === s.name} onClick={() => removeSnapshot(s.name)}>ลบ</button>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 2 · tables + download now */}
      <section className={box}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-head text-[16px] font-extrabold text-ink">ตารางทั้งหมด (จากฐานจริง)</h2>
            <p className="font-thai text-[12px] text-ink-60">เรียงตามลำดับที่กู้คืนได้ปลอดภัย (ตารางแม่ก่อน) · ไม่เลือก = ทุกตารางของ UP Labs · โครงสร้างตาราง (DDL) อยู่ใน <code>supabase/migrations/</code> ไม่ได้อยู่ในไฟล์นี้</p>
            <label className="mt-1 flex items-center gap-2 font-thai text-[12px] text-ink-60"><input type="checkbox" checked={includeForeign} onChange={(e) => setIncludeForeign(e.target.checked)} className="accent-rose" />รวมตารางของโปรเจกต์อื่นที่ปนอยู่ในฐาน (สีเทา · {catalog.filter((c) => isForeignTable(c.table_name)).length} ตาราง · driver_logs อย่างเดียว 45 MB)</label>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={!selected.size}>ล้างที่เลือก</Button>
            <Button variant="primary" size="sm" onClick={downloadNow} disabled={!!busy}>{busy === "download" ? "กำลังสร้าง…" : `⬇️ ดาวน์โหลด ${selected.size ? `${selected.size} ตาราง` : "ทั้งฐาน"}`}</Button>
          </div>
        </div>
        <div className="mt-4 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((c) => (
            <label key={c.table_name} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[12px] ${selected.has(c.table_name) ? "border-rose bg-rose-ultra" : isForeignTable(c.table_name) ? "border-ink-5 bg-ink-5 opacity-60" : "border-ink-10 hover:bg-ink-5"}`} title={isForeignTable(c.table_name) ? "ตารางของโปรเจกต์อื่น — ไม่อยู่ใน snapshot อัตโนมัติ" : undefined}>
              <input type="checkbox" checked={selected.has(c.table_name)} onChange={() => toggle(c.table_name)} className="h-3.5 w-3.5 accent-rose" />
              <span className={`font-mono ${isForeignTable(c.table_name) ? "text-ink-40" : "text-ink"}`}>{c.table_name}</span>
              <span className="ml-auto text-ink-40">{c.exact_rows == null ? "?" : c.exact_rows.toLocaleString()}</span>
              {c.pk_columns.length === 0 && <span className="text-[10px] text-status-caution" title="ไม่มี primary key — restore จะ insert อย่างเดียว">no PK</span>}
            </label>
          ))}
        </div>
      </section>

      {/* 3 · restore */}
      <section id="restore" className={box}>
        <h2 className="font-head text-[16px] font-extrabold text-ink">กู้คืน</h2>
        <p className="font-thai text-[12px] text-ink-60">ทดลอง (dry run) ก่อนเสมอ — ระบบบอกว่าจะเขียนตารางไหน กี่แถว ด้วย key อะไร · ตารางที่ไม่มีในฐานปัจจุบันจะข้าม (รัน migration ก่อน) · ผู้ใช้ auth ไม่ถูกกู้คืน (รหัสผ่านย้ายไม่ได้)</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-ink-10 p-3">
            <div className="font-thai text-[11px] font-semibold text-ink-60">แหล่ง</div>
            <div className="mt-1 font-thai text-[12px] text-ink">{source ? (source.kind === "stored" ? `snapshot: ${source.name}` : `ไฟล์: ${source.file.name} (${formatBytes(source.file.size)})`) : "ยังไม่เลือก — กด \"กู้คืนจากชุดนี้\" ด้านบน หรือเลือกไฟล์"}</div>
            <label className="mt-2 inline-block cursor-pointer rounded-lg border border-ink-10 px-3 py-1.5 font-thai text-[12px] text-ink"><input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSource({ kind: "file", file: f }); setReport(null); } }} />📂 เลือกไฟล์ snapshot (.json)</label>
          </div>
          <div className="rounded-2xl border border-ink-10 p-3 space-y-2">
            <div className="font-thai text-[11px] font-semibold text-ink-60">โหมด</div>
            <label className="flex items-start gap-2 font-thai text-[12px] text-ink"><input type="radio" name="mode" checked={mode === "upsert"} onChange={() => setMode("upsert")} className="mt-0.5 accent-rose" /><span><b>เพิ่ม/อัปเดต</b> — แถวที่มี key ตรงกันถูกทับ แถวใหม่ถูกเพิ่ม <span className="text-ink-40">ไม่ลบอะไร</span></span></label>
            <label className="flex items-start gap-2 font-thai text-[12px] text-ink"><input type="radio" name="mode" checked={mode === "replace"} onChange={() => setMode("replace")} className="mt-0.5 accent-rose" /><span><b className="text-status-danger">แทนที่ทั้งตาราง</b> — ล้างตารางที่เลือกก่อน แล้วใส่จาก snapshot <span className="text-ink-40">(ย้อนกลับไม่ได้ — เก็บ snapshot ตอนนี้ก่อนเสมอ)</span></span></label>
            <label className="flex items-center gap-2 font-thai text-[12px] text-ink"><input type="checkbox" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} className="accent-rose" />เฉพาะตารางที่ติ๊กไว้ด้านบน ({selected.size})</label>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => runRestore(true)} disabled={!source || !!busy}>{busy === "dry" ? "กำลังทดลอง…" : "🔍 ทดลองก่อน (ไม่เขียน)"}</Button>
          {report?.dry_run && (
            <>
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={`พิมพ์ ${word}`} className="w-40 rounded-lg border border-ink-10 px-3 py-1.5 font-mono text-[12px] focus:border-rose focus:outline-none" />
              <Button variant={mode === "replace" ? "rose" : "primary"} size="sm" onClick={() => runRestore(false)} disabled={confirm !== word || !!busy}>{busy === "restore" ? "กำลังกู้คืน…" : mode === "replace" ? "⚠️ แทนที่จริง" : "กู้คืนจริง"}</Button>
            </>
          )}
        </div>

        {report && (
          <div className="mt-4 rounded-2xl border border-ink-10 p-4">
            <div className="font-thai text-[12px] text-ink-60">{report.dry_run ? "ผลทดลอง" : "ผลกู้คืน"} · snapshot {fmtDate(report.snapshot.created_at)} โดย {report.snapshot.created_by} · v{report.snapshot.version} · {report.snapshot.totals.tables} ตาราง {report.snapshot.totals.rows.toLocaleString()} แถว</div>
            {report.plan.warnings.length > 0 && <ul className="mt-2 list-disc pl-5 font-thai text-[12px] text-status-caution">{report.plan.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
            <table className="mt-2 w-full text-[12px]">
              <thead><tr className="text-left text-ink-40"><th className="py-1">ตาราง</th><th>แถว</th><th>key</th><th>ทำอะไร</th><th>{report.dry_run ? "" : "ผล"}</th></tr></thead>
              <tbody>
                {report.plan.steps.map((s) => { const r = report.results.find((x) => x.table === s.table); return (
                  <tr key={s.table} className="border-t border-ink-10">
                    <td className="py-1 font-mono">{s.table}</td><td>{s.rows.toLocaleString()}</td><td className="font-mono text-ink-40">{s.pk.join(",") || "—"}</td>
                    <td className={s.action === "skip" ? "text-ink-40" : "text-ink"}>{s.action === "skip" ? `ข้าม — ${s.reason}` : s.action === "upsert" ? "upsert" : `insert ${s.reason ? `(${s.reason})` : ""}`}</td>
                    <td className={r?.errors.length ? "text-status-danger" : "text-status-optimal"}>{r ? `${r.cleared != null ? `ล้าง ${r.cleared} · ` : ""}เขียน ${r.written}${r.errors.length ? ` · ${r.errors[0]}` : ""}` : ""}</td>
                  </tr>); })}
              </tbody>
            </table>
            <div className="mt-2 font-thai text-[12px] text-ink-60">รวม {report.plan.totals.tables} ตาราง · {report.plan.totals.rows.toLocaleString()} แถว · ข้าม {report.plan.totals.skipped}{!report.dry_run && ` · reset sequences ${report.sequences_reset}`}</div>
          </div>
        )}
      </section>
    </div>
  );
}
