"use client";

/**
 * UP Labs v2 · Admin Users manager (clinical-warm)
 * ─────────────────────────────────────────────────
 * Redesign of v1 UsersTable: page header + create button, search by email/name,
 * role filter chips, and a responsive list (table on lg+, stacked cards on
 * mobile via the same UserRow). Reuses v1 server actions through the children.
 */

import { useState } from "react";
import { Search, Users, X, ShieldCheck } from "lucide-react";
import { IconChip, EmptyState } from "@/lib/v2/ui";
import { ROLE_LABEL_TH, type Role } from "@/lib/auth/roles";
import type { UserListRow, AssignableCustomer } from "@/app/admin/users/actions";
import { UserRow } from "./UserRow";
import { NewUserButton } from "./NewUserButton";

const FILTERS: ("all" | Role)[] = ["all", "admin", "abo", "member", "other"];

export function UsersManager({
  users, allCustomers, userCount,
}: {
  users: UserListRow[];
  allCustomers: AssignableCustomer[];
  userCount: number;
}) {
  const [filter, setFilter] = useState<"all" | Role>("all");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = users.filter((u) => {
    if (filter !== "all" && u.role !== filter) return false;
    if (q) return Boolean(u.email?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q));
    return true;
  });

  return (
    <>
      {/* Page header (SPEC §6: title + short description + primary action) */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconChip icon={ShieldCheck} tone="amber" size={18} className="h-9 w-9" />
          <div>
            <h1 className="font-head text-[23px] font-extrabold tracking-tight text-ink">จัดการผู้ใช้</h1>
            <p className="mt-0.5 font-thai text-[13px] text-ink-60">
              {userCount} ผู้ใช้ · จัดการ role · email · password reset · app grants · co-coach
            </p>
          </div>
        </div>
        <NewUserButton />
      </div>

      {/* Toolbar: search + role filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} strokeWidth={2.25} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-30" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหา email หรือชื่อ…"
            aria-label="ค้นหาผู้ใช้"
            className="w-full rounded-full border border-ink-10 bg-white py-2.5 pl-10 pr-9 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:ring-2 focus:ring-rose-ultra"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="ล้างคำค้น"
              className="absolute right-1.5 top-1/2 inline-flex h-[40px] w-[40px] -translate-y-1/2 items-center justify-center rounded-full text-ink-60 hover:bg-ink-5 hover:text-ink"
            >
              <X size={16} strokeWidth={2.5} aria-hidden />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-ink-10 bg-white p-1">
          {FILTERS.map((r) => {
            const active = filter === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setFilter(r)}
                aria-pressed={active}
                className={`min-h-[36px] rounded-full px-3 py-1 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 ${
                  active ? "bg-ink text-white" : "text-ink-60 hover:text-ink"
                }`}
              >
                {r === "all" ? "ทั้งหมด" : ROLE_LABEL_TH[r]}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-ink-10 bg-white shadow-[0_1px_2px_rgba(24,21,26,0.04)]">
        {/* Column header (lg+ only — the list reads as cards on mobile) */}
        <div className="hidden grid-cols-[minmax(0,1fr)_140px_180px_120px_96px] items-center gap-3 border-b border-ink-5 bg-surface/60 px-4 py-2.5 lg:grid lg:px-5">
          <HeaderCell>ผู้ใช้</HeaderCell>
          <HeaderCell>Role</HeaderCell>
          <HeaderCell>สิทธิ์แอป &amp; ลูกค้า</HeaderCell>
          <HeaderCell>เข้าระบบล่าสุด</HeaderCell>
          <HeaderCell className="text-right">จัดการ</HeaderCell>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={query ? Search : Users}
            title={query || filter !== "all" ? "ไม่พบผู้ใช้ที่ตรงเงื่อนไข" : "ยังไม่มีผู้ใช้"}
            hint={query || filter !== "all" ? "ลองเปลี่ยนคำค้นหรือตัวกรอง role" : "กดปุ่ม “เพิ่มผู้ใช้ใหม่” เพื่อเริ่มต้น"}
          />
        ) : (
          <ul className="divide-y divide-ink-5">
            {filtered.map((u) => (
              <UserRow key={u.id} user={u} allCustomers={allCustomers} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function HeaderCell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-[11px] font-semibold uppercase tracking-wide text-ink-40 ${className}`}>{children}</div>;
}
