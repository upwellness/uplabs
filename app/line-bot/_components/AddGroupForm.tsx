"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { CustomerLite } from "./LineBotDashboard";

/** Today (Asia/Bangkok) as yyyy-mm-dd — default program start. */
function bangkokToday(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function AddGroupForm({
  customers, onCancel, onSaved,
}: {
  customers: CustomerLite[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [lineGroupId, setLineGroupId] = useState("");
  const [customerId, setCustomerId]   = useState("");
  const [startDate, setStartDate]     = useState(bangkokToday());
  const [pushEnabled, setPushEnabled] = useState(true);
  const [pushTime, setPushTime]       = useState("18:00");
  const [seed, setSeed]               = useState("1");
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const submit = async () => {
    if (!lineGroupId.trim()) { setError("กรุณาวางรหัสกลุ่ม (line_group_id)"); return; }
    if (!customerId) { setError("กรุณาเลือกลูกค้า"); return; }
    setSubmitting(true); setError(null);
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
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm md:items-center" onClick={onCancel}>
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-ink-10 px-7 py-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">New Group Mapping</div>
          <div className="mt-1 font-head text-xl font-extrabold tracking-tight text-ink">เพิ่มกลุ่ม LINE</div>
        </div>

        <div className="space-y-4 p-7">
          <label className="block">
            <Label>รหัสกลุ่ม (line_group_id) <span className="text-rose">*</span></Label>
            <input
              value={lineGroupId}
              onChange={(e) => setLineGroupId(e.target.value)}
              placeholder="Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 font-mono text-[13px] placeholder:text-ink-30 focus:border-wellness focus:outline-none"
            />
            <div className="mt-1 font-thai text-[11px] text-ink-40">วางรหัสที่บอทตอบในกลุ่ม (พิมพ์ “ผูกกลุ่ม”)</div>
          </label>

          <label className="block">
            <Label>ลูกค้า <span className="text-rose">*</span></Label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm focus:border-wellness focus:outline-none"
            >
              <option value="">— เลือกลูกค้า —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.height ? ` · ${c.height}cm` : ""}</option>
              ))}
            </select>
            {customers.length === 0 && (
              <div className="mt-1 font-thai text-[11px] text-status-danger">ยังไม่มีลูกค้า — สร้างที่เมนู “ลูกค้า” ก่อน</div>
            )}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <Label>วันเริ่มโปรแกรม</Label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm focus:border-wellness focus:outline-none"
              />
            </label>
            <label className="block">
              <Label>เวลาส่ง (push)</Label>
              <input
                type="time"
                value={pushTime}
                onChange={(e) => setPushTime(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm focus:border-wellness focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 items-end gap-3">
            <label className="block">
              <Label>Seed (ล็อกเมนูคงที่)</Label>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                min={0}
                className="mt-1.5 w-full rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm focus:border-wellness focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2.5 rounded-xl border border-ink-10 bg-surface px-4 py-2.5">
              <input
                type="checkbox"
                checked={pushEnabled}
                onChange={(e) => setPushEnabled(e.target.checked)}
                className="h-4 w-4 accent-wellness"
              />
              <span className="font-thai text-sm text-ink">ส่งเมนูพรุ่งนี้อัตโนมัติ</span>
            </label>
          </div>

          {error && <div className="rounded-xl border border-status-bg-danger bg-status-bg-danger px-4 py-3 text-sm text-status-danger">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-ink-10 bg-surface px-7 py-4">
          <Button variant="ghost" onClick={onCancel}>ยกเลิก</Button>
          <Button variant="wellness" onClick={submit} disabled={submitting}>{submitting ? "..." : "บันทึก"}</Button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">{children}</div>;
}
