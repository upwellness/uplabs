"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { ROLE_LABEL_TH, ROLE_COLOR } from "@/lib/auth/roles";
import type { SessionProfile } from "@/lib/auth/session";

export function UserMenu({ profile }: { profile: SessionProfile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = (profile.display_name ?? profile.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 rounded-full border border-ink-10 bg-white px-2 py-1.5 transition-all hover:border-ink-20"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose text-[11px] font-bold text-white">{initials}</div>
        <div className="text-left pr-2 hidden sm:block">
          <div className="text-[12px] font-semibold leading-none text-ink">{profile.display_name ?? "ผู้ใช้"}</div>
          <div className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${ROLE_COLOR[profile.role]}`}>
            {ROLE_LABEL_TH[profile.role]}
          </div>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-ink-10 bg-white shadow-xl overflow-hidden">
          <div className="border-b border-ink-10 bg-surface px-4 py-3">
            <div className="font-head text-sm font-bold text-ink truncate">{profile.display_name ?? "ผู้ใช้"}</div>
            <div className="font-mono text-[11px] text-ink-40 truncate">{profile.email ?? "no email"}</div>
          </div>
          <div className="p-1">
            <Link href="/forgot-password" className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-ink-5">
              เปลี่ยน password
            </Link>
            {profile.role === "admin" && (
              <Link href="/admin/users" className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-ink-5">
                Admin · จัดการผู้ใช้
              </Link>
            )}
          </div>
          <form action={signOut} className="border-t border-ink-10 p-1">
            <button className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose hover:bg-rose-ultra">
              ออกจากระบบ
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
