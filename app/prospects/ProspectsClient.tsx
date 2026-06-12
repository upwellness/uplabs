"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type Tier = "A" | "B" | "C";
type Status =
  | "lead"
  | "messaged"
  | "replied"
  | "scheduled"
  | "analyzed"
  | "closed"
  | "not_interested"
  | "dropped";

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

const TIER_THEME: Record<Tier, { bg: string; text: string; ring: string; label: string }> = {
  A: { bg: "bg-wellness-ultra",  text: "text-wellness",  ring: "ring-wellness-pale",  label: "คุยง่ายมาก" },
  B: { bg: "bg-amber-ultra",     text: "text-amber",     ring: "ring-amber-pale",     label: "ต้องเปิดบทใหม่" },
  C: { bg: "bg-rose-ultra",      text: "text-rose",      ring: "ring-rose-pale",      label: "ห่างหาย / cold" },
};

const STATUS_LABEL: Record<Status, { th: string; color: string }> = {
  lead:           { th: "ยังไม่ติดต่อ",  color: "text-ink-50" },
  messaged:       { th: "📩 ส่งแล้ว",    color: "text-amber" },
  replied:        { th: "💬 ตอบแล้ว",    color: "text-wellness" },
  scheduled:      { th: "📅 นัดแล้ว",    color: "text-rose" },
  analyzed:       { th: "🤖 วิเคราะห์",  color: "text-rose-deep" },
  closed:         { th: "✓ ปิดได้",      color: "text-wellness-deep" },
  not_interested: { th: "✗ ไม่สนใจ",     color: "text-ink-40" },
  dropped:        { th: "— หายไป",       color: "text-ink-30" },
};

const STATUS_ORDER: Status[] = [
  "lead", "messaged", "replied", "scheduled", "analyzed", "closed", "not_interested", "dropped",
];

