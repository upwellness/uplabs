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

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customers/list");
      const json = await res.json();
      setCustomers(json.customers ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

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
          <Button variant="rose" onClick={() => setShowNew(true)}>+ ลูกค้าใหม่</Button>
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
              {filtered.map((c) => <CustomerListItem key={c.id} customer={c} />)}
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
    </main>
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

function CustomerListItem({ customer }: { customer: CustomerRow }) {
  const age = customer.birth_year ? new Date().getFullYear() - customer.birth_year : null;
  const initials = customer.name.replace(/^(คุณ|นาย|นาง|น\.ส\.)\s?/, "").slice(0, 2).toUpperCase();
  return (
    <Link href={`/customers/${customer.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface transition-colors">
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
      <span className="text-ink-20">›</span>
    </Link>
  );
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
