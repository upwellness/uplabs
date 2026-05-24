"use client";

import { useEffect, useState } from "react";

interface Note {
  id:         string;
  body:       string;
  pinned:     boolean;
  created_at: string;
  updated_at: string;
}

export function NotesTab({ customerId }: { customerId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft]    = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch(`/api/customers/${customerId}/notes`)
      .then(r => r.json())
      .then(d => setNotes(d.notes ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [customerId]);

  const submit = async () => {
    if (!draft.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`/api/customers/${customerId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft, pinned: false }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "save failed");
      setDraft("");
      load();
    } catch (e: any) {
      setError(e.message ?? "ผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (noteId: string) => {
    if (!confirm("ต้องการลบบันทึกนี้ใช่ไหมคะ?")) return;
    await fetch(`/api/customers/${customerId}/notes?noteId=${noteId}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-4">
      {/* Composer */}
      <div className="liquid rounded-2xl p-4">
        <label htmlFor="coach-note-body" className="sr-only">
          เขียน coach note ใหม่
        </label>
        <textarea
          id="coach-note-body"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          placeholder="บันทึกสำหรับ session ต่อไป · นัดติดตาม · ข้อสังเกตของคนไข้ ..."
          rows={3}
          className="w-full bg-white/50 backdrop-blur-md border border-white/70 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-rose focus:bg-white/85 transition resize-y"
        />
        {error && (
          <div role="alert" aria-live="polite" className="mt-2 text-[12px] text-red-700 font-semibold">
            ⚠️ {error}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-[11px] text-ink-60">
            {draft.length > 0 ? `${draft.length} ตัวอักษร · กด ⌘+Enter ส่ง` : ""}
          </span>
          <button
            onClick={submit}
            disabled={submitting || !draft.trim()}
            aria-busy={submitting}
            className="rounded-full bg-ink px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-rose disabled:opacity-50 disabled:cursor-not-allowed transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            {submitting ? "กำลังบันทึก..." : "+ เพิ่มบันทึก"}
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="h-24 animate-pulse rounded-2xl liquid" />
      ) : notes.length === 0 ? (
        <div className="liquid rounded-2xl p-8 text-center border-dashed">
          <div className="text-2xl">📝</div>
          <p className="mt-2 font-thai text-[13px] text-ink-60">ยังไม่มีบันทึกของคนไข้คนนี้</p>
          <p className="mt-1 font-thai text-[11px] text-ink-60">เริ่มจดสิ่งที่อยากจำไว้ได้เลยค่ะ · ไม่ว่าจะเป็นข้อสังเกต อาการ หรือสิ่งที่นัดติดตาม</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notes.map(n => (
            <li key={n.id} className={`liquid liquid-shine rounded-xl p-4 ${n.pinned ? "border-2 border-amber-200" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {n.pinned && <span className="inline-block mr-2 text-amber-600">📌</span>}
                  <p className="font-thai text-[13px] text-ink whitespace-pre-wrap leading-relaxed">{n.body}</p>
                  <div className="mt-2 font-mono text-[10px] text-ink-40">
                    {new Date(n.created_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
                <button
                  onClick={() => remove(n.id)}
                  aria-label="ลบบันทึกนี้"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-40 hover:text-red-600 hover:bg-red-50 text-base flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                >🗑</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
