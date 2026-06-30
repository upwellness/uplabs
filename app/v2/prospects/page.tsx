"use client";

/**
 * UP Labs v2 · Prospects — name list → CheckForm pipeline (SPEC §7.8)
 * ──────────────────────────────────────────────────────────────────
 * Clinical-warm prospect list. Quick-add + bulk paste, tier A/B/C, a status
 * pipeline, and 1-click convert → CheckForm (POST /api/prospects/[id]/convert →
 * redirect to /v2/checkform?load=<record_id>). Reuses every v1 prospects API
 * unchanged. Mobile: rows shed to a stacked layout, no horizontal overflow.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, ClipboardPaste, Search, ChevronDown, Trash2, ArrowRight, Loader2,
  X, Users, RotateCw,
} from "lucide-react";
import { Shell } from "../_components/Shell";
import { Card, LoadingState, EmptyState, ErrorState } from "@/lib/v2/ui";
import { statusTextClass, type StatusLevel } from "@/lib/v2/status";

type Tier = "A" | "B" | "C";
type Status =
  | "lead" | "messaged" | "replied" | "scheduled"
  | "analyzed" | "closed" | "not_interested" | "dropped";

interface Prospect {
  id: string;
  coach_id: string;
  name: string;
  tier: Tier;
  context: string | null;
  source: string | null;
  status: Status;
  notes: string | null;
  converted_record_id: string | null;
  contacted_at: string | null;
  replied_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Tier → status token + warmth label (one status system). */
const TIER_META: Record<Tier, { level: StatusLevel; label: string }> = {
  A: { level: "optimal", label: "คุยง่ายมาก" },
  B: { level: "caution", label: "ต้องเปิดบทใหม่" },
  C: { level: "warning", label: "ห่างหาย / cold" },
};

const STATUS_META: Record<Status, { label: string; level: StatusLevel | "neutral" }> = {
  lead:           { label: "ยังไม่ติดต่อ", level: "neutral" },
  messaged:       { label: "ส่งแล้ว", level: "caution" },
  replied:        { label: "ตอบแล้ว", level: "good" },
  scheduled:      { label: "นัดแล้ว", level: "good" },
  analyzed:       { label: "วิเคราะห์แล้ว", level: "good" },
  closed:         { label: "ปิดได้", level: "optimal" },
  not_interested: { label: "ไม่สนใจ", level: "neutral" },
  dropped:        { label: "หายไป", level: "neutral" },
};

const STATUS_ORDER: Status[] = ["lead", "messaged", "replied", "scheduled", "analyzed", "closed", "not_interested", "dropped"];

function statusBgClass(lv: StatusLevel): string {
  return {
    optimal: "bg-status-bg-optimal", good: "bg-status-bg-good", caution: "bg-status-bg-caution",
    warning: "bg-status-bg-warning", danger: "bg-status-bg-danger",
  }[lv];
}

