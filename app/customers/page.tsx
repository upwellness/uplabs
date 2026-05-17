"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { NewCustomerForm } from "./_components/NewCustomerForm";

interface CustomerRow {
  id: string;
  name: string;
  gender: string | null;
  birth_year: number | null;
  birth_date: string | null;
  height: number | null;
  coach_id: string | null;
  cgm_profile_names: string[] | null;
  created_at: string;
  stats: {
    bca: number;
    cgm: number;
    pulse: { provider: string; status: string; last_sync_at: string | null } | null;
    leads: number;
  };
}

type FilterKey = "all" | "no_cgm" | "no_pulse" | "no_bca" | "complete";

export default function CustomersListPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [showNew,   setShowNew]   = useState(false);
  const [filter,    setFilter]    = useState<FilterKey>("all");
  const [manageMode, setManageMode] = useState(false);
  const [toDelete,   setToDelete]   = useState<CustomerRow | null>(null);
  const [deleting,   setDeleting]   = useState(false);
  const [delError,   setDelError]   = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customers/list");
      const json = await res.json();
      setCustomers(json.customers ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true); setDelError(null);
    try {
      const res = await fetch(`/api/customers/${toDelete.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ลบไม่สำเร็จ");
      setToDelete(null);
      await load();
    } catch (e: any) { setDelError(e.message); }
    finally { setDeleting(false); }
  };

  const filtered = useMemo(() => {
    let list = customers;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(s));
    }
    if (filter === "no_cgm")   list = list.filter((c) => c.stats.cgm === 0);
    if (filter === "no_pulse") list = list.filter((c) => !c.stats.pulse);
    if (filter === "no_bca")   list = list.filter((c) => c.stats.bca === 0);
    if (filter === "complete") list = list.filter((c) => c.stats.bca > 0 && c.stats.cgm > 0 && c.stats.pulse?.status === "active");
    return list;
  }, [customers, search, filter]);

  const stats = useMemo(() => ({
    total:        customers.length,
    has_bca:      customers.filter((c) => c.stats.bca > 0).length,
    has_cgm:      customers.filter((c) => c.stats.cgm > 0).length,
    has_pulse:    customers.filter((c) => c.stats.pulse?.status === "active").length,
    new7d:        customers.filter((c) => Date.now() - new Date(c.created_at).getTime() < 7 * 24 * 60 * 60 * 1000).length,
  }), [customers]);

  const filterCounts = useMemo(() => ({
    all:      customers.length,
    no_bca:   customers.filter((c) => c.stats.bca === 0).length,
    no_cgm:   customers.filter((c) => c.stats.cgm === 0).length,
    no_pulse: customers.filter((c) => !c.stats.pulse).length,
    complete: customers.filter((c) => c.stats.bca > 0 && c.stats.cgm > 0 && c.stats.pulse?.status === "active").length,
  }), [customers]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-warm-white">
      <BgMesh />

      {/* ── Header ────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-ink-10/60 bg-warm-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-5">
            <Link href="/" className="group flex items-center gap-1.5 text-ink-40 hover:text-ink transition-colors text-sm">
              <span className="transition-transform group-hover:-translate-x-0.5">←</span>
              <span className="font-thai">Hub</span>
            </Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full border border-rose/20 bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-rose">
              Customer Profiles
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setManageMode((v) => !v)}
              title="เปิด/ปิดโหมดจัดการ — แสดงปุ่มลบในแต่ละแถว"
              className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all ${
                manageMode
                  ? "border-status-danger/30 bg-status-bg-danger text-status-danger"
                  : "border-ink-10 bg-white text-ink-60 hover:border-ink-20 hover:text-ink"
              }`}
            >
              <span className={`transition-transform ${manageMode ? "rotate-12" : ""}`}>🛠</span>
              {manageMode ? "Manage on" : "Manage"}
            </button>
            <Button variant="rose" onClick={() => setShowNew(true)}>+ ลูกค้าใหม่</Button>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────── */}
      <section className="relative mx-auto max-w-content px-6 lg:px-10 pt-10 pb-8 lg:pt-14 lg:pb-10">
        <div className="mb-5 inline-flex items-center gap-2">
          <span className="h-px w-7 bg-rose" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-rose">Master Profile Registry</span>
        </div>
        <h1 className="font-head font-extrabold leading-[1.04] tracking-[-1.5px] text-ink text-[clamp(34px,4.5vw,52px)]">
          รายชื่อ
          <span className="bg-gradient-to-br from-rose-deep via-rose to-amber bg-clip-text text-transparent"> ลูกค้า</span>
        </h1>
        <p className="mt-3 max-w-2xl font-thai text-[15px] leading-[1.7] text-ink-60">
          จัดการ profile · เชื่อมข้อมูลข้ามแอป (BCA · CGM · Wearable · Records) · ติดตาม journey ของลูกค้าตั้งแต่ lead จนถึง active partner
        </p>
      </section>

      {/* ── KPI Stats ──────────────────────────────── */}
      <section className="relative mx-auto max-w-content px-6 lg:px-10">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
          <KpiCard
            label="ลูกค้าทั้งหมด"
            value={stats.total}
            sub={stats.new7d > 0 ? `+${stats.new7d} ใน 7 วัน` : "— ยังไม่มี new"}
            accent="rose"
            icon="👥"
            featured
            loading={loading}
          />
          <KpiCard label="มี BCA"        value={stats.has_bca}   total={stats.total} accent="science" icon="📊" loading={loading} />
          <KpiCard label="Link CGM"       value={stats.has_cgm}   total={stats.total} accent="wellness" icon="📈" loading={loading} />
          <KpiCard label="Connect Pulse"  value={stats.has_pulse} total={stats.total} accent="amber"   icon="📱" loading={loading} />
          <KpiCard label="ครบทุกแอป"      value={filterCounts.complete} total={stats.total} accent="rose" icon="✨" loading={loading} />
        </div>
      </section>

      {/* ── Search + Filters ──────────────────────── */}
      <section className="relative mx-auto max-w-content px-6 lg:px-10 mt-10">
        <div className="rounded-3xl border border-ink-10 bg-white/70 backdrop-blur-sm p-4 lg:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterPill v="all"      label="ทั้งหมด"            count={filterCounts.all}      active={filter === "all"}      onClick={setFilter} accent="ink" />
              <FilterPill v="complete" label="✨ ครบทุกแอป"        count={filterCounts.complete} active={filter === "complete"} onClick={setFilter} accent="wellness" />
              <FilterPill v="no_bca"   label="ยังไม่มี BCA"        count={filterCounts.no_bca}   active={filter === "no_bca"}   onClick={setFilter} accent="science" />
              <FilterPill v="no_cgm"   label="ยังไม่ link CGM"     count={filterCounts.no_cgm}   active={filter === "no_cgm"}   onClick={setFilter} accent="amber" />
              <FilterPill v="no_pulse" label="ยังไม่ connect Pulse" count={filterCounts.no_pulse} active={filter === "no_pulse"} onClick={setFilter} accent="rose" />
            </div>
            <div className="relative w-full lg:w-80">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-30 text-sm">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อลูกค้า..."
                className="w-full rounded-full border border-ink-10 bg-white pl-10 pr-4 py-2 text-sm outline-none transition-colors focus:border-rose focus:ring-2 focus:ring-rose-ultra placeholder:text-ink-30"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-ink-10 px-1.5 text-[10px] text-ink-60 hover:bg-ink-20"
                  title="ล้างคำค้น"
                >✕</button>
              )}
            </div>
          </div>
          {manageMode && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-status-danger/20 bg-status-bg-danger/40 px-3 py-2 text-[12px] font-thai text-status-danger">
              <span>⚠</span>
              <span>โหมดจัดการเปิดอยู่ — คลิก "ลบ" ต่อแถวเพื่อลบลูกค้าที่ไม่ได้ใช้แล้ว</span>
            </div>
          )}
        </div>
      </section>

      {/* ── List ──────────────────────────────────── */}
      <section className="relative mx-auto max-w-content px-6 lg:px-10 mt-6 pb-20">
        <div className="overflow-hidden rounded-3xl border border-ink-10 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)]">
          {loading ? (
            <SkeletonList />
          ) : filtered.length === 0 ? (
            <EmptyState
              search={search}
              filter={filter}
              onClear={() => { setSearch(""); setFilter("all"); }}
              onCreate={() => setShowNew(true)}
            />
          ) : (
            <>
              <div className="flex items-center justify-between px-5 py-3 border-b border-ink-5 bg-surface/50">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40 font-bold">
                  {filtered.length === customers.length
                    ? `แสดง ${filtered.length} คน`
                    : `แสดง ${filtered.length} / ${customers.length} คน`}
                </div>
                <div className="font-mono text-[10px] text-ink-30">
                  คลิกแถวเพื่อดู profile
                </div>
              </div>
              <div className="divide-y divide-ink-5">
                {filtered.map((c, i) => (
                  <CustomerListItem
                    key={c.id}
                    customer={c}
                    manageMode={manageMode}
                    onDelete={() => { setDelError(null); setToDelete(c); }}
                    index={i}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {showNew && (
        <NewCustomerForm
          onCancel={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load(); }}
        />
      )}

      {toDelete && (
        <DeleteConfirmModal
          customer={toDelete}
          deleting={deleting}
          error={delError}
          onCancel={() => { setToDelete(null); setDelError(null); }}
          onConfirm={confirmDelete}
        />
      )}
    </main>
  );
}

/* ──────────────────────────────────────────────────── */
/* Background mesh (same family as hub)                 */
/* ──────────────────────────────────────────────────── */

function BgMesh() {
  return (
    <>
      <style>{`
        @keyframes mesh-drift-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-20px) scale(1.05); } }
        @keyframes mesh-drift-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-20px,15px) scale(0.95); } }
        .cmesh-a { animation: mesh-drift-a 20s ease-in-out infinite; }
        .cmesh-b { animation: mesh-drift-b 24s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .cmesh-a, .cmesh-b { animation: none; }
        }
      `}</style>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[480px] overflow-hidden">
        <div className="cmesh-a absolute -top-24 -left-16 h-[400px] w-[400px] rounded-full bg-rose-pale/50 blur-[120px]" />
        <div className="cmesh-b absolute top-16 right-0 h-[360px] w-[360px] rounded-full bg-amber-pale/55 blur-[120px]" />
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────── */
/* KPI Card                                             */
/* ──────────────────────────────────────────────────── */

const ACCENT = {
  rose:     { dot: "bg-rose",     text: "text-rose",     bg: "bg-rose-ultra",     bar: "bg-rose"     },
  wellness: { dot: "bg-wellness", text: "text-wellness", bg: "bg-wellness-ultra", bar: "bg-wellness" },
  science:  { dot: "bg-science",  text: "text-science",  bg: "bg-science-ultra",  bar: "bg-science"  },
  amber:    { dot: "bg-amber",    text: "text-amber",    bg: "bg-amber-ultra",    bar: "bg-amber"    },
  ink:      { dot: "bg-ink-60",   text: "text-ink",      bg: "bg-ink-5",          bar: "bg-ink-60"   },
} as const;

function KpiCard({
  label, value, total, sub, accent, icon, featured, loading,
}: {
  label: string;
  value: number;
  total?: number;
  sub?: string;
  accent: keyof typeof ACCENT;
  icon: string;
  featured?: boolean;
  loading?: boolean;
}) {
  const a = ACCENT[accent];
  const pct = total ? Math.round((value / Math.max(1, total)) * 100) : null;

  if (loading) {
    return (
      <div className={`relative rounded-2xl border border-ink-10 bg-white p-5 ${featured ? "lg:row-span-2 lg:col-span-1" : ""}`}>
        <div className="h-3 w-20 rounded bg-ink-5 animate-pulse" />
        <div className="mt-3 h-9 w-16 rounded bg-ink-5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-ink-10 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(0,0,0,0.08)] hover:border-ink-20`}>
      <div className={`absolute -top-12 -right-12 h-32 w-32 rounded-full ${a.bg} blur-2xl opacity-70 transition-opacity duration-300 group-hover:opacity-100`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${a.bg} text-base ring-1 ring-white/60`}>
            {icon}
          </div>
          <div className={`flex items-center gap-1 text-[10px] font-mono font-bold ${a.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${a.dot} animate-pulse`} />
            live
          </div>
        </div>
        <div className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-40">{label}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-head text-[36px] font-extrabold leading-none tracking-tight text-ink">{value.toLocaleString()}</span>
          {total != null && <span className="font-mono text-[12px] text-ink-30">/ {total}</span>}
        </div>
        {pct != null && (
          <div className="mt-3">
            <div className="h-1 rounded-full bg-ink-5 overflow-hidden">
              <div className={`h-full ${a.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 font-mono text-[10px] text-ink-40">{pct}% ของลูกค้าทั้งหมด</div>
          </div>
        )}
        {sub && pct == null && (
          <div className="mt-2 font-mono text-[11px] text-ink-40">{sub}</div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────── */
/* Filter Pill                                          */
/* ──────────────────────────────────────────────────── */

const PILL_ACTIVE: Record<keyof typeof ACCENT, string> = {
  ink:      "border-ink bg-ink text-white",
  rose:     "border-rose bg-rose text-white",
  wellness: "border-wellness bg-wellness text-white",
  science:  "border-science bg-science text-white",
  amber:    "border-amber bg-amber text-white",
};

function FilterPill({
  v, label, count, active, onClick, accent,
}: {
  v: FilterKey;
  label: string;
  count: number;
  active: boolean;
  onClick: (v: FilterKey) => void;
  accent: keyof typeof ACCENT;
}) {
  return (
    <button
      onClick={() => onClick(v)}
      className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all ${
        active
          ? PILL_ACTIVE[accent]
          : "border-ink-10 bg-white text-ink-60 hover:border-ink-20 hover:text-ink"
      }`}
    >
      <span className="font-thai">{label}</span>
      <span className={`inline-flex items-center justify-center min-w-[20px] rounded-full px-1 font-mono text-[10px] font-bold ${
        active ? "bg-white/20 text-white" : "bg-ink-5 text-ink-40"
      }`}>
        {count}
      </span>
    </button>
  );
}

/* ──────────────────────────────────────────────────── */
/* Customer List Item                                   */
/* ──────────────────────────────────────────────────── */

function CustomerListItem({
  customer, manageMode, onDelete, index,
}: {
  customer: CustomerRow;
  manageMode: boolean;
  onDelete: () => void;
  index: number;
}) {
  const ageFromDate = customer.birth_date ? computeAgeQuick(customer.birth_date) : null;
  const age = ageFromDate ?? (customer.birth_year ? new Date().getFullYear() - customer.birth_year : null);
  const initials = customer.name.replace(/^(คุณ|นาย|นาง|น\.ส\.)\s?/, "").slice(0, 2).toUpperCase();
  const ringColor = customer.gender === "male" ? "ring-science-pale" : customer.gender === "female" ? "ring-rose-pale" : "ring-ink-10";
  const avatarBg  = customer.gender === "male" ? "bg-science" : customer.gender === "female" ? "bg-rose" : "bg-ink-40";

  // Completeness score (visual indicator)
  const completeness =
    (customer.stats.bca > 0 ? 1 : 0) +
    (customer.stats.cgm > 0 ? 1 : 0) +
    (customer.stats.pulse?.status === "active" ? 1 : 0);
  const completeColor = completeness === 3 ? "bg-status-optimal" : completeness === 2 ? "bg-status-good" : completeness === 1 ? "bg-status-caution" : "bg-ink-10";

  return (
    <div className={`group relative flex items-center gap-4 px-5 py-3.5 transition-colors ${manageMode ? "hover:bg-status-bg-danger/30" : "hover:bg-surface"}`}>
      {/* Left accent on hover */}
      <span className={`absolute left-0 top-0 bottom-0 w-0.5 ${manageMode ? "bg-status-danger" : "bg-rose"} opacity-0 transition-opacity duration-200 group-hover:opacity-100`} />

      <Link href={`/customers/${customer.id}`} className="flex flex-1 min-w-0 items-center gap-4">
        {/* Avatar with completeness ring */}
        <div className="relative">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${avatarBg} text-[13px] font-bold text-white ring-2 ${ringColor}`}>
            {initials}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${completeColor} ring-2 ring-white`} title={`Data completeness ${completeness}/3`} />
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <div className="font-thai text-[15px] font-bold text-ink truncate">{customer.name}</div>
            <span className="font-mono text-[9px] text-ink-30">#{index + 1}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-ink-40">
            <span>{customer.gender === "male" ? "ชาย" : customer.gender === "female" ? "หญิง" : "—"}</span>
            {age != null && <><span className="text-ink-20">·</span><span>{age} ปี</span></>}
            {customer.height && <><span className="text-ink-20">·</span><span>{customer.height} cm</span></>}
          </div>
        </div>

        {/* Badges */}
        <div className="hidden md:flex flex-wrap items-center gap-1.5 shrink-0">
          <StatBadge label="BCA"   value={customer.stats.bca}  accent="science" />
          <StatBadge label="CGM"   value={customer.stats.cgm}  accent="wellness" />
          <StatBadge label="Pulse" value={customer.stats.pulse?.status === "active" ? 1 : 0} accent="amber" suffix={customer.stats.pulse?.status === "active" ? "✓" : "—"} />
          {customer.stats.leads > 0 && <StatBadge label="Lead" value={customer.stats.leads} accent="rose" />}
        </div>
      </Link>

      {manageMode ? (
        <button
          onClick={onDelete}
          title="ลบลูกค้านี้"
          className="rounded-lg border border-status-danger/30 bg-white px-3 py-1.5 text-[12px] font-semibold text-status-danger transition-all hover:bg-status-danger hover:text-white hover:border-status-danger"
        >
          🗑 ลบ
        </button>
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full text-ink-20 transition-all duration-200 group-hover:bg-rose group-hover:text-white group-hover:translate-x-1">
          →
        </div>
      )}
    </div>
  );
}

function computeAgeQuick(iso: string): number | null {
  const b = new Date(iso); if (isNaN(b.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const md = now.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

function StatBadge({ label, value, accent, suffix }: {
  label: string; value: number; accent: keyof typeof ACCENT; suffix?: string;
}) {
  const active = value > 0;
  const a = ACCENT[accent];
  return (
    <div className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold transition-all ${
      active
        ? `${a.bg} ${a.text} ring-1 ring-inset ring-current/10`
        : "bg-ink-5 text-ink-30"
    }`}>
      <span>{label}</span>
      <span className={active ? "" : "opacity-60"}>{suffix ?? value}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────── */
/* Skeleton + Empty                                     */
/* ──────────────────────────────────────────────────── */

function SkeletonList() {
  return (
    <div className="divide-y divide-ink-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="h-11 w-11 rounded-full bg-ink-5 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-ink-5 animate-pulse" />
            <div className="h-2.5 w-24 rounded bg-ink-5 animate-pulse" />
          </div>
          <div className="hidden md:flex gap-1.5">
            <div className="h-5 w-12 rounded bg-ink-5 animate-pulse" />
            <div className="h-5 w-12 rounded bg-ink-5 animate-pulse" />
            <div className="h-5 w-12 rounded bg-ink-5 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  search, filter, onClear, onCreate,
}: {
  search: string;
  filter: FilterKey;
  onClear: () => void;
  onCreate: () => void;
}) {
  const hasFilter = !!search || filter !== "all";
  return (
    <div className="px-6 py-20 text-center">
      <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-ultra to-amber-ultra text-3xl ring-1 ring-rose-pale/60">
        {hasFilter ? "🔍" : "👥"}
      </div>
      <div className="mt-5 font-head text-[20px] font-extrabold text-ink">
        {hasFilter ? "ไม่พบลูกค้าที่ตรงเงื่อนไข" : "ยังไม่มีลูกค้า"}
      </div>
      <p className="mt-2 max-w-sm mx-auto font-thai text-[13px] text-ink-60">
        {hasFilter
          ? "ลองล้างคำค้นหรือเปลี่ยน filter · หรือเริ่มต้นใหม่"
          : "เริ่มต้นด้วยการเพิ่มลูกค้าคนแรก · จากนั้นเชื่อม BCA · CGM · Wearable เพื่อ track journey"}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {hasFilter && (
          <button onClick={onClear} className="rounded-full border border-ink-10 bg-white px-4 py-1.5 text-[12px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink">
            ล้าง filter
          </button>
        )}
        <Button variant="rose" size="sm" onClick={onCreate}>+ เพิ่มลูกค้าใหม่</Button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────── */
/* Delete confirmation modal                            */
/* ──────────────────────────────────────────────────── */

function DeleteConfirmModal({
  customer, deleting, error, onCancel, onConfirm,
}: {
  customer: CustomerRow;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const hasData = customer.stats.bca > 0 || customer.stats.cgm > 0 || !!customer.stats.pulse || customer.stats.leads > 0;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-sm md:items-center" onClick={onCancel}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-ink-10 px-6 py-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-status-danger font-bold">⚠ Delete Customer</div>
          <div className="mt-1 font-head text-lg font-extrabold tracking-tight text-ink">ลบลูกค้านี้?</div>
        </div>
        <div className="space-y-3 px-6 py-5 font-thai text-sm text-ink-80">
          <p>คุณกำลังจะลบ <b className="text-ink">{customer.name}</b> ออกจากระบบ</p>
          {hasData && (
            <div className="rounded-xl border border-amber-pale bg-amber-ultra px-4 py-3 text-[13px] text-amber">
              ⚠ ลูกค้านี้มีข้อมูลในระบบ:
              <ul className="mt-1.5 ml-4 list-disc space-y-0.5">
                {customer.stats.bca > 0   && <li>BCA {customer.stats.bca} รายการ</li>}
                {customer.stats.cgm > 0   && <li>CGM {customer.stats.cgm} reading</li>}
                {customer.stats.pulse     && <li>Pulse connection ({customer.stats.pulse.provider})</li>}
                {customer.stats.leads > 0 && <li>Lead history {customer.stats.leads} รายการ</li>}
              </ul>
              <div className="mt-1.5">การลบนี้อาจ fail ถ้า DB มี FK constraint · ถ้า fail ให้ลบข้อมูลย่อยก่อน</div>
            </div>
          )}
          <p className="text-ink-60 text-[13px]">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
          {error && <div className="rounded-xl bg-status-bg-danger px-3 py-2 text-[13px] text-status-danger">{error}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-ink-10 bg-surface px-6 py-3">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={deleting}>ยกเลิก</Button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-xl bg-status-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90"
          >
            {deleting ? "กำลังลบ..." : "ลบลูกค้านี้"}
          </button>
        </div>
      </div>
    </div>
  );
}
