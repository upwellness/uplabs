"use client";

/**
 * UP Labs v2 · Customers list (SPEC §7.2)
 * ───────────────────────────────────────
 * Client-fetch /api/customers/list (same endpoint + scope as v1). Clinical-warm
 * rows: name + age + gender + health/data status + badges (BCA / CGM / Pulse / leads).
 * Search by name. Each row links to /v2/customers/[id].
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users, ChevronRight, X, RotateCw } from "lucide-react";
import { Shell } from "../_components/Shell";
import { LoadingState, EmptyState, ErrorState } from "@/lib/v2/ui";
import { resolveAge, genderLabelWithGlyph, initials } from "@/lib/v2/identity";
import type { StatusLevel } from "@/lib/medical-status";
import { statusClasses, statusHex, STATUS_LABEL_TH } from "@/lib/medical-status";
import { statusTextClass } from "@/lib/v2/status";

interface CustomerRow {
  id: string;
  name: string;
  gender: string | null;
  birth_year: number | null;
  birth_date: string | null;
  height: number | null;
  cgm_profile_names: string[] | null;
  created_at: string;
  stats: {
    bca: number;
    cgm: number;
    pulse: { provider: string; status: string; last_sync_at: string | null } | null;
    leads: number;
  };
}

/**
 * Data-completeness → single status level. The list endpoint does not compute the
 * clinical health score (that lives in /360), so the list shows how complete each
 * profile is, mapped onto the SAME status tokens (one status system).
 */
function completenessLevel(c: CustomerRow): { level: StatusLevel; label: string; score: number } {
  const score =
    (c.stats.bca > 0 ? 1 : 0) +
    (c.stats.cgm > 0 ? 1 : 0) +
    (c.stats.pulse?.status === "active" ? 1 : 0);
  if (score === 3) return { level: "optimal", label: "ข้อมูลครบ", score };
  if (score === 2) return { level: "good", label: "เกือบครบ", score };
  if (score === 1) return { level: "caution", label: "เริ่มต้น", score };
  return { level: "warning", label: "ยังไม่มีข้อมูล", score };
}

