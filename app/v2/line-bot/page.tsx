"use client";

/**
 * UP Labs v2 · LINE Bot dashboard (น้องจาน · SPEC §7.10)
 * ──────────────────────────────────────────────────────
 * Mirrors v1 app/line-bot/page.tsx + LineBotDashboard, redesigned clinical-warm:
 * white cards · Lucide icons (not emoji) · status TEXT via statusTextClass ·
 * empty/loading/error states · keyboard-accessible · mobile cards.
 *
 * Reuses the SAME v1 API (no contract change):
 *   GET  /api/line-bot/groups            → { groups, customers, logs }
 *   POST /api/line-bot/groups            → create mapping (AddGroupModal)
 *   PATCH /api/line-bot/groups/[id]      → toggle push / edit (GroupSettingsModal)
 *   DELETE /api/line-bot/groups/[id]     → unbind (GroupSettingsModal)
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MessageCircle, Bell, Users, Plus, Settings2, ScrollText,
  CalendarClock, Hash, Clock, Sparkles, ListTree,
} from "lucide-react";
import { Shell } from "../_components/Shell";
import { Card, IconChip, LoadingState, EmptyState, ErrorState } from "@/lib/v2/ui";
import { statusTextClass } from "@/lib/v2/status";
import { AddGroupModal } from "./_v2/AddGroupModal";
import { GroupSettingsModal } from "./_v2/GroupSettingsModal";
import type { CustomerLite, GroupRow, LogRow } from "./_v2/types";

/** Program day N (1-indexed) for today (Asia/Bangkok) — mirrors lib/line/meal-plan.programDayFor. */
function programDayFor(programStartDate: string): number {
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

export default function V2LineBotPage() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/line-bot/groups");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "โหลดข้อมูลไม่สำเร็จ");
      setGroups(json.groups ?? []);
      setCustomers(json.customers ?? []);
      setLogs(json.logs ?? []);
    } catch (e: any) {
      setError(e.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
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
    } catch (e: any) {
      alert(e.message ?? "อัปเดตไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const activePush = groups.filter((g) => g.push_enabled && g.customer_id).length;
  const breadcrumb = [{ label: "หน้าแรก", href: "/v2" }, { label: "LINE Bot" }];

  return (
    <Shell breadcrumb={breadcrumb}>
      {/* Page header (SPEC §6: title + short description + primary action) */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <IconChip icon={MessageCircle} tone="wellness" size={18} className="h-9 w-9" />
            <div>
              <h1 className="font-head text-[23px] font-extrabold tracking-tight text-ink">LINE Bot · น้องจาน</h1>
              <p className="mt-0.5 font-thai text-[13px] text-ink-60">
                ผูก LINE group เข้ากับโปรไฟล์ลูกค้า · ตั้งเป้าหมาย/วิตามินต่อมื้อ · บอทส่งเมนูรายวันให้อัตโนมัติ
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLogs((v) => !v)}
            aria-pressed={showLogs}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink-60 transition-colors hover:border-ink-20 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            <ScrollText size={14} strokeWidth={2.25} aria-hidden /> {showLogs ? "ซ่อน log" : "ดู log ล่าสุด"}
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-wellness px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-wellness/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2"
          >
            <Plus size={15} strokeWidth={2.5} aria-hidden /> เพิ่มกลุ่ม
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="กลุ่มทั้งหมด" value={loading ? "…" : String(groups.length)} icon={MessageCircle} tone="ink" />
        <Stat label="เปิด push" value={loading ? "…" : String(activePush)} icon={Bell} tone="wellness" />
        <Stat label="ลูกค้าที่ผูกได้" value={loading ? "…" : String(customers.length)} icon={Users} tone="rose" />
      </div>

      {/* Group list */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-ink-5 px-4 py-3 lg:px-5">
          <ListTree size={14} strokeWidth={2.25} className="text-ink-40" aria-hidden />
          <span className="text-[12px] font-semibold text-ink-60">การผูกกลุ่ม ↔ ลูกค้า</span>
        </div>

        {loading ? (
          <LoadingState label="กำลังโหลดกลุ่ม LINE…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="ยังไม่มีกลุ่มที่ผูก"
            hint="เชิญบอท “น้องจาน” เข้า LINE group ของลูกค้า · พิมพ์ “ผูกกลุ่ม” เพื่อรับรหัส · แล้วกดเพิ่มกลุ่มที่นี่"
            action={
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-wellness px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-wellness/90"
              >
                <Plus size={14} strokeWidth={2.5} aria-hidden /> เพิ่มกลุ่มแรก
              </button>
            }
          />
        ) : (
          <ul className="divide-y divide-ink-5">
            {groups.map((g) => {
              const cust = g.customer_id ? custById.get(g.customer_id) ?? null : null;
              const day = programDayFor(g.program_start_date);
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface lg:px-5">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wellness-ultra text-wellness ring-1 ring-wellness-pale/60">
                    <MessageCircle size={18} strokeWidth={2} aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-head text-[15px] font-bold text-ink">
                        {cust ? cust.name : <span className={statusTextClass.danger}>ยังไม่ผูกลูกค้า</span>}
                      </span>
                      {!g.customer_id && (
                        <span className={`rounded-full bg-status-bg-danger px-2 py-0.5 text-[10px] font-bold ${statusTextClass.danger}`}>
                          ยังไม่ผูก
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-ink-60">
                      <span className="inline-flex max-w-[220px] items-center gap-1 truncate" title={g.line_group_id}>
                        <Hash size={11} strokeWidth={2.25} aria-hidden /> {g.line_group_id}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock size={11} strokeWidth={2.25} aria-hidden /> วันที่ {day} ของโปรแกรม
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} strokeWidth={2.25} aria-hidden /> push {fmtTime(g.push_time)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        seed {g.seed}
                      </span>
                    </div>
                  </div>

                  {/* Push toggle */}
                  <button
                    type="button"
                    onClick={() => togglePush(g)}
                    disabled={busyId === g.id}
                    role="switch"
                    aria-checked={g.push_enabled}
                    aria-label={`${g.push_enabled ? "ปิด" : "เปิด"}การส่งเมนูพรุ่งนี้อัตโนมัติ`}
                    title="เปิด/ปิดการส่งเมนูพรุ่งนี้อัตโนมัติ"
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2 disabled:opacity-50 ${
                      g.push_enabled ? "bg-wellness" : "bg-ink-10"
                    }`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${g.push_enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>

                  <div className="flex items-center gap-2">
                    {cust && (
                      <Link
                        href={`/v2/line-bot/${cust.id}`}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-wellness transition-colors hover:border-wellness hover:bg-wellness-ultra focus:outline-none focus-visible:ring-2 focus-visible:ring-wellness focus-visible:ring-offset-2"
                      >
                        <Settings2 size={13} strokeWidth={2.25} aria-hidden /> แผน/วิตามิน
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditGroup(g)}
                      aria-label={`แก้ไขกลุ่ม ${cust ? cust.name : g.line_group_id}`}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60 transition-colors hover:border-ink-20 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
                    >
                      <Settings2 size={13} strokeWidth={2.25} aria-hidden /> แก้ไข
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* How-to hint */}
      <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-wellness-pale bg-wellness-ultra/50 px-4 py-3 font-thai text-[12.5px] leading-[1.6] text-ink-80">
        <Sparkles size={16} strokeWidth={2.25} className="mt-0.5 shrink-0 text-wellness" aria-hidden />
        <span>
          <b className="text-wellness">วิธีได้รหัสกลุ่ม:</b> เชิญบอท “น้องจาน” เข้า LINE group ของลูกค้า → พิมพ์{" "}
          <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">ผูกกลุ่ม</code> ในกลุ่ม →
          บอทจะตอบรหัสกลุ่ม (ขึ้นต้นด้วย C…) → คัดลอกมาวางตอน “เพิ่มกลุ่ม” แล้วเลือกลูกค้า
        </span>
      </div>

      {/* Logs (read-only) */}
      {showLogs && (
        <Card className="mt-4 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-ink-5 bg-surface/50 px-4 py-3 lg:px-5">
            <ScrollText size={14} strokeWidth={2.25} className="text-ink-40" aria-hidden />
            <span className="text-[12px] font-semibold text-ink-60">กิจกรรมล่าสุด · {logs.length} รายการ</span>
          </div>
          {logs.length === 0 ? (
            <EmptyState icon={ScrollText} title="ยังไม่มี log" hint="เมื่อบอทส่งเมนูหรือมีคำสั่งในกลุ่ม จะแสดงที่นี่" />
          ) : (
            <ul className="max-h-80 divide-y divide-ink-5 overflow-y-auto">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 font-mono text-[11px] lg:px-5">
                  <LogTypeBadge type={l.type} status={l.status} />
                  <span className="text-ink-60">{fmtDateTime(l.sent_at)}</span>
                  <span className="ml-auto truncate text-ink-40" title={JSON.stringify(l.payload)}>
                    {summarizePayload(l.payload)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {showAdd && (
        <AddGroupModal
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
    </Shell>
  );
}

/* ── small pieces ─────────────────────────────────────── */

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: typeof Users; tone: "ink" | "wellness" | "rose" }) {
  return (
    <Card className="p-4">
      <IconChip icon={icon} tone={tone} size={16} className="h-8 w-8" />
      <div className="mt-2.5 text-[11px] font-semibold text-ink-60">{label}</div>
      <div className="mt-0.5 font-head text-[24px] font-extrabold leading-none text-ink">{value}</div>
    </Card>
  );
}

function LogTypeBadge({ type, status }: { type: string; status: string }) {
  const ok = status === "ok";
  const cls = !ok || type === "error"
    ? `bg-status-bg-danger ${statusTextClass.danger}`
    : type === "push"
      ? `bg-wellness-ultra ${statusTextClass.optimal}`
      : "bg-ink-5 text-ink-60";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${cls}`}>{type}</span>;
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
