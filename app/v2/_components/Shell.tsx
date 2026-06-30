"use client";

/**
 * UP Labs v2 · App Shell (SPEC §6 — persistent nav)
 * ─────────────────────────────────────────────────
 * Top bar used by every /v2 page:
 *   - Logo "UP Labs"
 *   - App switcher (reach the main apps from anywhere — no need to return Hub)
 *   - Breadcrumb area
 *   - User / role indicator
 * Clinical-warm: solid warm-white bar, soft border, Lucide icons. No glass, no aurora.
 *
 * The switcher links to v2 surfaces where they exist (home/customers/bca) and to the
 * live v1 apps otherwise; every target enforces its own auth/RBAC, so the shell does
 * not need the session to render.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  LayoutGrid, Users, Scale, ChevronDown, ChevronRight,
  Home, Activity, ExternalLink, X,
  HeartPulse, ClipboardList, Target, Stethoscope, Salad, UtensilsCrossed, Wand2, MessageCircle, Shield,
} from "lucide-react";
import { APPS } from "@/lib/apps-registry";
import { ROLE_LABEL_TH, type Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

export interface ShellProfile {
  display_name?: string | null;
  email?: string | null;
  role?: Role | null;
}

/** Quick links shown at the top of the switcher — v2 surfaces that exist today. */
const V2_LINKS: { href: string; label: string; icon: typeof Users; adminOnly?: boolean }[] = [
  { href: "/v2", label: "หน้าแรก v2", icon: Home },
  { href: "/v2/customers", label: "ลูกค้า", icon: Users },
  { href: "/v2/bca", label: "BCA Tracker", icon: Scale },
  { href: "/v2/pulse", label: "UP Pulse", icon: HeartPulse },
  { href: "/v2/checkform", label: "Check Form", icon: ClipboardList },
  { href: "/v2/prospects", label: "Prospect List", icon: Target },
  { href: "/v2/healthcheck", label: "Health Check (leads)", icon: Stethoscope },
  { href: "/v2/nutriscan", label: "NutriScan", icon: Salad },
  { href: "/v2/plate-planner", label: "Plate Planner", icon: UtensilsCrossed },
  { href: "/v2/designer", label: "Program Designer", icon: Wand2 },
  { href: "/v2/line-bot", label: "LINE Bot", icon: MessageCircle },
  { href: "/v2/admin/users", label: "Admin · ผู้ใช้", icon: Shield, adminOnly: true },
];

function initialsOf(name?: string | null, email?: string | null): string {
  const src = (name || email || "?").trim();
  return src.slice(0, 2).toUpperCase();
}

