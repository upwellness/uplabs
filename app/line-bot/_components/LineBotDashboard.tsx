"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { AddGroupForm } from "./AddGroupForm";
import { GroupSettingsModal } from "./GroupSettingsModal";

/* ── shared shapes (mirror the /api/line-bot/groups response) ── */
export interface CustomerLite {
  id: string;
  name: string;
  gender: string | null;
  height: number | null;
  coach_id: string | null;
}
export interface GroupRow {
  id: string;
  line_group_id: string;
  customer_id: string | null;
  program_start_date: string;
  push_enabled: boolean;
  push_time: string;
  seed: number;
  created_at: string;
}
export interface LogRow {
  id: string;
  group_id: string | null;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  sent_at: string;
}

/** Program day N (1-indexed) for today (Asia/Bangkok), mirrors lib/line/meal-plan.programDayFor. */
export function programDayFor(programStartDate: string): number {
  const shifted = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayISO = shifted.toISOString().slice(0, 10);
  const a = Date.UTC(+programStartDate.slice(0, 4), +programStartDate.slice(5, 7) - 1, +programStartDate.slice(8, 10));
  const b = Date.UTC(+todayISO.slice(0, 4), +todayISO.slice(5, 7) - 1, +todayISO.slice(8, 10));
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

function fmtTime(t: string): string {
  return /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : t;
}
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function LineBotDashboard() {
  const [groups, setGroups]       = useState<GroupRow[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [logs, setLogs]           = useState<LogRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [editGroup, setEditGroup] = useState<GroupRow | null>(null);
  const [busyId, setBusyId]       = useState<string | null>(null);
  const [showLogs, setShowLogs]   = useState(false);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/line-bot/groups");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "โหลดข้อมูลไม่สำเร็จ");
      setGroups(json.groups ?? []);
      setCustomers(json.customers ?? []);
      setLogs(json.logs ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const custById = useMemo(() => {
    const m = new Map<string, CustomerLite>();
    for (const c of customers) m.set(c.id, c);
    return m;
  }, [customers]);

  const togglePush = async (g: GroupRow) => {
    setBusyId(g.id);
    try {
      const res = await fetch(`/api/line-bot/groups/${g.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ push_enabled: !g.push_enabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "อัปเดตไม่สำเร็จ");
      setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, push_enabled: !g.push_enabled } : x)));
    } catch (e: any) { alert(e.message); }
    finally { setBusyId(null); }
  };

  const activePush = groups.filter((g) => g.push_enabled && g.customer_id).length;

  return (
    <div className="mt-6 space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="กลุ่มทั้งหมด" value={loading ? "…" : String(groups.length)} icon="💬" />
        <Stat label="เปิด push" value={loading ? "…" : String(activePush)} icon="🔔" accent="wellness" />
        <Stat label="ลูกค้าที่ผูกได้" value={loading ? "…" : String(customers.length)} icon="👥" accent="rose" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
          Group ↔ Customer mappings
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogs((v) => !v)}
            className="rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink"
          >
            {showLogs ? "ซ่อน log" : "📜 ดู log ล่าสุด"}
          </button>
          <Button variant="wellness" size="sm" onClick={() => setShowAdd(true)}>+ เพิ่มกลุ่ม</Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-status-bg-danger bg-status-bg-danger px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      {/* Group list */}
      <div className="overflow-hidden rounded-2xl border border-ink-10 bg-white">
        {loading ? (
          <div className="divide-y divide-ink-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-10 w-10 rounded-xl bg-ink-5 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded bg-ink-5 animate-pulse" />
                  <div className="h-2.5 w-28 rounded bg-ink-5 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState onAdd={() => setShowAdd(true)} />
        ) : (
          <div className="divide-y divide-ink-5">
            {groups.map((g) => {
              const cust = g.customer_id ? custById.get(g.customer_id) ?? null : null;
              const day = programDayFor(g.program_start_date);
              return (
                <div key={g.id} className="group flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-surface transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wellness-ultra text-base ring-1 ring-wellness-pale/60">
                    💬
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-thai text-[15px] font-bold text-ink truncate">
                        {cust ? cust.name : <span className="text-status-danger">— ยังไม่ผูกลูกค้า —</span>}
                      </span>
                      {!g.customer_id && (
                        <span className="rounded-full bg-status-bg-danger px-2 py-0.5 text-[9px] font-bold uppercase text-status-danger">unbound</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-ink-40">
                      <span className="truncate max-w-[220px]" title={g.line_group_id}>id: {g.line_group_id}</span>
                      <span className="text-ink-20">·</span>
                      <span>วันที่ {day} ของโปรแกรม</span>
                      <span className="text-ink-20">·</span>
                      <span>push {fmtTime(g.push_time)}</span>
                      <span className="text-ink-20">·</span>
                      <span>seed {g.seed}</span>
                    </div>
                  </div>

                  {/* Push toggle */}
                  <button
                    onClick={() => togglePush(g)}
                    disabled={busyId === g.id}
                    title="เปิด/ปิดการส่งเมนูพรุ่งนี้อัตโนมัติ"
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                      g.push_enabled ? "bg-wellness" : "bg-ink-10"
                    }`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${g.push_enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>

                  <div className="flex items-center gap-2">
                    {cust && (
                      <Link
                        href={`/line-bot/${cust.id}`}
                        className="rounded-lg border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-wellness hover:border-wellness hover:bg-wellness-ultra"
                      >
                        ⚙️ แผน/วิตามิน
                      </Link>
                    )}
                    <button
                      onClick={() => setEditGroup(g)}
                      className="rounded-lg border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink"
                    >
                      แก้ไข
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* How-to hint */}
      <div className="rounded-xl border border-wellness-pale bg-wellness-ultra/50 px-4 py-3 font-thai text-[12.5px] text-ink-80">
        <b className="text-wellness">วิธีได้รหัสกลุ่ม:</b> เชิญบอท “น้องจาน” เข้า LINE group ของลูกค้า → พิมพ์ <code className="rounded bg-white px-1 py-0.5 text-[11px]">ผูกกลุ่ม</code> ในกลุ่ม
        → บอทจะตอบรหัสกลุ่ม (ขึ้นต้นด้วย C…) → copy มาวางตอน “เพิ่มกลุ่ม” แล้วเลือกลูกค้า
      </div>

      {/* Logs (read-only) */}
      {showLogs && (
        <div className="overflow-hidden rounded-2xl border border-ink-10 bg-white">
          <div className="border-b border-ink-5 bg-surface/50 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 font-bold">
            Recent activity · {logs.length} รายการ
          </div>
          {logs.length === 0 ? (
            <div className="px-5 py-8 text-center font-thai text-[13px] text-ink-40">ยังไม่มี log</div>
          ) : (
            <div className="max-h-80 divide-y divide-ink-5 overflow-y-auto">
              {logs.map((l) => (
                <div key={l.id} className="flex items-center gap-3 px-5 py-2.5 font-mono text-[11px]">
                  <LogTypeBadge type={l.type} status={l.status} />
                  <span className="text-ink-40">{fmtDateTime(l.sent_at)}</span>
                  <span className="ml-auto truncate text-ink-30" title={JSON.stringify(l.payload)}>
                    {summarizePayload(l.payload)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <AddGroupForm
          customers={customers}
          onCancel={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
      {editGroup && (
        <GroupSettingsModal
          group={editGroup}
          customers={customers}
          onCancel={() => setEditGroup(null)}
          onSaved={() => { setEditGroup(null); load(); }}
          onDeleted={() => { setEditGroup(null); load(); }}
        />
      )}
    </div>
  );
}

/* ── small pieces ─────────────────────────────────────── */

function Stat({ label, value, icon, accent = "ink" }: { label: string; value: string; icon: string; accent?: "ink" | "wellness" | "rose" }) {
  const bg = accent === "wellness" ? "bg-wellness-ultra" : accent === "rose" ? "bg-rose-ultra" : "bg-ink-5";
  return (
    <div className="rounded-2xl border border-ink-10 bg-white p-4">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg} text-sm`}>{icon}</div>
      <div className="mt-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-40">{label}</div>
      <div className="mt-0.5 font-head text-[24px] font-extrabold leading-none text-ink">{value}</div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-wellness-ultra text-3xl ring-1 ring-wellness-pale/60">💬</div>
      <div className="mt-4 font-head text-[18px] font-extrabold text-ink">ยังไม่มีกลุ่มที่ผูก</div>
      <p className="mt-2 max-w-sm mx-auto font-thai text-[13px] text-ink-60">
        เชิญบอทเข้า LINE group ของลูกค้า · พิมพ์ “ผูกกลุ่ม” เพื่อรับรหัส · แล้วกดเพิ่มกลุ่มที่นี่
      </p>
      <div className="mt-5">
        <Button variant="wellness" size="sm" onClick={onAdd}>+ เพิ่มกลุ่มแรก</Button>
      </div>
    </div>
  );
}

function LogTypeBadge({ type, status }: { type: string; status: string }) {
  const ok = status === "ok";
  const color = !ok
    ? "bg-status-bg-danger text-status-danger"
    : type === "push"
    ? "bg-wellness-ultra text-wellness"
    : type === "error"
    ? "bg-status-bg-danger text-status-danger"
    : "bg-ink-5 text-ink-60";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${color}`}>{type}</span>;
}

function summarizePayload(p: Record<string, unknown>): string {
  if (!p || typeof p !== "object") return "";
  if (typeof p.which === "string") return String(p.which);
  if (typeof p.day === "number") return `day ${p.day}`;
  if (typeof p.groupId === "string") return String(p.groupId).slice(0, 18);
  if (typeof p.msg === "string") return String(p.msg).slice(0, 40);
  const keys = Object.keys(p);
  return keys.length ? keys.slice(0, 3).join(", ") : "";
}
