"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Inbox, AlertTriangle, Check, X, FileText, ExternalLink, ChevronDown, ChevronRight, Bot,
} from "lucide-react";
import { approveSubmission, rejectSubmission, type PendingRow } from "../actions";

type Status = "normal" | "low" | "high" | "borderline";
const STATUS_LABEL: Record<Status, string> = {
  normal: "ปกติ", low: "ต่ำ", high: "สูง", borderline: "ก้ำกึ่ง",
};
const STATUS_CLASS: Record<Status, string> = {
  normal: "bg-wellness-ultra text-wellness",
  low: "bg-science-pale text-science",
  high: "bg-rose-pale text-rose",
  borderline: "bg-amber-pale text-amber",
};

/**
 * The review step between "an AI read a lab slip" and "this is in someone's history".
 *
 * The screen is built around comparison, not data entry: the values sit next to what
 * the submitter actually read off the page, every field is editable in place, and the
 * warnings the normaliser raised are pushed to the top. Approving writes what is on
 * screen — so a correction made here is the value that gets stored.
 */
export function InboxClient({ rows }: { rows: PendingRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-10 bg-white p-10 text-center">
        <Inbox className="mx-auto h-8 w-8 text-ink-20" aria-hidden />
        <p className="mt-3 font-head text-[15px] font-semibold text-ink">ไม่มีรายการรอตรวจ</p>
        <p className="mt-1 text-[13px] text-ink-60">
          ผลแล็บที่ส่งเข้ามาผ่าน API จะมารออยู่ที่นี่ ให้ตรวจเทียบกับใบจริงก่อนบันทึกเข้าโปรไฟล์
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {rows.map((r) => <SubmissionCard key={r.id} row={r} />)}
    </div>
  );
}

