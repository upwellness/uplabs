"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { CustomerLite, GroupRow } from "./LineBotDashboard";

export function GroupSettingsModal({
  group, customers, onCancel, onSaved, onDeleted,
}: {
  group: GroupRow;
  customers: CustomerLite[];
  onCancel: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [customerId, setCustomerId]   = useState(group.customer_id ?? "");
  const [startDate, setStartDate]     = useState(group.program_start_date);
  const [pushEnabled, setPushEnabled] = useState(group.push_enabled);
  const [pushTime, setPushTime]       = useState(group.push_time.slice(0, 5));
  const [seed, setSeed]               = useState(String(group.seed));
  const [saving, setSaving]           = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [confirmDel, setConfirmDel]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const save = async () => {
    if (!customerId) { setError("กรุณาเลือกลูกค้า"); return; }
    setSaving(true); setError(null);
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
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const del = async () => {
    setDeleting(true); setError(null);
    try {
      const res = await fetch(`/api/line-bot/groups/${group.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ลบไม่สำเร็จ");
      onDeleted();
    } catch (e: any) { setError(e.message); setDeleting(false); }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm md:items-center" onClick={onCancel}>
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-ink-10 px-7 py-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Group Settings</div>
          <div className="mt-1 font-head text-xl font-extrabold tracking-tight text-ink">ตั้งค่ากลุ่ม</div>
          <div className="mt-1 font-mono text-[11px] text-ink-40 truncate" title={group.line_group_id}>id: {group.line_group_id}</div>
        </div>

        <div className="space-y-4 p-7">
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
              <Label>Seed</Label>
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
              <span className="font-thai text-sm text-ink">ส่งอัตโนมัติ</span>
            </label>
          </div>

          {error && <div className="rounded-xl border border-status-bg-danger bg-status-bg-danger px-4 py-3 text-sm text-status-danger">{error}</div>}

          {/* Danger zone */}
          <div className="rounded-xl border border-status-danger/20 bg-status-bg-danger/30 px-4 py-3">
            {!confirmDel ? (
              <button onClick={() => setConfirmDel(true)} className="text-[12px] font-semibold text-status-danger hover:underline">
                🗑 ยกเลิกการผูกกลุ่มนี้
              </button>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="font-thai text-[12.5px] text-status-danger">ลบ mapping นี้? บอทจะหยุดส่งให้กลุ่มนี้</span>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDel(false)} className="rounded-lg border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60">ไม่</button>
                  <button onClick={del} disabled={deleting} className="rounded-lg bg-status-danger px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50">
                    {deleting ? "กำลังลบ..." : "ลบ"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-ink-10 bg-surface px-7 py-4">
          <Button variant="ghost" onClick={onCancel}>ยกเลิก</Button>
          <Button variant="wellness" onClick={save} disabled={saving}>{saving ? "..." : "บันทึก"}</Button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">{children}</div>;
}
