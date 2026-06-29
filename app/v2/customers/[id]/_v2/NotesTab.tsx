"use client";

/**
 * UP Labs v2 · Notes tab (Customer 360, SPEC §7.5)
 * ─────────────────────────────────────────────────
 * Full CRUD on coach_notes via the existing API (no contract change):
 *   GET    /api/customers/[id]/notes            → { notes } (pinned-first, newest-first)
 *   POST   /api/customers/[id]/notes  { body }  → add (⌘/Ctrl+Enter to submit)
 *   DELETE /api/customers/[id]/notes?noteId=…   → remove
 *
 * Optimistic UI on add + delete, then revalidate against the server. v1 has no
 * pin-toggle endpoint, so the pin is rendered as a badge only (parity with v1).
 * Clinical-warm · keyboard-accessible.
 */

import { useEffect, useRef, useState } from "react";
import { NotebookPen, Pin, Trash2, Send } from "lucide-react";
import { LoadingState, ErrorState, EmptyState } from "@/lib/v2/ui";

interface Note {
  id: string;
  body: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

export function NotesTab({ customerId }: { customerId: string }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = () => {
    setLoadError(null);
    setNotes(null);
    fetch(`/api/customers/${customerId}/notes`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setLoadError(d.error); else setNotes(d.notes ?? []); })
      .catch((e) => setLoadError(e.message ?? "load failed"));
  };
  useEffect(load, [customerId]);

  /** Keep pinned-first, newest-first ordering identical to the server. */
  const sortNotes = (list: Note[]) =>
    [...list].sort((a, b) =>
      a.pinned !== b.pinned
        ? (a.pinned ? -1 : 1)
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  const submit = async () => {
    const body = draft.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    setActionError(null);

    // Optimistic insert
    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic: Note = { id: tempId, body, pinned: false, created_at: now, updated_at: now };
    setNotes((prev) => sortNotes([optimistic, ...(prev ?? [])]));
    setDraft("");

    try {
      const r = await fetch(`/api/customers/${customerId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, pinned: false }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "บันทึกไม่สำเร็จ");
      // Swap temp row for the real one returned by the server
      setNotes((prev) => sortNotes((prev ?? []).map((n) => (n.id === tempId ? (d.note as Note) : n))));
    } catch (e: any) {
      // Roll back optimistic insert + restore draft
      setNotes((prev) => (prev ?? []).filter((n) => n.id !== tempId));
      setDraft(body);
      setActionError(e.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (noteId: string) => {
    if (!confirm("ต้องการลบบันทึกนี้ใช่ไหมคะ?")) return;
    setActionError(null);
    const prev = notes ?? [];
    // Optimistic removal
    setNotes(prev.filter((n) => n.id !== noteId));
    try {
      const r = await fetch(`/api/customers/${customerId}/notes?noteId=${noteId}`, { method: "DELETE" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? "ลบไม่สำเร็จ");
      }
    } catch (e: any) {
      setNotes(prev); // restore
      setActionError(e.message ?? "ลบไม่สำเร็จ");
    }
  };

  return (
    <div className="space-y-4">
      {/* Composer */}
      <div className="rounded-xl border border-ink-10 bg-white p-4">
        <label htmlFor="v2-coach-note" className="sr-only">เขียนบันทึกโค้ชใหม่</label>
        <textarea
          id="v2-coach-note"
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
          placeholder="บันทึกสำหรับ session ต่อไป · นัดติดตาม · ข้อสังเกตของลูกค้า …"
          rows={3}
          className="w-full resize-y rounded-xl border border-ink-10 bg-surface/50 px-3 py-2 text-[13px] text-ink transition-colors placeholder:text-ink-40 focus:border-rose focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
        />
        {actionError && (
          <div role="alert" aria-live="polite" className="mt-2 text-[12px] font-semibold text-status-danger">
            {actionError}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-ink-60">
            {draft.length > 0 ? `${draft.length} ตัวอักษร · กด ⌘/Ctrl + Enter เพื่อบันทึก` : "บันทึกจะเห็นเฉพาะทีมโค้ช"}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !draft.trim()}
            aria-busy={submitting}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={13} strokeWidth={2.25} aria-hidden /> {submitting ? "กำลังบันทึก…" : "เพิ่มบันทึก"}
          </button>
        </div>
      </div>

      {/* List */}
      {loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : !notes ? (
        <LoadingState label="กำลังโหลดบันทึก…" />
      ) : notes.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="ยังไม่มีบันทึกของลูกค้าคนนี้"
          hint="เริ่มจดสิ่งที่อยากจำได้เลย ไม่ว่าจะเป็นข้อสังเกต อาการ หรือสิ่งที่นัดติดตาม"
        />
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => {
            const isTemp = n.id.startsWith("temp-");
            return (
              <li
                key={n.id}
                className={`rounded-xl border bg-white p-4 ${n.pinned ? "border-amber/40 bg-amber-ultra/40" : "border-ink-10"} ${isTemp ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {n.pinned && (
                      <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-amber-ultra px-2 py-0.5 text-[10.5px] font-semibold text-amber">
                        <Pin size={10} strokeWidth={2.5} aria-hidden /> ปักหมุด
                      </span>
                    )}
                    <p className="whitespace-pre-wrap font-thai text-[13px] leading-relaxed text-ink">{n.body}</p>
                    <div className="mt-2 font-mono text-[10.5px] text-ink-60">
                      {isTemp ? "กำลังบันทึก…" : fmtDateTime(n.created_at)}
                    </div>
                  </div>
                  {!isTemp && (
                    <button
                      type="button"
                      onClick={() => remove(n.id)}
                      aria-label="ลบบันทึกนี้"
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-60 transition-colors hover:bg-status-bg-danger hover:text-status-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-status-danger focus-visible:ring-offset-2"
                    >
                      <Trash2 size={14} strokeWidth={2.25} aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
