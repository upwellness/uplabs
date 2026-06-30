"use client";

/**
 * UP Labs v2 · Add LINE group mapping (clinical-warm)
 * Mirrors v1 AddGroupForm — POST /api/line-bot/groups (same payload/contract).
 */

import { useState } from "react";
import { CalendarClock, Clock, Hash, Bell } from "lucide-react";
import type { CustomerLite } from "./types";
import { Modal, FieldLabel, inputCls, selectCls, ErrorNote, PrimaryBtn, GhostBtn } from "./ModalKit";

/** Today (Asia/Bangkok) as yyyy-mm-dd — default program start. */
function bangkokToday(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function AddGroupModal({
  customers, onCancel, onSaved,
}: {
  customers: CustomerLite[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [lineGroupId, setLineGroupId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [startDate, setStartDate] = useState(bangkokToday());
  const [pushEnabled, setPushEnabled] = useState(true);
  const [pushTime, setPushTime] = useState("18:00");
  const [seed, setSeed] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!lineGroupId.trim()) { setError("กรุณาวางรหัสกลุ่ม (line_group_id)"); return; }
    if (!customerId) { setError("กรุณาเลือกลูกค้า"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/line-bot/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          line_group_id: lineGroupId.trim(),
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
      setSubmitting(false);
    }
  };

  return (
    <Modal
      eyebrow="เพิ่มการผูกกลุ่ม"
      title="เพิ่มกลุ่ม LINE"
      onClose={onCancel}
      footer={
        <>
          <GhostBtn onClick={onCancel}>ยกเลิก</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={submitting} busy={submitting}>บันทึก</PrimaryBtn>
        </>
      }
    >
      <label className="block">
        <FieldLabel required>รหัสกลุ่ม (line_group_id)</FieldLabel>
        <div className="relative">
          <Hash size={15} strokeWidth={2.25} className="pointer-events-none absolute left-3.5 top-[calc(50%+3px)] -translate-y-1/2 text-ink-30" aria-hidden />
          <input
            value={lineGroupId}
            onChange={(e) => setLineGroupId(e.target.value)}
            placeholder="Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className={`${inputCls} pl-10 font-mono text-[13px]`}
          />
        </div>
        <div className="mt-1 font-thai text-[11.5px] text-ink-60">วางรหัสที่บอทตอบในกลุ่ม (พิมพ์ “ผูกกลุ่ม”)</div>
      </label>

      <label className="block">
        <FieldLabel required>ลูกค้า</FieldLabel>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={selectCls}>
          <option value="">— เลือกลูกค้า —</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.height ? ` · ${c.height} ซม.` : ""}</option>
          ))}
        </select>
        {customers.length === 0 && (
          <div className="mt-1 font-thai text-[11.5px] text-status-danger">ยังไม่มีลูกค้า — สร้างที่เมนู “ลูกค้า” ก่อน</div>
        )}
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
          <FieldLabel>Seed (ล็อกเมนูคงที่)</FieldLabel>
          <input type="number" value={seed} min={0} onChange={(e) => setSeed(e.target.value)} className={inputCls} />
        </label>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-ink-10 bg-surface px-3.5 py-2.5">
          <input type="checkbox" checked={pushEnabled} onChange={(e) => setPushEnabled(e.target.checked)} className="h-4 w-4 accent-wellness" />
          <span className="inline-flex items-center gap-1.5 font-thai text-[13px] text-ink">
            <Bell size={14} strokeWidth={2.25} className="text-wellness" aria-hidden /> ส่งเมนูพรุ่งนี้อัตโนมัติ
          </span>
        </label>
      </div>

      {error && <ErrorNote message={error} />}
    </Modal>
  );
}