export default function V2ProspectsPage() {
  const router = useRouter();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick add
  const [quickName, setQuickName] = useState("");
  const [quickTier, setQuickTier] = useState<Tier>("B");
  const [adding, setAdding] = useState(false);
  const quickRef = useRef<HTMLInputElement>(null);

  // Bulk
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkTier, setBulkTier] = useState<Tier>("B");

  // Filters
  const [filterTier, setFilterTier] = useState<Tier | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<Status | "ALL" | "ACTIVE">("ACTIVE");
  const [search, setSearch] = useState("");

  const [converting, setConverting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/prospects");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "โหลดรายชื่อไม่สำเร็จ");
      setProspects(json.prospects ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const addOne = async () => {
    if (!quickName.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: quickName.trim(), tier: quickTier }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "เพิ่มไม่สำเร็จ");
      setProspects((p) => [json.prospect, ...p]);
      setQuickName("");
      quickRef.current?.focus();
    } catch (e: any) { alert(e.message); }
    finally { setAdding(false); }
  };

  const addBulk = async () => {
    const names = bulkText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    setAdding(true);
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulk: names, tier: bulkTier }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "เพิ่มไม่สำเร็จ");
      setProspects((p) => [...json.prospects, ...p]);
      setBulkText("");
      setBulkOpen(false);
    } catch (e: any) { alert(e.message); }
    finally { setAdding(false); }
  };

  const patch = async (id: string, fields: Partial<Prospect>) => {
    try {
      const res = await fetch(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "อัปเดตไม่สำเร็จ");
      setProspects((p) => p.map((x) => (x.id === id ? json.prospect : x)));
    } catch (e: any) { alert(e.message); }
  };

  const removeOne = async (id: string, name: string) => {
    if (!confirm(`ลบ "${name}"?`)) return;
    try {
      const res = await fetch(`/api/prospects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "ลบไม่สำเร็จ");
      }
      setProspects((p) => p.filter((x) => x.id !== id));
    } catch (e: any) { alert(e.message); }
  };

  const convert = async (id: string) => {
    setConverting(id);
    try {
      const res = await fetch(`/api/prospects/${id}/convert`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "convert ไม่สำเร็จ");
      router.push(`/v2/checkform?load=${json.record_id}`);
    } catch (e: any) {
      alert(e.message);
      setConverting(null);
    }
  };

  const stats = useMemo(() => {
    const byTier = { A: 0, B: 0, C: 0 };
    const byStatus = { lead: 0, messaged: 0, replied: 0, scheduled: 0, analyzed: 0, closed: 0, not_interested: 0, dropped: 0 } as Record<Status, number>;
    for (const p of prospects) { byTier[p.tier]++; byStatus[p.status]++; }
    return { total: prospects.length, byTier, byStatus };
  }, [prospects]);

  const filtered = useMemo(() => prospects.filter((p) => {
    if (filterTier !== "ALL" && p.tier !== filterTier) return false;
    if (filterStatus === "ACTIVE") {
      if (p.status === "not_interested" || p.status === "dropped" || p.status === "closed") return false;
    } else if (filterStatus !== "ALL" && p.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.context ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  }), [prospects, filterTier, filterStatus, search]);

  const breadcrumb = [{ label: "หน้าแรก", href: "/v2" }, { label: "Prospects" }];

  return (
    <Shell breadcrumb={breadcrumb}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-head text-[24px] font-extrabold tracking-tight text-ink">รายชื่อ Prospect</h1>
          <p className="mt-1 max-w-2xl font-thai text-[13px] text-ink-60">
            ใส่ชื่อเร็ว ๆ · จัด tier A/B/C · แปลงเป็น CheckForm ด้วยคลิกเดียว · เริ่มจากคนที่คุยง่ายก่อน
          </p>
        </div>
        {!loading && !error && (
          <span className="rounded-full bg-ink-5 px-3 py-1 font-mono text-[11px] text-ink-60">{stats.total} ชื่อ</span>
        )}
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="ทั้งหมด" value={stats.total} level={null} />
        <StatCard label="A · ง่าย" value={stats.byTier.A} level="optimal" />
        <StatCard label="B · กลาง" value={stats.byTier.B} level="caution" />
        <StatCard label="C · cold" value={stats.byTier.C} level="warning" />
      </div>

      {/* Quick add */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={quickRef}
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addOne()}
            placeholder="พิมพ์ชื่อ · กด Enter เพื่อเพิ่ม"
            aria-label="ชื่อ prospect ใหม่"
            className="min-w-0 flex-1 rounded-full border border-ink-10 bg-white px-4 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:ring-2 focus:ring-rose-ultra"
          />
          <TierPicker tier={quickTier} onChange={setQuickTier} />
          <button
            type="button"
            onClick={addOne}
            disabled={adding || !quickName.trim()}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-rose px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-rose-mid disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            {adding ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Plus size={14} strokeWidth={2.5} aria-hidden />} เพิ่ม
          </button>
          <button
            type="button"
            onClick={() => setBulkOpen((v) => !v)}
            aria-expanded={bulkOpen}
            title="วาง list หลายชื่อพร้อมกัน"
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3 py-2 text-[12px] font-semibold text-ink-60 transition-colors hover:border-rose hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            <ClipboardPaste size={14} strokeWidth={2.25} aria-hidden /> วาง list
          </button>
        </div>

        {bulkOpen && (
          <div className="mt-3 rounded-xl border border-ink-10 bg-surface/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-ink-60">วาง list · 1 ชื่อ ต่อบรรทัด</span>
              <div className="flex items-center gap-2">
                <TierPicker tier={bulkTier} onChange={setBulkTier} />
                <button
                  type="button"
                  onClick={addBulk}
                  disabled={adding || !bulkText.trim()}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-rose px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-mid disabled:opacity-40"
                >
                  เพิ่มทั้งหมด
                </button>
              </div>
            </div>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"พี่สม\nคุณบอย\nเจ๊หน่อง\nน้องเก่ง\n…"}
              rows={6}
              aria-label="วางรายชื่อหลายชื่อ"
              className="w-full resize-y rounded-xl border border-ink-10 bg-white px-3 py-2 font-thai text-[13px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:ring-2 focus:ring-rose-ultra"
            />
            <p className="mt-1.5 font-thai text-[12px] text-ink-50">
              {bulkText.split("\n").filter((s) => s.trim()).length} ชื่อ · ใช้ tier {bulkTier} ทั้งหมด (แก้ภายหลังได้)
            </p>
          </div>
        )}
      </Card>

      {/* Filters */}
      <Card className="mb-4 space-y-2.5 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12px] font-semibold text-ink-40">Tier</span>
          <FilterChip active={filterTier === "ALL"} onClick={() => setFilterTier("ALL")}>ทั้งหมด</FilterChip>
          {(["A", "B", "C"] as Tier[]).map((t) => (
            <FilterChip key={t} active={filterTier === t} onClick={() => setFilterTier(t)} level={TIER_META[t].level}>
              {t} · {stats.byTier[t]}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12px] font-semibold text-ink-40">สถานะ</span>
          <FilterChip active={filterStatus === "ACTIVE"} onClick={() => setFilterStatus("ACTIVE")}>กำลังคุย</FilterChip>
          <FilterChip active={filterStatus === "ALL"} onClick={() => setFilterStatus("ALL")}>ทั้งหมด</FilterChip>
          <FilterChip active={filterStatus === "lead"} onClick={() => setFilterStatus("lead")}>ยังไม่ติดต่อ · {stats.byStatus.lead}</FilterChip>
          <FilterChip active={filterStatus === "closed"} onClick={() => setFilterStatus("closed")} level="optimal">ปิดได้ · {stats.byStatus.closed}</FilterChip>
        </div>
        <div className="relative">
          <Search size={15} strokeWidth={2.25} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-30" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อหรือ context…"
            aria-label="ค้นหา prospect"
            className="w-full rounded-full border border-ink-10 bg-surface/50 py-2 pl-9 pr-9 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:bg-white focus:ring-2 focus:ring-rose-ultra"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="ล้างคำค้น" className="absolute right-1.5 top-1/2 inline-flex h-[40px] w-[40px] -translate-y-1/2 items-center justify-center rounded-full text-ink-60 hover:bg-ink-5 hover:text-ink">
              <X size={15} strokeWidth={2.5} aria-hidden />
            </button>
          )}
        </div>
      </Card>

      {/* List */}
      {loading ? (
        <Card><LoadingState label="กำลังโหลดรายชื่อ…" /></Card>
      ) : error ? (
        <Card><ErrorState message={error} onRetry={load} /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={stats.total === 0 ? Users : Search}
            title={stats.total === 0 ? "เริ่มลิสต์รายชื่อ" : "ไม่พบในตัวกรองนี้"}
            hint={stats.total === 0 ? "พิมพ์ชื่อในช่องด้านบน กด Enter ทำซ้ำ · มี list อยู่แล้วใช้ วาง list ได้" : "ลองเปลี่ยน filter หรือเคลียร์คำค้น"}
            action={stats.total > 0 ? (
              <button type="button" onClick={() => { setFilterTier("ALL"); setFilterStatus("ALL"); setSearch(""); }}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-1.5 text-[12px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink">
                <RotateCw size={13} strokeWidth={2.25} aria-hidden /> ล้างตัวกรอง
              </button>
            ) : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <ProspectRow key={p.id} p={p} onPatch={patch} onDelete={removeOne} onConvert={convert} converting={converting === p.id} />
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="mt-4 text-center font-mono text-[11px] text-ink-40">แสดง {filtered.length} จาก {stats.total}</p>
      )}
    </Shell>
  );
}

/* ─────────────────────────── pieces ─────────────────────────── */

function StatCard({ label, value, level }: { label: string; value: number; level: StatusLevel | null }) {
  return (
    <Card className="px-4 py-3">
      <div className={`font-head text-[24px] font-extrabold leading-none ${level ? statusTextClass[level] : "text-ink"}`}>{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-ink-40">{label}</div>
    </Card>
  );
}

function TierPicker({ tier, onChange }: { tier: Tier; onChange: (t: Tier) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full border border-ink-10 bg-white p-1" role="group" aria-label="เลือก tier">
      {(["A", "B", "C"] as Tier[]).map((t) => {
        const active = tier === t;
        const m = TIER_META[t];
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            aria-pressed={active}
            title={`${t} · ${m.label}`}
            className={`h-8 w-8 rounded-full font-head text-[13px] font-extrabold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose ${
              active ? `${statusBgClass(m.level)} ${statusTextClass[m.level]}` : "text-ink-30 hover:text-ink-60"
            }`}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

function FilterChip({ active, onClick, children, level }: { active: boolean; onClick: () => void; children: React.ReactNode; level?: StatusLevel }) {
  const activeCls = level ? `${statusBgClass(level)} ${statusTextClass[level]} border-transparent` : "border-ink bg-ink text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[32px] rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-1 ${
        active ? activeCls : "border-ink-10 bg-white text-ink-60 hover:border-ink-20 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ProspectRow({ p, onPatch, onDelete, onConvert, converting }: {
  p: Prospect;
  onPatch: (id: string, fields: Partial<Prospect>) => void;
  onDelete: (id: string, name: string) => void;
  onConvert: (id: string) => void;
  converting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editContext, setEditContext] = useState(false);
  const [contextDraft, setContextDraft] = useState(p.context ?? "");
  const tier = TIER_META[p.tier];
  const st = STATUS_META[p.status];

  const saveContext = () => {
    setEditContext(false);
    if (contextDraft.trim() !== (p.context ?? "")) onPatch(p.id, { context: contextDraft.trim() || null });
  };

  return (
    <Card className={`overflow-hidden ${p.status === "closed" ? "ring-1 ring-wellness/15" : ""}`}>
      <div className="flex items-center gap-3 px-3 py-3 lg:px-4">
        {/* Tier — click cycles A→B→C */}
        <button
          type="button"
          onClick={() => onPatch(p.id, { tier: p.tier === "A" ? "B" : p.tier === "B" ? "C" : "A" })}
          title={`tier ${p.tier} · ${tier.label} · คลิกเปลี่ยน`}
          aria-label={`tier ${p.tier} ${tier.label} คลิกเปลี่ยน`}
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-head text-[14px] font-extrabold transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-1 ${statusBgClass(tier.level)} ${statusTextClass[tier.level]}`}
        >
          {p.tier}
        </button>

        {/* Name + context */}
        <button type="button" onClick={() => setExpanded((v) => !v)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="truncate font-head text-[14.5px] font-bold text-ink">{p.name}</span>
            <span className={`shrink-0 text-[11px] font-semibold ${st.level === "neutral" ? "text-ink-40" : statusTextClass[st.level]}`}>{st.label}</span>
          </div>
          {p.context && <div className="mt-0.5 truncate font-thai text-[12px] text-ink-60">{p.context}</div>}
        </button>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onConvert(p.id)}
            disabled={converting}
            title="แปลงเป็น CheckForm"
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-rose/20 bg-rose-ultra px-2.5 py-1.5 text-[11px] font-semibold text-rose transition-colors hover:bg-rose hover:text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-1"
          >
            {converting ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <ArrowRight size={12} strokeWidth={2.5} aria-hidden />} FORM
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label="ดู/แก้รายละเอียด"
            className="inline-flex h-[36px] w-[36px] items-center justify-center rounded-full text-ink-40 transition-colors hover:bg-ink-5 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-1"
          >
            <ChevronDown size={15} strokeWidth={2.25} className={`transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onDelete(p.id, p.name)}
            aria-label={`ลบ ${p.name}`}
            className="inline-flex h-[36px] w-[36px] items-center justify-center rounded-full text-ink-30 transition-colors hover:bg-status-bg-danger hover:text-status-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-1"
          >
            <Trash2 size={15} strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-ink-5 px-3 py-3 lg:px-4">
          {/* Context */}
          <div>
            <div className="mb-1 text-[11px] font-semibold text-ink-40">context · 1 บรรทัด</div>
            {editContext ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={contextDraft}
                  onChange={(e) => setContextDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveContext()}
                  autoFocus
                  aria-label="แก้ context"
                  className="min-w-0 flex-1 rounded-lg border border-rose/30 bg-white px-3 py-1.5 font-thai text-[13px] text-ink outline-none focus:ring-2 focus:ring-rose-ultra"
                />
                <button type="button" onClick={saveContext} className="rounded-lg bg-rose px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-mid">บันทึก</button>
                <button type="button" onClick={() => { setEditContext(false); setContextDraft(p.context ?? ""); }} className="rounded-lg border border-ink-10 px-3 py-1.5 text-[12px] text-ink-50">ยกเลิก</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditContext(true)}
                className="w-full rounded-lg border border-dashed border-ink-10 px-3 py-2 text-left font-thai text-[12.5px] text-ink-70 transition-colors hover:border-rose/40 hover:bg-rose-ultra/40"
              >
                {p.context || <span className="text-ink-30">+ คลิกเพื่อใส่ context…</span>}
              </button>
            )}
          </div>

          {/* Status pipeline */}
          <div>
            <div className="mb-1.5 text-[11px] font-semibold text-ink-40">สถานะ · pipeline</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {STATUS_ORDER.map((s) => {
                const active = p.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onPatch(p.id, { status: s })}
                    aria-pressed={active}
                    className={`min-h-[32px] rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-1 ${
                      active ? "bg-ink text-white" : "bg-ink-5 text-ink-60 hover:bg-ink-10"
                    }`}
                  >
                    {STATUS_META[s].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-ink-40">
            {p.converted_record_id ? (
              <a href={`/v2/checkform?load=${p.converted_record_id}`} className="text-rose hover:underline">มี CheckForm record แล้ว · เปิดดู →</a>
            ) : <span />}
            <span>เพิ่ม: {new Date(p.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
