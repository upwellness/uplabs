"use client";

import { useState, useTransition } from "react";
import { UserRow } from "./UserRow";
import { type UserListRow, type AssignableCustomer } from "./actions";
import type { Role } from "@/lib/auth/roles";

export function UsersTable({ users, allCustomers }: { users: UserListRow[]; allCustomers: AssignableCustomer[] }) {
  const [filter, setFilter] = useState<"all" | Role>("all");
  const [query, setQuery] = useState("");

  const filtered = users.filter((u) => {
    if (filter !== "all" && u.role !== filter) return false;
    if (query) {
      const q = query.toLowerCase();
      return (u.email?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="rounded-3xl border border-ink-10 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-10 px-6 py-4 bg-surface">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหา email หรือชื่อ..."
          className="flex-1 min-w-[200px] rounded-full border border-ink-10 bg-white px-4 py-2 text-sm outline-none focus:border-rose"
        />
        <div className="flex items-center gap-1 rounded-full bg-white p-1 border border-ink-10">
          {(["all", "admin", "abo", "member", "other"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                filter === r ? "bg-ink text-white" : "text-ink-60 hover:text-ink"
              }`}
            >
              {r === "all" ? "ทั้งหมด" : r}
            </button>
          ))}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-10 text-left">
            <Th>User</Th>
            <Th>Role</Th>
            <Th>App Grants</Th>
            <Th>Last sign in</Th>
            <Th align="right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((u) => (
            <UserRow key={u.id} user={u} allCustomers={allCustomers} />
          ))}
        </tbody>
      </table>

      {filtered.length === 0 && (
        <div className="py-16 text-center font-thai text-sm text-ink-40">ไม่พบ user ที่ตรงตามเงื่อนไข</div>
      )}
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-6 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-40 ${align === "right" ? "text-right" : ""}`}>
      {children}
    </th>
  );
}
