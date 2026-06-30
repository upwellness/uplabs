"use client";

/**
 * UP Labs v2 · Edit/Delete a LINE group mapping (clinical-warm)
 * Mirrors v1 GroupSettingsModal:
 *   PATCH  /api/line-bot/groups/[id]  → save edits
 *   DELETE /api/line-bot/groups/[id]  → unbind (danger zone)
 */

import { useState } from "react";
import { CalendarClock, Clock, Bell, Trash2 } from "lucide-react";
import type { CustomerLite, GroupRow } from "./types";
import { Modal, FieldLabel, inputCls, selectCls, ErrorNote, PrimaryBtn, GhostBtn } from "./ModalKit";

export function GroupSettingsModal({
  group, customers, onCancel, onSaved, onDeleted,
}: {
  group: GroupRow;
  customers: CustomerLite[];
  onCancel: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [customerId, setCustomerId] = useState(group.customer_id ?? "");
  const [startDate, setStartDate] = useState(group.program_start_date);
  const [pushEnabled, setPushEnabled] = useState(group.push_enabled);
  const [pushTime, setPushTime] = useState(group.push_time.slice(0, 5));
  const [seed, setSeed] = useState(String(group.seed));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!customerId) { setError("กรุณาเลือกลูกค้า"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/line-bot/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          program_start_date: startDate,
          push_enabled: pushEnabled,
          push_time: pushTime,
          seed: seed === "" ? 1 : Number(seed),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ");
      onSaved();
    } catch (e: any) {
      setError(e.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/line-bot/groups/${group.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ลบไม่สำเร็จ");
      onDeleted();
    } catch (e: any) {
      setError(e.message ?? "ลบไม่สำเร็จ");
      setDeleting(false);
    }
  };

  return (
    <Modal
      eyebrow="ตั้งค่ากลุ่ม"
      title="ตั้งค่ากลุ่ม LINE"
      subtitle={`id: ${group.line_group_id}`}
      onClose={onCancel}
      footer={
        <>
          <GhostBtn onClick={onCancel}>ยกเลิก</GhostBtn>
          <PrimaryBtn onClick={save} disabled={saving} busy={saving}>บันทึก</PrimaryBtn>
        </>
      }
    >
      <label className="block">
        <FieldLabel required>ลูกค้า</FieldLabel>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={selectCls}>
          <option value="">— เลือกลูกค้า —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.height ? ` · ${c.height} ซม.` : ""}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <FieldLabel>วันเริ่มโปรแกรม</FieldLabel>
          <div className="relative">
            <CalendarClock size={15} strokeWidth={2.25} className="pointer-events-none absolute left-3.5 top-[calc(50%+3px)] -translate-y-1/2 text-ink-30" aria-hidden />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${inputCls} pl-10`} />
          </div>
        </label>
        <label className="block">
          <FieldLabel>เวลาส่ง (push)</FieldLabel>
          <div className="relative">
            <Clock size={15} strokeWidth={2.25} className="pointer-events-none absolute left-3.5 top-[calc(50%+3px)] -translate-y-1/2 text-ink-30" aria-hidden />
            <input type="time" value={pushTime} onChange={(e) => setPushTime(e.target.value)} className={`${inputCls} pl-10`} />
          </div>
        </label>
      </div>

      <div className="grid grid-cols-2 items-end gap-3">
        <label className="block">
          <FieldLabel>Seed</FieldLabel>
          <input type="number" value={seed} min={0} onChange={(e) => setSeed(e.target.value)} className={inputCls} />
        </label>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-ink-10 bg-surface px-3.5 py-2.5">
          <input type="checkbox" checked={pushEnabled} onChange={(e) => setPushEnabled(e.target.checked)} className="h-4 w-4 accent-wellness" />
          <span className="inline-flex items-center gap-1.5 font-thai text-[13px] text-ink">
            <Bell size={14} strokeWidth={2.25} className="text-wellness" aria-hidden /> ส่งอัตโนมัติ
          </span>
        </label>
      </div>

      {error && <ErrorNote message={error} />}

      {/* Danger zone */}
      <div className="rounded-xl border border-status-danger/20 bg-status-bg-danger/40 px-3.5 py-3">
        {!confirmDel ? (
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-status-danger hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-status-danger focus-visible:ring-offset-2"
          >
            <Trash2 size={14} strokeWidth={2.25} aria-hidden /> ยกเลิกการผูกกลุ่มนี้
          </button>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-thai text-[12.5px] text-status-danger">ลบ mapping นี้? บอทจะหยุดส่งให้กลุ่มนี้</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDel(false)}
                className="inline-flex min-h-[40px] items-center rounded-lg border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60 hover:border-ink-20"
              >
                ไม่
              </button>
              <button
                type="button"
                onClick={del}
                disabled={deleting}
                className="inline-flex min-h-[40px] items-center rounded-lg bg-status-danger px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? "กำลังลบ…" : "ลบ"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