export default function V2CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customers/list");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "โหลดรายชื่อลูกค้าไม่สำเร็จ");
      setCustomers(json.customers ?? []);
    } catch (e: any) {
      setError(e.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(s));
  }, [customers, search]);

  return (
    <Shell breadcrumb={[{ label: "หน้าแรก", href: "/v2" }, { label: "ลูกค้า" }]}>
      {/* Page header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-head text-[24px] font-extrabold tracking-tight text-ink">รายชื่อลูกค้า</h1>
          <p className="mt-1 font-thai text-[13px] text-ink-60">
            ดูแลลูกค้าตั้งแต่ lead จนถึง active partner · เชื่อมข้อมูล BCA · CGM · Wearable
          </p>
        </div>
        {!loading && !error && (
          <span className="rounded-full bg-ink-5 px-3 py-1 font-mono text-[11px] text-ink-60">
            {filtered.length === customers.length ? `${customers.length} คน` : `${filtered.length} / ${customers.length} คน`}
          </span>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search size={16} strokeWidth={2.25} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-30" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อลูกค้า…"
            aria-label="ค้นหาชื่อลูกค้า"
            className="w-full rounded-full border border-ink-10 bg-white py-2.5 pl-10 pr-9 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:ring-2 focus:ring-rose-ultra"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="ล้างคำค้น"
              className="absolute right-1.5 top-1/2 inline-flex h-[40px] w-[40px] -translate-y-1/2 items-center justify-center rounded-full text-ink-60 hover:bg-ink-5 hover:text-ink"
            >
              <X size={16} strokeWidth={2.5} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-ink-10 bg-white shadow-[0_1px_2px_rgba(24,21,26,0.04)]">
        {loading ? (
          <LoadingState label="กำลังโหลดรายชื่อลูกค้า…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={search ? Search : Users}
            title={search ? "ไม่พบลูกค้าที่ตรงคำค้น" : "ยังไม่มีลูกค้า"}
            hint={search ? "ลองเปลี่ยนคำค้นหา" : "เพิ่มลูกค้าได้ที่หน้าเวอร์ชันปัจจุบัน (Legacy) — v2 อ่านรายชื่อชุดเดียวกัน"}
            action={
              search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-1.5 text-[12px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink"
                >
                  <RotateCw size={13} strokeWidth={2.25} aria-hidden /> ล้างคำค้น
                </button>
              ) : (
                <Link href="/customers" className="inline-flex items-center gap-1.5 rounded-full bg-rose px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-mid">
                  ไปหน้า Legacy เพื่อเพิ่มลูกค้า
                </Link>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-ink-5">
            {filtered.map((c) => <CustomerRowItem key={c.id} c={c} />)}
          </ul>
        )}
      </div>
    </Shell>
  );
}

function CustomerRowItem({ c }: { c: CustomerRow }) {
  const age = resolveAge(c);
  const comp = completenessLevel(c);
  const ringColor = c.gender === "male" ? "ring-science-pale" : c.gender === "female" ? "ring-rose-pale" : "ring-ink-10";
  const avatarBg = c.gender === "male" ? "bg-science" : c.gender === "female" ? "bg-rose" : "bg-ink-60";

  // Compact data badges: which capabilities are present (count visible everywhere).
  const dataBadges = [
    { label: "BCA", on: c.stats.bca > 0, value: c.stats.bca, tone: "science" as const },
    { label: "CGM", on: c.stats.cgm > 0, value: c.stats.cgm, tone: "wellness" as const },
    { label: "Pulse", on: c.stats.pulse?.status === "active", value: c.stats.pulse?.status === "active" ? "✓" : "—", tone: "amber" as const },
    ...(c.stats.leads > 0 ? [{ label: "Lead", on: true, value: c.stats.leads, tone: "rose" as const }] : []),
  ];
  const activeBadgeCount = dataBadges.filter((b) => b.on).length;

  return (
    <li>
      <Link
        href={`/v2/customers/${c.id}`}
        className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface focus:outline-none focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose lg:px-5"
      >
        {/* Avatar */}
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${avatarBg} text-[13px] font-bold text-white ring-2 ${ringColor}`}>
          {initials(c.name)}
        </span>

        {/* Name + meta + (mobile) status */}
        <div className="min-w-0 flex-1">
          <div className="truncate font-head text-[15px] font-bold text-ink">{c.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-thai text-[12px] text-ink-60">
            <span>{genderLabelWithGlyph(c.gender)}</span>
            {age != null && <><span className="text-ink-20" aria-hidden>·</span><span>{age} ปี</span></>}
            {c.height != null && <><span className="text-ink-20" aria-hidden>·</span><span>{c.height} ซม.</span></>}
          </div>
          {/* Mobile-only status dot + label (wraps under the name) + compact badge count */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses.bg[comp.level]} ${statusTextClass[comp.level]}`}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusHex[comp.level] }} aria-hidden />
              {comp.label}
            </span>
            {activeBadgeCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ink-5 px-2 py-0.5 font-mono text-[10px] font-semibold text-ink-60">
                <span className="h-1.5 w-1.5 rounded-full bg-science" aria-hidden />
                {activeBadgeCount} ข้อมูล
              </span>
            )}
          </div>
        </div>

        {/* Health/data status pill (sm+) */}
        <span
          className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex ${statusClasses.bg[comp.level]} ${statusTextClass[comp.level]}`}
          title={`ความครบของข้อมูล ${comp.score}/3 · ${STATUS_LABEL_TH[comp.level]}`}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusHex[comp.level] }} aria-hidden />
          {comp.label}
        </span>

        {/* Full badges (md+) */}
        <div className="hidden shrink-0 items-center gap-1.5 md:flex">
          {dataBadges.map((b) => <Badge key={b.label} label={b.label} on={b.on} value={b.value} tone={b.tone} />)}
        </div>

        <ChevronRight size={18} strokeWidth={2.25} className="shrink-0 text-ink-20 transition-all group-hover:translate-x-0.5 group-hover:text-rose" aria-hidden />
      </Link>
    </li>
  );
}

const TONE_ON: Record<string, string> = {
  science: "bg-science-ultra text-science",
  wellness: "bg-wellness-ultra text-wellness",
  amber: "bg-amber-ultra text-amber",
  rose: "bg-rose-ultra text-rose",
};

function Badge({ label, on, value, tone }: { label: string; on: boolean; value: number | string; tone: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${on ? TONE_ON[tone] : "bg-ink-5 text-ink-60"}`}>
      <span>{label}</span>
      <span className={on ? "" : "opacity-70"}>{value}</span>
    </span>
  );
}