export function Shell({
  breadcrumb = [],
  profile,
  children,
  actions,
}: {
  breadcrumb?: Crumb[];
  profile?: ShellProfile;
  children: React.ReactNode;
  /** optional right-aligned page actions rendered in the bar */
  actions?: React.ReactNode;
}) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  // Close switcher on outside click / Escape
  useEffect(() => {
    if (!switcherOpen) return;
    const onClick = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) setSwitcherOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSwitcherOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [switcherOpen]);

  const liveApps = APPS.filter((a) => a.status !== "soon");

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-warm-white">
        <div className="mx-auto flex h-14 max-w-content items-center gap-3 px-4 lg:px-8">
          {/* Logo */}
          <Link href="/v2" className="flex items-center gap-2 font-head font-extrabold tracking-tight text-ink">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-rose text-white">
              <Activity size={16} strokeWidth={2.5} aria-hidden />
            </span>
            <span className="text-[16px]">UP&nbsp;Labs</span>
          </Link>

          {/* App switcher */}
          <div className="relative" ref={switcherRef}>
            <button
              type="button"
              onClick={() => setSwitcherOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={switcherOpen}
              aria-label="สลับแอป"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink-60 transition-colors hover:border-ink-20 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
            >
              <LayoutGrid size={14} strokeWidth={2.25} aria-hidden />
              <span className="hidden sm:inline">แอป</span>
              <ChevronDown size={13} strokeWidth={2.5} className={cn("transition-transform", switcherOpen && "rotate-180")} aria-hidden />
            </button>

            {switcherOpen && (
              <div
                role="menu"
                aria-label="รายการแอป"
                className="absolute left-0 top-full z-50 mt-2 max-h-[70vh] w-[320px] overflow-y-auto rounded-2xl border border-ink-10 bg-white p-2 shadow-[0_20px_50px_-20px_rgba(24,21,26,0.35)]"
              >
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-40">UP Labs v2</span>
                  <button type="button" onClick={() => setSwitcherOpen(false)} aria-label="ปิด" className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-ink-60 hover:bg-ink-5 hover:text-ink">
                    <X size={16} strokeWidth={2.25} aria-hidden />
                  </button>
                </div>
                {V2_LINKS.filter((l) => !l.adminOnly || profile?.role === "admin").map((l) => (
                  <Link
                    key={l.href}
                    href={l.href as any}
                    role="menuitem"
                    onClick={() => setSwitcherOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-rose-ultra"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-rose-ultra text-rose">
                      <l.icon size={15} strokeWidth={2} aria-hidden />
                    </span>
                    {l.label}
                  </Link>
                ))}

                <div className="my-1.5 border-t border-ink-5" />
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-40">แอปทั้งหมด (เวอร์ชันปัจจุบัน)</div>
                <div className="grid grid-cols-1 gap-0.5">
                  {liveApps.map((a) => {
                    const external = a.href.startsWith("http");
                    const inner = (
                      <span className="flex items-center gap-2.5">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-5 text-[13px]">{a.icon}</span>
                        <span className="min-w-0 flex-1 truncate">{a.name}</span>
                        {external && <ExternalLink size={12} strokeWidth={2.25} className="shrink-0 text-ink-30" aria-hidden />}
                      </span>
                    );
                    const cls = "rounded-xl px-2 py-1.5 text-[13px] font-medium text-ink-80 transition-colors hover:bg-surface";
                    return external ? (
                      <a key={a.slug} href={a.href} target="_blank" rel="noopener noreferrer" role="menuitem" onClick={() => setSwitcherOpen(false)} className={cls}>
                        {inner}
                      </a>
                    ) : (
                      <Link key={a.slug} href={a.href as any} role="menuitem" onClick={() => setSwitcherOpen(false)} className={cls}>
                        {inner}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Breadcrumb */}
          <nav aria-label="breadcrumb" className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
            <ol className="flex min-w-0 items-center gap-1 text-[13px]">
              {breadcrumb.map((c, i) => (
                <li key={i} className="flex min-w-0 items-center gap-1">
                  {i > 0 && <ChevronRight size={13} strokeWidth={2.25} className="shrink-0 text-ink-30" aria-hidden />}
                  {c.href && i < breadcrumb.length - 1 ? (
                    <Link href={c.href as any} className="truncate text-ink-60 transition-colors hover:text-rose">{c.label}</Link>
                  ) : (
                    <span className={cn("truncate", i === breadcrumb.length - 1 ? "font-semibold text-ink" : "text-ink-60")} aria-current={i === breadcrumb.length - 1 ? "page" : undefined}>
                      {c.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          {/* Right side: page actions + user/role */}
          <div className="ml-auto flex items-center gap-2.5">
            {actions}
            <div className="flex items-center gap-2 rounded-full border border-ink-10 bg-white py-1 pl-1 pr-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-white">
                {initialsOf(profile?.display_name, profile?.email)}
              </span>
              <div className="hidden leading-tight sm:block">
                <div className="max-w-[140px] truncate text-[12px] font-semibold text-ink">{profile?.display_name ?? profile?.email ?? "ผู้ใช้"}</div>
                {profile?.role && <div className="text-[10px] text-ink-40">{ROLE_LABEL_TH[profile.role]}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile breadcrumb row */}
        {breadcrumb.length > 0 && (
          <div className="border-t border-ink-5 px-4 py-1.5 md:hidden">
            <ol className="flex items-center gap-1 overflow-x-auto text-[12px]">
              {breadcrumb.map((c, i) => (
                <li key={i} className="flex shrink-0 items-center gap-1">
                  {i > 0 && <ChevronRight size={12} strokeWidth={2.25} className="text-ink-30" aria-hidden />}
                  <span className={cn(i === breadcrumb.length - 1 ? "font-semibold text-ink" : "text-ink-60")}>{c.label}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </header>

      {/* ── Page content ── */}
      <main className="mx-auto max-w-content px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
