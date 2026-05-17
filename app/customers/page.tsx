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

export default function CustomersListPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [showNew,   setShowNew]   = useState(false);
  const [filter,    setFilter]    = useState<"all" | "no_cgm" | "no_pulse" | "no_bca">("all");
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
    return list;
  }, [customers, search, filter]);

  const stats = useMemo(() => ({
    total:        customers.length,
    has_bca:      customers.filter((c) => c.stats.bca > 0).length,
    has_cgm:      customers.filter((c) => c.stats.cgm > 0).length,
    has_pulse:    customers.filter((c) => c.stats.pulse?.status === "active").length,
  }), [customers]);

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-10">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-ink-40 hover:text-ink transition-colors text-sm">← Hub</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-rose">
              Customer Profiles
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={manageMode ? "rose" : "outline"}
              size="sm"
              onClick={() => setManageMode((v) => !v)}
              title="เปิด/ปิดโหมดจัดการ — แสดงปุ่มลบในแต่ละแถว"
            >
              {manageMode ? "✓ Manage mode" : "🛠 Manage"}
            </Button>
            <Button variant="rose" onClick={() => setShowNew(true)}>+ ลูกค้าใหม่</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-content px-10 py-10">
        <h1 className="font-head text-[28px] font-extrabold tracking-tight text-ink">รายชื่อลูกค้า</h1>
        <p className="mt-1 font-thai text-sm text-ink-60">
          จัดการ profile · link ข้อมูลข้ามแอป (BCA · CGM · Wearable)
        </p>

        {/* Stats */}
        <section className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="ลูกค้าทั้งหมด" value={stats.total} />
          <Stat label="มี BCA"        value={stats.has_bca}   color="#2563EB" />
          <Stat label="Link CGM"      value={stats.has_cgm}   color="#9333EA" />
          <Stat label="Connect Pulse" value={stats.has_pulse} color="#16A34A" />
        </section>

        {/* Filters */}
        <section className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {([
              { v: "all",      label: "ทั้งหมด" },
              { v: "no_bca",   label: "❌ ยังไม่มี BCA" },
              { v: "no_cgm",   label: "❌ ยังไม่ link CGM" },
              { v: "no_pulse", label: "❌ ยังไม่ connect Pulse" },
            ] as const).map((f) => (
              <button key={f.v} onClick={() => setFilter(f.v)}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${
                  filter === f.v
                    ? "border-rose bg-rose text-white"
                    : "border-ink-10 bg-white text-ink-60 hover:border-ink-20"
                }`}>{f.label}</button>
            ))}
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 ค้นหา..."
            className="w-full sm:w-72 rounded-full border border-ink-10 bg-white px-4 py-2 text-sm outline-none focus:border-rose" />
        </section>

        {/* List */}
        <section className="mt-6 rounded-3xl border border-ink-10 bg-white p-2">
          {loading ? (
            <div className="py-16 text-center font-thai text-sm text-ink-40">กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center font-thai text-sm text-ink-40">ไม่มีลูกค้า</div>
          ) : (
            <div className="divide-y divide-ink-5">
              {filtered.map((c) => (
                <CustomerListItem
                  key={c.id}
                  customer={c}
                  manageMode={manageMode}
                  onDelete={() => { setDelError(null); setToDelete(c); }}
                />
              ))}
            </div>
          )}
        </section>
      </div>

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
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-status-danger">⚠ Delete Customer</div>
          <div className="mt-1 font-head text-lg font-extrabold tracking-tight text-ink">ลบลูกค้านี้?</div>
        </div>
        <div className="space-y-3 px-6 py-5 font-thai text-sm text-ink-80">
          <p>คุณกำลังจะลบ <b className="text-ink">{customer.name}</b> ออกจากระบบ</p>
          {hasData && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
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

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-2xl border border-ink-10 bg-white px-5 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-40">{label}</div>
      <div className="mt-1 font-head text-[28px] font-extrabold leading-none" style={{ color: color ?? "#1F1A1B" }}>{value}</div>
    </div>
  );
}

function CustomerListItem({
  customer, manageMode, onDelete,
}: {
  customer: CustomerRow;
  manageMode: boolean;
  onDelete: () => void;
}) {
  const ageFromDate = customer.birth_date ? computeAgeQuick(customer.birth_date) : null;
  const age = ageFromDate ?? (customer.birth_year ? new Date().getFullYear() - customer.birth_year : null);
  const initials = customer.name.replace(/^(คุณ|นาย|นาง|น\.ส\.)\s?/, "").slice(0, 2).toUpperCase();
  return (
    <div className="group flex items-center gap-4 px-4 py-3 hover:bg-surface transition-colors">
      <Link href={`/customers/${customer.id}`} className="flex flex-1 min-w-0 items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose text-[12px] font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-thai text-[15px] font-semibold text-ink truncate">{customer.name}</div>
          <div className="mt-0.5 font-mono text-[10px] text-ink-40">
            {customer.gender === "male" ? "ชาย" : customer.gender === "female" ? "หญิง" : "—"}
            {age && ` · ${age} ปี`}
            {customer.height && ` · ${customer.height}cm`}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <Badge label="BCA" value={customer.stats.bca} color="#2563EB" />
          <Badge label="CGM" value={customer.stats.cgm} color="#9333EA" />
          <Badge label="Pulse" value={customer.stats.pulse?.status === "active" ? 1 : 0} color="#16A34A" suffix={customer.stats.pulse?.status === "active" ? "✓" : "—"} />
          {customer.stats.leads > 0 && <Badge label="Leads" value={customer.stats.leads} color="#EAB308" />}
        </div>
      </Link>
      {manageMode ? (
        <button
          onClick={onDelete}
          title="ลบลูกค้านี้"
          className="rounded-lg border border-status-bg-danger bg-white px-2.5 py-1.5 text-[12px] font-semibold text-status-danger transition-all hover:bg-status-bg-danger"
        >
          🗑 ลบ
        </button>
      ) : (
        <span className="text-ink-20">›</span>
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

function Badge({ label, value, color, suffix }: { label: string; value: number; color: string; suffix?: string }) {
  const active = value > 0;
  return (
    <div className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-mono ${active ? "text-white" : "bg-ink-5 text-ink-40"}`}
      style={active ? { background: color } : undefined}>
      <span className="font-bold">{label}</span>
      <span>{suffix ?? value}</span>
    </div>
  );
}