export function ProspectsClient() {
  const router = useRouter();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick add
  const [quickName, setQuickName] = useState("");
  const [quickTier, setQuickTier] = useState<Tier>("B");
  const [adding, setAdding] = useState(false);
  const quickInputRef = useRef<HTMLInputElement>(null);

  // Bulk paste
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkTier, setBulkTier] = useState<Tier>("B");

  // Filters
  const [filterTier, setFilterTier] = useState<Tier | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<Status | "ALL" | "ACTIVE">("ACTIVE");
  const [search, setSearch] = useState("");

  // Convert spinner
  const [converting, setConverting] = useState<string | null>(null);

  // Load on mount
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/prospects");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "load failed");
      setProspects(json.prospects ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  // Quick add (Enter to submit + refocus)
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
      if (!res.ok) throw new Error(json.error ?? "add failed");
      setProspects((p) => [json.prospect, ...p]);
      setQuickName("");
      quickInputRef.current?.focus();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAdding(false);
    }
  };

  const addBulk = async () => {
    const names = bulkText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    setAdding(true);
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulk: names, tier: bulkTier }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "bulk add failed");
      setProspects((p) => [...json.prospects, ...p]);
      setBulkText("");
      setBulkOpen(false);
      alert(`✓ เพิ่ม ${json.inserted} ชื่อ`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAdding(false);
    }
  };

  const patch = async (id: string, fields: Partial<Prospect>) => {
    try {
      const res = await fetch(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "patch failed");
      setProspects((p) => p.map((x) => (x.id === id ? json.prospect : x)));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const removeOne = async (id: string, name: string) => {
    if (!confirm(`ลบ "${name}" ?`)) return;
    try {
      const res = await fetch(`/api/prospects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "delete failed");
      }
      setProspects((p) => p.filter((x) => x.id !== id));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const convertToCheckform = async (id: string) => {
    setConverting(id);
    try {
      const res = await fetch(`/api/prospects/${id}/convert`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "convert failed");
      router.push(`/checkform?load=${json.record_id}`);
    } catch (e: any) {
      alert(e.message);
      setConverting(null);
    }
  };

  // Computed stats
  const stats = useMemo(() => {
    const total = prospects.length;
    const byTier = { A: 0, B: 0, C: 0 };
    const byStatus: Record<Status, number> = {
      lead: 0, messaged: 0, replied: 0, scheduled: 0,
      analyzed: 0, closed: 0, not_interested: 0, dropped: 0,
    };
    for (const p of prospects) {
      byTier[p.tier]++;
      byStatus[p.status]++;
    }
    return { total, byTier, byStatus };
  }, [prospects]);

  // Filtered list
  const filtered = useMemo(() => {
    return prospects.filter((p) => {
      if (filterTier !== "ALL" && p.tier !== filterTier) return false;
      if (filterStatus === "ACTIVE") {
        if (p.status === "not_interested" || p.status === "dropped" || p.status === "closed") {
          return false;
        }
      } else if (filterStatus !== "ALL" && p.status !== filterStatus) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.context ?? "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [prospects, filterTier, filterStatus, search]);

  return (
    <div className="mt-8 space-y-6">
      {/* ── Stats bar ───────────────────────────── */}
      <StatsBar stats={stats} />

      {/* ── Quick add (sticky) ──────────────────── */}
      <div className="sticky top-16 z-30 -mx-2 px-2 py-3 bg-warm-white/85 backdrop-blur-md rounded-2xl">
        <div className="rounded-3xl border border-rose/30 bg-white p-4 shadow-[0_2px_12px_-6px_rgba(140,76,76,0.15)]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-rose font-bold shrink-0">
              + เพิ่มชื่อ
            </span>
            <input
              ref={quickInputRef}
              type="text"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addOne()}
              placeholder="พิมพ์ชื่อ · กด Enter เพื่อเพิ่ม"
              autoFocus
              className="flex-1 min-w-0 rounded-full border border-ink-10 bg-white px-4 py-2.5 font-thai text-[14px] text-ink placeholder:text-ink-30 focus:outline-none focus:ring-2 focus:ring-rose/30 focus:border-rose"
            />
            <TierPicker tier={quickTier} onChange={setQuickTier} />
            <button
              onClick={addOne}
              disabled={adding || !quickName.trim()}
              className="shrink-0 rounded-full bg-rose px-4 py-2.5 text-[12px] font-bold text-white hover:bg-rose-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {adding ? "..." : "เพิ่ม"}
            </button>
            <button
              onClick={() => setBulkOpen(!bulkOpen)}
              className="shrink-0 rounded-full border border-ink-10 bg-white px-3 py-2.5 text-[11px] font-bold text-ink-60 hover:border-rose/30 hover:text-rose transition-colors"
              title="วาง list หลายชื่อพร้อมกัน"
            >
              📋 paste list
            </button>
          </div>

          {bulkOpen && (
            <div className="mt-3 rounded-2xl bg-surface/60 p-3 border border-ink-10">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-60 font-bold">
                  วาง list · 1 ชื่อ ต่อบรรทัด
                </span>
                <div className="flex items-center gap-2">
                  <TierPicker tier={bulkTier} onChange={setBulkTier} />
                  <button
                    onClick={addBulk}
                    disabled={adding || !bulkText.trim()}
                    className="rounded-full bg-rose px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-deep transition-colors disabled:opacity-40"
                  >
                    เพิ่มทั้งหมด
                  </button>
                </div>
              </div>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"พี่สม\nคุณบอย\nเจ๊หน่อง\nน้องเก่ง\n..."}
                rows={8}
                className="w-full rounded-xl border border-ink-10 bg-white px-3 py-2 font-thai text-[13px] leading-relaxed text-ink placeholder:text-ink-30 focus:outline-none focus:ring-2 focus:ring-rose/30 focus:border-rose resize-y"
              />
              <p className="mt-1.5 font-thai text-[11px] text-ink-50">
                {bulkText.split("\n").filter((s) => s.trim()).length} ชื่อ · ใช้ tier {bulkTier} ทั้งหมด (แก้ภายหลังได้)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────── */}
      <FilterBar
        filterTier={filterTier}
        filterStatus={filterStatus}
        setFilterTier={setFilterTier}
        setFilterStatus={setFilterStatus}
        search={search}
        setSearch={setSearch}
        stats={stats}
      />

      {/* ── List ────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-ink-5 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-status-bg-danger bg-status-bg-danger/40 p-5 text-center">
          <div className="font-thai text-[14px] font-semibold text-status-danger">⚠ {error}</div>
          <Button variant="ghost" size="sm" onClick={load} className="mt-3">🔄 ลองใหม่</Button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState totalCount={stats.total} />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <ProspectRow
              key={p.id}
              p={p}
              onPatch={patch}
              onDelete={removeOne}
              onConvert={convertToCheckform}
              converting={converting === p.id}
            />
          ))}
        </div>
      )}

      {/* Footer counter */}
      {filtered.length > 0 && (
        <div className="text-center pt-4">
          <p className="font-mono text-[11px] text-ink-40">
            แสดง {filtered.length} จาก {stats.total} ทั้งหมด
          </p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────── */

interface StatsShape {
  total: number;
  byTier: Record<Tier, number>;
  byStatus: Record<Status, number>;
}

function StatsBar({ stats }: { stats: StatsShape }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
      <StatCard label="ทั้งหมด"      value={stats.total}                colorClass="text-ink" />
      <StatCard label="A · ง่าย"     value={stats.byTier.A}             colorClass="text-wellness" />
      <StatCard label="B · กลาง"     value={stats.byTier.B}             colorClass="text-amber" />
      <StatCard label="C · cold"     value={stats.byTier.C}             colorClass="text-rose" />
      <StatCard label="ติดต่อแล้ว"   value={stats.byStatus.messaged + stats.byStatus.replied + stats.byStatus.scheduled + stats.byStatus.analyzed + stats.byStatus.closed} colorClass="text-rose-deep" />
      <StatCard label="ปิดได้"       value={stats.byStatus.closed}      colorClass="text-wellness-deep" />
    </div>
  );
}

function StatCard({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="rounded-2xl border border-ink-10 bg-white px-4 py-3">
      <div className={`font-head text-[24px] font-extrabold leading-none ${colorClass}`}>{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-40 font-bold">{label}</div>
    </div>
  );
}

function TierPicker({ tier, onChange }: { tier: Tier; onChange: (t: Tier) => void }) {
  return (
    <div className="flex items-center gap-1 shrink-0 rounded-full border border-ink-10 bg-white p-1">
      {(["A", "B", "C"] as Tier[]).map((t) => {
        const active = tier === t;
        const theme = TIER_THEME[t];
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`h-7 w-7 rounded-full font-head text-[12px] font-extrabold transition-colors ${
              active ? `${theme.bg} ${theme.text}` : "text-ink-30 hover:text-ink-60"
            }`}
            title={theme.label}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

function FilterBar({
  filterTier, filterStatus, setFilterTier, setFilterStatus, search, setSearch, stats,
}: {
  filterTier: Tier | "ALL";
  filterStatus: Status | "ALL" | "ACTIVE";
  setFilterTier: (v: Tier | "ALL") => void;
  setFilterStatus: (v: Status | "ALL" | "ACTIVE") => void;
  search: string;
  setSearch: (v: string) => void;
  stats: StatsShape;
}) {
  return (
    <div className="rounded-2xl border border-ink-10 bg-white px-4 py-3 space-y-2">
      {/* Tier chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-40 font-bold shrink-0">tier:</span>
        <Chip active={filterTier === "ALL"} onClick={() => setFilterTier("ALL")}>ทั้งหมด {stats.total}</Chip>
        <Chip active={filterTier === "A"} onClick={() => setFilterTier("A")} theme="wellness">A {stats.byTier.A}</Chip>
        <Chip active={filterTier === "B"} onClick={() => setFilterTier("B")} theme="amber">B {stats.byTier.B}</Chip>
        <Chip active={filterTier === "C"} onClick={() => setFilterTier("C")} theme="rose">C {stats.byTier.C}</Chip>
      </div>
      {/* Status chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-40 font-bold shrink-0">สถานะ:</span>
        <Chip active={filterStatus === "ACTIVE"} onClick={() => setFilterStatus("ACTIVE")}>active pipeline</Chip>
        <Chip active={filterStatus === "ALL"} onClick={() => setFilterStatus("ALL")}>ทั้งหมด</Chip>
        <Chip active={filterStatus === "lead"} onClick={() => setFilterStatus("lead")}>ยังไม่ติดต่อ {stats.byStatus.lead}</Chip>
        <Chip active={filterStatus === "messaged"} onClick={() => setFilterStatus("messaged")}>📩 {stats.byStatus.messaged}</Chip>
        <Chip active={filterStatus === "replied"} onClick={() => setFilterStatus("replied")}>💬 {stats.byStatus.replied}</Chip>
        <Chip active={filterStatus === "scheduled"} onClick={() => setFilterStatus("scheduled")}>📅 {stats.byStatus.scheduled}</Chip>
        <Chip active={filterStatus === "analyzed"} onClick={() => setFilterStatus("analyzed")}>🤖 {stats.byStatus.analyzed}</Chip>
        <Chip active={filterStatus === "closed"} onClick={() => setFilterStatus("closed")} theme="wellness">✓ {stats.byStatus.closed}</Chip>
      </div>
      {/* Search */}
      <div className="pt-1">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 ค้นหาชื่อหรือ context..."
          className="w-full rounded-full border border-ink-10 bg-surface/50 px-3 py-1.5 font-thai text-[12px] text-ink placeholder:text-ink-30 focus:outline-none focus:bg-white focus:ring-1 focus:ring-rose/30 focus:border-rose"
        />
      </div>
    </div>
  );
}

function Chip({ active, onClick, children, theme }: { active: boolean; onClick: () => void; children: React.ReactNode; theme?: "wellness" | "amber" | "rose" }) {
  const activeColor =
    theme === "wellness" ? "bg-wellness text-white" :
    theme === "amber"    ? "bg-amber text-white" :
    theme === "rose"     ? "bg-rose text-white" :
    "bg-ink text-white";
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 font-mono text-[10.5px] font-bold transition-colors ${
        active ? activeColor : "bg-ink-5 text-ink-60 hover:bg-ink-10"
      }`}
    >
      {children}
    </button>
  );
}

function ProspectRow({
  p, onPatch, onDelete, onConvert, converting,
}: {
  p: Prospect;
  onPatch: (id: string, fields: Partial<Prospect>) => void;
  onDelete: (id: string, name: string) => void;
  onConvert: (id: string) => void;
  converting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editContext, setEditContext] = useState(false);
  const [contextDraft, setContextDraft] = useState(p.context ?? "");
  const tierTheme = TIER_THEME[p.tier];
  const statusInfo = STATUS_LABEL[p.status];

  const saveContext = () => {
    setEditContext(false);
    if (contextDraft.trim() !== (p.context ?? "")) {
      onPatch(p.id, { context: contextDraft.trim() || null });
    }
  };

  return (
    <div className={`group rounded-2xl border bg-white px-4 py-3 transition-all overflow-hidden ${
      p.status === "closed" ? "border-wellness/30 ring-1 ring-wellness/10" :
      p.status === "analyzed" ? "border-rose/30 ring-1 ring-rose/10" :
      "border-ink-10 hover:border-ink-20"
    }`}>
      {/* Top row */}
      <div className="flex items-center gap-3">
        {/* Tier badge */}
        <button
          onClick={() => {
            const next = p.tier === "A" ? "B" : p.tier === "B" ? "C" : "A";
            onPatch(p.id, { tier: next });
          }}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tierTheme.bg} ${tierTheme.text} ring-1 ${tierTheme.ring} font-head font-extrabold text-[14px] hover:scale-110 transition-transform`}
          title={`tier ${p.tier} · ${tierTheme.label} · คลิกเปลี่ยน`}
        >
          {p.tier}
        </button>

        {/* Name + context */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 min-w-0 text-left overflow-hidden"
        >
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-thai text-[14.5px] font-bold text-ink truncate min-w-0">{p.name}</span>
            <span className={`shrink-0 font-mono text-[10px] font-bold ${statusInfo.color}`}>
              {statusInfo.th}
            </span>
          </div>
          {p.context && (
            <div className="mt-0.5 font-thai text-[12px] text-ink-60 line-clamp-1 break-all">
              {p.context}
            </div>
          )}
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onConvert(p.id)}
            disabled={converting}
            className="rounded-lg border border-rose/30 bg-rose-ultra px-2.5 py-1.5 text-[11px] font-bold text-rose hover:bg-rose hover:text-white transition-colors disabled:opacity-40"
            title="convert → CheckForm"
          >
            {converting ? "..." : "→ FORM"}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg border border-ink-10 bg-white px-2 py-1.5 text-[11px] text-ink-40 hover:text-ink hover:border-ink-20 transition-colors"
            title="แก้/ดูรายละเอียด"
          >
            {expanded ? "▴" : "▾"}
          </button>
          <button
            onClick={() => onDelete(p.id, p.name)}
            className="rounded-lg border border-ink-10 bg-white px-2 py-1.5 text-[11px] text-ink-30 opacity-0 group-hover:opacity-100 hover:text-status-danger hover:border-status-danger/30 hover:bg-status-bg-danger/40 transition-all"
            title="ลบ"
          >
            🗑
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-ink-5 space-y-3">
          {/* Edit context */}
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-40 font-bold mb-1">
              context · 1 บรรทัด (เช่น เพื่อนวงร้านกาแฟ · เคยคุยเรื่องเลือกอาหาร)
            </div>
            {editContext ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={contextDraft}
                  onChange={(e) => setContextDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveContext()}
                  className="flex-1 rounded-lg border border-rose/30 bg-white px-3 py-1.5 font-thai text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-rose/30"
                  autoFocus
                />
                <button onClick={saveContext} className="rounded-lg bg-rose px-3 py-1.5 text-[11px] font-bold text-white">save</button>
                <button onClick={() => { setEditContext(false); setContextDraft(p.context ?? ""); }} className="rounded-lg border border-ink-10 px-3 py-1.5 text-[11px] text-ink-50">cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setEditContext(true)}
                className="w-full text-left rounded-lg border border-dashed border-ink-10 px-3 py-2 font-thai text-[12.5px] text-ink-70 hover:border-rose/40 hover:bg-rose-ultra/40 transition-colors"
              >
                {p.context || <span className="text-ink-30">+ คลิกเพื่อใส่ context...</span>}
              </button>
            )}
          </div>

          {/* Status pipeline */}
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-40 font-bold mb-1.5">
              สถานะ · pipeline
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {STATUS_ORDER.map((s) => {
                const active = p.status === s;
                const info = STATUS_LABEL[s];
                return (
                  <button
                    key={s}
                    onClick={() => onPatch(p.id, { status: s })}
                    className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold transition-colors ${
                      active
                        ? "bg-ink text-white ring-2 ring-rose/40"
                        : "bg-ink-5 text-ink-50 hover:bg-ink-10"
                    }`}
                  >
                    {info.th}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Linked record + meta */}
          <div className="flex items-center justify-between text-[10px] font-mono text-ink-40 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              {p.converted_record_id && (
                <a
                  href={`/checkform?load=${p.converted_record_id}`}
                  className="text-rose hover:underline"
                >
                  🤖 มี CheckForm record แล้ว · เปิดดู →
                </a>
              )}
              {p.contacted_at && (
                <span>📩 ติดต่อ: {new Date(p.contacted_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
              )}
              {p.replied_at && (
                <span>💬 ตอบ: {new Date(p.replied_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
              )}
              {p.closed_at && (
                <span className="text-wellness-deep">✓ ปิด: {new Date(p.closed_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
              )}
            </div>
            <span>เพิ่ม: {new Date(p.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ totalCount }: { totalCount: number }) {
  return (
    <div className="rounded-3xl border border-dashed border-ink-10 px-6 py-12 text-center bg-white/60">
      <div className="text-5xl mb-3">📝</div>
      {totalCount === 0 ? (
        <>
          <div className="font-head text-[18px] font-extrabold text-ink">เริ่มลิสต์ 100 ชื่อ</div>
          <p className="mt-2 max-w-md mx-auto font-thai text-[13px] text-ink-60 leading-relaxed">
            พิมพ์ชื่อในช่องด้านบน · กด Enter · ทำซ้ำจนครบ 100 · ถ้ามี list อยู่แล้ว ใช้ "paste list" ได้
          </p>
          <p className="mt-3 max-w-md mx-auto font-thai text-[12px] text-ink-50">
            🎯 เป้า: 15 นาที · 100 ชื่อ · ไม่ filter · braindump ก่อน
          </p>
        </>
      ) : (
        <>
          <div className="font-head text-[16px] font-bold text-ink">ไม่พบในตัวกรองนี้</div>
          <p className="mt-2 font-thai text-[12px] text-ink-50">ลองเปลี่ยน filter หรือเคลียร์ search</p>
        </>
      )}
    </div>
  );
}