function SubmissionCard({ row }: { row: PendingRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(row.warning_count > 0); // anything flagged opens itself
  const [values, setValues] = useState(row.values);
  const [recordedAt, setRecordedAt] = useState(row.recorded_at ?? "");
  const [source, setSource] = useState(row.source ?? "");
  const [showRaw, setShowRaw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const warnings = values.flatMap((v) => v.warnings ?? []);

  function patch(i: number, field: string, val: any) {
    setValues((cur) => cur.map((v, idx) => (idx === i ? { ...v, [field]: val } : v)));
  }
  function drop(i: number) {
    setValues((cur) => cur.filter((_, idx) => idx !== i));
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-ink-10 bg-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-ink-10 bg-surface px-4 py-3">
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className="flex min-h-11 flex-1 items-center gap-2 text-left">
          {open ? <ChevronDown size={16} className="text-ink-40" aria-hidden /> : <ChevronRight size={16} className="text-ink-40" aria-hidden />}
          <span>
            <Link href={`/v2/customers/${row.customer_id}`}
              className="font-head text-[15px] font-bold text-ink hover:text-rose"
              onClick={(e) => e.stopPropagation()}>
              {row.customer_name}
            </Link>
            <span className="ml-2 text-[13px] text-ink-60">{row.summary}</span>
          </span>
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-5 px-2.5 py-1 text-[11px] text-ink-60">
          <Bot size={12} aria-hidden /> {row.submitted_via || row.token_name || "API"}
        </span>
        {row.warning_count > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-pale px-2.5 py-1 text-[11px] font-semibold text-amber">
            <AlertTriangle size={12} aria-hidden /> ต้องดู {row.warning_count}
          </span>
        )}
      </header>

      {open && (
        <div className="p-4">
          <div className="rounded-xl bg-amber-ultra px-3 py-2.5 text-[13px] text-amber">
            <b>ค่าเหล่านี้ยังไม่ได้อยู่ในประวัติลูกค้า</b> — AI อ่านมาจากเอกสาร ให้เทียบกับใบจริงก่อนกดยืนยัน ·
            แก้ตรงช่องได้เลย ระบบจะบันทึกตามที่แก้
          </div>

          {warnings.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-xl border border-amber/30 bg-amber-ultra px-4 py-3 text-[13px] text-amber" style={{ listStyle: "disc" }}>
              {warnings.map((w, i) => <li key={i} className="ml-4">{w}</li>)}
            </ul>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[13px] font-medium text-ink-80">วันที่เจาะเลือด <span className="font-normal text-ink-40">(ค.ศ.)</span></span>
              <input type="date" value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-ink-10 px-3 text-sm" />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-ink-80">แหล่งตรวจ</span>
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="ชื่อโรงพยาบาล/แล็บ"
                className="mt-1 min-h-11 w-full rounded-xl border border-ink-10 px-3 text-sm" />
            </label>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-ink-10">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="bg-surface text-[11.5px] text-ink-60">
                <tr>
                  <th className="p-2 text-left font-semibold">ค่า</th>
                  <th className="p-2 text-left font-semibold">ผล</th>
                  <th className="p-2 text-left font-semibold">หน่วย</th>
                  <th className="p-2 text-left font-semibold">ช่วงอ้างอิง</th>
                  <th className="p-2 text-left font-semibold">สถานะ</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {values.map((v, i) => (
                  <tr key={i} className={`border-t border-ink-10 ${v.warnings?.length ? "bg-amber-ultra" : ""}`}>
                    <td className="p-2">
                      <div className="font-mono text-[12px] text-ink">{v.metric_key}</div>
                      {v.metric_label_th && <div className="text-[11.5px] text-ink-40">{v.metric_label_th}</div>}
                    </td>
                    <td className="p-2">
                      <input value={v.value} onChange={(e) => patch(i, "value", e.target.value)}
                        className="min-h-9 w-24 rounded-lg border border-ink-10 px-2 font-mono text-[12.5px]" />
                    </td>
                    <td className="p-2">
                      <input value={v.unit ?? ""} onChange={(e) => patch(i, "unit", e.target.value || null)}
                        className="min-h-9 w-20 rounded-lg border border-ink-10 px-2 text-[12.5px]" />
                    </td>
                    <td className="p-2">
                      <input value={v.ref_text ?? ""} onChange={(e) => patch(i, "ref_text", e.target.value || null)}
                        className="min-h-9 w-28 rounded-lg border border-ink-10 px-2 text-[12.5px]" />
                    </td>
                    <td className="p-2">
                      <select value={v.status} onChange={(e) => patch(i, "status", e.target.value)}
                        className={`min-h-9 rounded-lg border-0 px-2 text-[12px] font-semibold ${STATUS_CLASS[v.status as Status]}`}>
                        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 text-right">
                      <button onClick={() => drop(i)} aria-label={`ลบ ${v.metric_key}`}
                        className="rounded-lg p-1.5 text-ink-40 hover:bg-rose-pale hover:text-rose">
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(row.raw_text || row.source_file_url) && (
            <div className="mt-3">
              <button onClick={() => setShowRaw((v) => !v)}
                className="inline-flex min-h-9 items-center gap-1.5 text-[12.5px] font-semibold text-science hover:underline">
                <FileText size={13} aria-hidden /> {showRaw ? "ซ่อน" : "ดู"}ข้อความที่ AI อ่านได้จากเอกสาร
              </button>
              {row.source_file_url && (
                <a href={row.source_file_url} target="_blank" rel="noopener"
                  className="ml-3 inline-flex min-h-9 items-center gap-1.5 text-[12.5px] font-semibold text-rose hover:underline">
                  <ExternalLink size={13} aria-hidden /> เปิดไฟล์ต้นฉบับ
                </a>
              )}
              {showRaw && row.raw_text && (
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-ink-10 bg-surface p-3 text-[12px] text-ink-80">
                  {row.raw_text}
                </pre>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-pale px-3 py-2 text-sm text-rose-deep">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              disabled={pending || values.length === 0 || !recordedAt}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await approveSubmission(row.id, values, { recorded_at: recordedAt, source });
                  if (res.ok) router.refresh(); else setError(res.error);
                });
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-wellness px-5 text-sm font-semibold text-white transition-colors hover:bg-wellness-deep disabled:opacity-50"
            >
              <Check size={16} aria-hidden /> {pending ? "กำลังบันทึก…" : `ยืนยันและบันทึก ${values.length} ค่า`}
            </button>
            <button
              disabled={pending}
              onClick={() => {
                const note = prompt("ไม่รับรายการนี้เพราะอะไร? (ไม่บังคับ)") ?? "";
                setError(null);
                startTransition(async () => {
                  const res = await rejectSubmission(row.id, note);
                  if (res.ok) router.refresh(); else setError(res.error ?? "ทำรายการไม่สำเร็จ");
                });
              }}
              className="min-h-11 rounded-xl border border-ink-10 bg-white px-4 text-sm text-ink-60 disabled:opacity-50"
            >
              ไม่รับ
            </button>
            <Link href={`/v2/customers/${row.customer_id}`}
              className="ml-auto inline-flex min-h-11 items-center gap-1.5 text-[12.5px] font-semibold text-ink-60 hover:text-rose">
              เปิดโปรไฟล์ <ExternalLink size={13} aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
