import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { APPS, appsByAudience, type AppMeta } from "@/lib/apps-registry";
import { canAccessApp } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { Logo } from "@/components/ui/Logo";
import { UserMenu } from "@/components/ui/UserMenu";
import { HubStatsCard, HubStatsSkeleton } from "./_components/HubStatsCard";

export const dynamic = "force-dynamic";

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function bangkokNow(): Date {
  // server-safe Bangkok time (UTC+7)
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}

function greeting(): { hello: string; emoji: string } {
  const h = bangkokNow().getUTCHours();
  if (h < 5)  return { hello: "ดึกแล้วนะ", emoji: "🌙" };
  if (h < 11) return { hello: "อรุณสวัสดิ์", emoji: "☀️" };
  if (h < 13) return { hello: "สวัสดีตอนเที่ยง", emoji: "🌤" };
  if (h < 17) return { hello: "สวัสดีตอนบ่าย", emoji: "🌿" };
  if (h < 20) return { hello: "สวัสดีตอนเย็น", emoji: "🌅" };
  return { hello: "สวัสดียามค่ำ", emoji: "🌙" };
}

function thaiDate(): string {
  const d = bangkokNow();
  return `${d.getUTCDate()} ${TH_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`;
}

export default async function UPMenu() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { profile, grantedAppSlugs } = session;
  const canSee = (app: AppMeta) => canAccessApp(profile.role, app.allowedRoles, grantedAppSlugs, app.slug);

  const customerApps = appsByAudience("customer").filter(canSee);
  const businessApps = appsByAudience("business").filter(canSee);
  const internalApps = appsByAudience("internal").filter(canSee);
  const contentApps  = appsByAudience("content").filter(canSee);
  const visibleCount = customerApps.length + businessApps.length + internalApps.length + contentApps.length;

  const isAdmin   = profile.role === "admin";
  const statsCoachId = isAdmin ? null : session.user.id;
  const g = greeting();
  const dateLine = thaiDate();

  return (
    <main className="relative min-h-screen overflow-hidden bg-warm-white">
      <BgMesh />

      {/* ── Header ────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-ink-10/60 bg-warm-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-6 lg:px-10">
          <Logo size="md" />
          <div className="flex items-center gap-4">
            <span className="hidden md:inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-40">
              <span className="relative h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-status-optimal" />
                <span className="absolute inset-0 rounded-full bg-status-optimal animate-ping opacity-70" />
              </span>
              All systems operational
            </span>
            <UserMenu profile={profile} />
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────── */}
      <section className="relative mx-auto max-w-content px-6 lg:px-10 pt-16 pb-10 lg:pt-24 lg:pb-16">
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-14 items-end">
          <div>
            <div className="mb-6 flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-rose/20 bg-rose-ultra px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-rose">
                <span className="text-base leading-none">{g.emoji}</span>
                {dateLine}
              </span>
              <span className="font-mono text-[10px] text-ink-40">UP Wellness Ops · v2026</span>
            </div>
            <h1 className="font-head font-extrabold leading-[1.02] tracking-[-2.5px] text-ink text-[clamp(44px,6.5vw,82px)]">
              {g.hello},
              <br />
              <span className="bg-gradient-to-br from-rose-deep via-rose to-amber bg-clip-text text-transparent">
                {profile.display_name ?? "Wellness Partner"}
              </span>
            </h1>
            <p className="mt-7 max-w-xl font-thai text-[16px] leading-[1.7] text-ink-60">
              Science-based · Longevity-first · เครื่องมือสำหรับนักธุรกิจสุขภาพมืออาชีพ —
              เปิด {visibleCount} apps พร้อมใช้งาน
            </p>

            {/* Quick actions */}
            <div className="mt-9 flex flex-wrap gap-2.5">
              <QuickAction href="/customers" label="ลูกค้า" icon="👥" />
              <QuickAction href="/bca"       label="BCA"    icon="📊" />
              <QuickAction href="/nutriscan" label="NutriScan" icon="🥗" />
              <QuickAction href="/designer"  label="Designer" icon="🎨" />
            </div>
          </div>

          {/* Stats glass card — streamed via Suspense · cached 60s */}
          <Suspense fallback={<HubStatsSkeleton />}>
            <HubStatsCard coachId={statsCoachId} role={profile.role} />
          </Suspense>
        </div>
      </section>

      {/* ── Business / Featured Bento ──────────────────── */}
      {businessApps.length > 0 && (
        <section className="relative mx-auto max-w-content px-6 lg:px-10 py-12 lg:py-20">
          <SectionHeader
            number="01"
            label="For Wellness Partners"
            title="เครื่องมือสำหรับนักธุรกิจ"
            description="คุณคือผู้เชี่ยวชาญ · เรามีเครื่องมือให้คุณส่งมอบคุณค่าให้ลูกค้าอย่างมีหลักฐาน"
            dot="bg-rose"
            accent="text-rose"
          />
          <BentoGrid apps={businessApps} />
        </section>
      )}

      {/* ── Customer-facing ─────────────────────────────── */}
      {customerApps.length > 0 && (
        <section className="relative mx-auto max-w-content px-6 lg:px-10 py-12 lg:py-16">
          <SectionHeader
            number="02"
            label="Customer-facing"
            title="สำหรับลูกค้า"
            description="แอปประเมินสุขภาพที่ส่งลิงก์ให้ prospect ทำเองได้ — เก็บ lead เข้าระบบอัตโนมัติ"
            dot="bg-science"
            accent="text-science"
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {customerApps.map((app) => <CompactCard key={app.slug} app={app} accent="science" />)}
          </div>
        </section>
      )}

      {/* ── Internal ─────────────────────────────────── */}
      {internalApps.length > 0 && (
        <section className="relative mx-auto max-w-content px-6 lg:px-10 py-12 lg:py-16">
          <SectionHeader
            number="03"
            label="Internal Tools"
            title="เครื่องมือภายใน"
            description="สำหรับทีมงานและที่ปรึกษาเภสัชกร"
            dot="bg-amber"
            accent="text-amber"
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {internalApps.map((app) => <CompactCard key={app.slug} app={app} accent="amber" />)}
          </div>
        </section>
      )}

      {/* ── Content Library ───────────────────────────── */}
      {contentApps.length > 0 && (
        <section className="relative mx-auto max-w-content px-6 lg:px-10 py-12 lg:py-20">
          <div className="rounded-3xl border border-ink-10 bg-gradient-to-br from-wellness-ultra via-warm-white to-rose-ultra p-8 lg:p-12">
            <div className="mb-6 flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-wellness" />
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-wellness-deep">Content Library</span>
            </div>
            <h3 className="mb-8 font-head text-[28px] lg:text-[32px] font-extrabold tracking-tight text-ink">บทความ &amp; เอกสาร</h3>
            <div className="grid gap-3 md:grid-cols-3">
              {contentApps.map((app) => <ContentCard key={app.slug} app={app} />)}
            </div>
          </div>
        </section>
      )}

      {visibleCount === 0 && (
        <section className="mx-auto max-w-content px-10 py-32 text-center">
          <div className="font-head text-2xl font-bold text-ink mb-3">ยังไม่มี app ที่เปิดให้คุณใช้งาน</div>
          <p className="font-thai text-sm text-ink-60">โปรดติดต่อ admin เพื่อขอสิทธิ์การใช้งาน</p>
        </section>
      )}

      {/* ── Footer ────────────────────────────────────── */}
      <footer className="relative mt-20 bg-ink py-16 text-white/60">
        <div className="mx-auto max-w-content px-6 lg:px-10">
          <div className="grid gap-10 pb-12 md:grid-cols-[2fr_1fr_1fr] border-b border-white/10">
            <div>
              <Logo size="lg" inverted />
              <p className="mt-6 max-w-sm font-thai text-sm leading-[1.8] text-white/40">
                UP Wellness Ops — Science-based · Human-centered · Evidence-first
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-white/60">
                <span className="relative h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-status-optimal" />
                  <span className="absolute inset-0 rounded-full bg-status-optimal animate-ping opacity-70" />
                </span>
                System operational
              </div>
            </div>
            <div>
              <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">Platform</div>
              <ul className="space-y-2 text-sm text-white/50">
                <li>v2.0 · 2026</li>
                <li>{APPS.length} applications</li>
                <li>{visibleCount} เปิดอยู่</li>
              </ul>
            </div>
            <div>
              <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">Contact</div>
              <ul className="space-y-2 text-sm text-white/50">
                <li>hello@upwellness.co</li>
                <li>tonpalearn.netlify.app</li>
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-6 font-mono text-[11px] text-white/30">
            <span>UP Wellness Ops · v2.0 · {dateLine}</span>
            <span>upwellness.vercel.app</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ──────────────────────────────────────────────────── */
/* Decorative animated mesh background                 */
/* ──────────────────────────────────────────────────── */

function BgMesh() {
  return (
    <>
      <style>{`
        @keyframes mesh-drift-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-30px) scale(1.05); } }
        @keyframes mesh-drift-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-30px,20px) scale(0.95); } }
        @keyframes mesh-drift-c { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(20px,30px) scale(1.08); } }
        .mesh-a { animation: mesh-drift-a 18s ease-in-out infinite; }
        .mesh-b { animation: mesh-drift-b 22s ease-in-out infinite; }
        .mesh-c { animation: mesh-drift-c 26s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .mesh-a, .mesh-b, .mesh-c { animation: none; }
        }
      `}</style>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[800px] overflow-hidden">
        <div className="mesh-a absolute -top-32 -left-20 h-[460px] w-[460px] rounded-full bg-rose-pale/55 blur-[120px]" />
        <div className="mesh-b absolute top-20 right-0 h-[420px] w-[420px] rounded-full bg-amber-pale/60 blur-[120px]" />
        <div className="mesh-c absolute top-72 left-1/3 h-[520px] w-[520px] rounded-full bg-wellness-pale/55 blur-[140px]" />
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────── */
/* Atoms                                                */
/* ──────────────────────────────────────────────────── */

function QuickAction({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link href={href as any} className="group inline-flex items-center gap-2 rounded-full border border-ink-10 bg-white/80 px-4 py-2 text-sm font-semibold text-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-rose hover:shadow-[0_10px_24px_-12px_rgba(140,76,76,0.35)] hover:text-rose">
      <span className="text-base leading-none transition-transform duration-300 group-hover:scale-110">{icon}</span>
      <span className="font-thai">{label}</span>
      <span className="text-[11px] text-ink-30 transition-all group-hover:translate-x-0.5 group-hover:text-rose">→</span>
    </Link>
  );
}

const accentDot = {
  rose:     "bg-rose",
  wellness: "bg-wellness",
  amber:    "bg-amber",
  science:  "bg-science",
} as const;

const accentText = {
  rose:     "text-rose",
  wellness: "text-wellness",
  amber:    "text-amber",
  science:  "text-science",
} as const;

/* ──────────────────────────────────────────────────── */
/* Section header                                       */
/* ──────────────────────────────────────────────────── */

function SectionHeader({ number, label, title, description, dot, accent }: {
  number: string; label: string; title: string; description: string;
  dot: string; accent: string;
}) {
  return (
    <div className="mb-10 lg:mb-12 grid items-end gap-6 md:grid-cols-[1fr_auto]">
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="font-mono text-[11px] text-ink-40">{number}</span>
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${accent}`}>{label}</span>
        </div>
        <h2 className="font-thai text-[32px] lg:text-[40px] font-extrabold leading-tight tracking-tight text-ink">{title}</h2>
      </div>
      <p className="font-thai text-[14px] lg:text-[15px] leading-[1.7] text-ink-60 max-w-md md:text-right">{description}</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────── */
/* Bento grid — featured + tiles                        */
/* ──────────────────────────────────────────────────── */

function BentoGrid({ apps }: { apps: AppMeta[] }) {
  // Prefer "customers" as the hero card, else the first live business app
  const liveApps = apps.filter((a) => a.status !== "soon");
  const hero =
    liveApps.find((a) => a.slug === "customers")
    ?? liveApps[0]
    ?? apps[0];
  const rest = apps.filter((a) => a.slug !== hero?.slug);

  return (
    <div className="grid gap-4 lg:gap-5 md:grid-cols-2 lg:grid-cols-12 auto-rows-[minmax(0,1fr)]">
      {hero && (
        <BentoFeatured app={hero} className="lg:col-span-7 lg:row-span-2" />
      )}
      {rest.map((app, i) => (
        <BentoTile
          key={app.slug}
          app={app}
          className={
            // First three after the hero stack: 5 / 5 / 5 in different rows of the 12-col grid
            i === 0 ? "lg:col-span-5" :
            i === 1 ? "lg:col-span-5" :
            i === 2 ? "lg:col-span-4" :
            i === 3 ? "lg:col-span-4" :
            i === 4 ? "lg:col-span-4" :
            "lg:col-span-4"
          }
        />
      ))}
    </div>
  );
}

function BentoFeatured({ app, className }: { app: AppMeta; className?: string }) {
  const disabled = app.status === "soon";
  const inner = (
    <div className={`group relative h-full overflow-hidden rounded-3xl border border-ink-10 bg-white p-7 lg:p-9 transition-all duration-300 ${disabled ? "opacity-60" : "hover:-translate-y-1 hover:shadow-[0_24px_60px_-24px_rgba(140,76,76,0.28)] hover:border-rose/30"}`}>
      {/* Decorative gradient corner */}
      <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-rose-pale/70 via-amber-pale/40 to-transparent blur-2xl transition-opacity duration-500 group-hover:opacity-100 opacity-80" />
      <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-rose via-amber to-wellness opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex flex-col h-full">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
            ⭐ Featured
          </span>
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-40">{statusLabel(app.status)}</span>
        </div>

        <div className="mt-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-ultra to-amber-ultra text-3xl shadow-[0_8px_20px_-8px_rgba(140,76,76,0.25)] ring-1 ring-rose-pale/60">
          {app.icon}
        </div>

        <h3 className="mt-6 font-head text-[28px] lg:text-[32px] font-extrabold leading-[1.1] tracking-tight text-ink">{app.name}</h3>
        <p className="mt-3 max-w-md font-thai text-[14px] lg:text-[15px] leading-[1.7] text-ink-60">{app.description}</p>

        <div className="mt-auto pt-8 flex items-center justify-between">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-rose">เปิด app</span>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-10 bg-white text-ink-40 transition-all duration-300 group-hover:border-rose group-hover:bg-rose group-hover:text-white group-hover:translate-x-1">
            →
          </div>
        </div>
      </div>
    </div>
  );

  return disabled ? <div className={className}>{inner}</div> : <Link href={app.href as any} className={className}>{inner}</Link>;
}

function BentoTile({ app, className }: { app: AppMeta; className?: string }) {
  const disabled = app.status === "soon";
  const inner = (
    <div className={`group relative h-full overflow-hidden rounded-2xl border border-ink-10 bg-white p-6 transition-all duration-200 ${disabled ? "opacity-60" : "hover:-translate-y-0.5 hover:border-rose/40 hover:shadow-[0_16px_36px_-18px_rgba(140,76,76,0.22)]"}`}>
      <div className="absolute top-0 left-0 h-0.5 w-full bg-gradient-to-r from-rose via-amber to-wellness opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-ultra text-xl ring-1 ring-rose-pale/60 transition-all duration-300 group-hover:scale-105">
          {app.icon}
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-40 font-bold">{statusLabel(app.status)}</span>
      </div>
      <h3 className="mt-5 font-head text-[18px] font-bold tracking-tight text-ink">{app.name}</h3>
      <p className="mt-1.5 font-thai text-[13px] leading-[1.6] text-ink-60 line-clamp-2">{app.description}</p>
      <div className="mt-5 flex items-center gap-1 font-mono text-[11px] font-bold text-rose">
        เปิด
        <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
      </div>
    </div>
  );
  return disabled ? <div className={className}>{inner}</div> : <Link href={app.href as any} className={className}>{inner}</Link>;
}

/* ──────────────────────────────────────────────────── */
/* Compact card (customer + internal sections)          */
/* ──────────────────────────────────────────────────── */

function CompactCard({ app, accent }: { app: AppMeta; accent: keyof typeof accentDot }) {
  const disabled = app.status === "soon";
  const bgMap = {
    rose:     "bg-rose-ultra",
    wellness: "bg-wellness-ultra",
    amber:    "bg-amber-ultra",
    science:  "bg-science-ultra",
  } as const;

  const card = (
    <div className={`group relative h-full overflow-hidden rounded-2xl border border-ink-10 bg-white p-5 transition-all duration-200 ${disabled ? "opacity-60" : "hover:-translate-y-0.5 hover:border-ink-20 hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.12)]"}`}>
      <div className={`absolute top-0 left-0 h-0.5 w-full ${accentDot[accent]} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bgMap[accent]} text-xl`}>
          {app.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-head text-[15px] font-bold tracking-tight text-ink truncate">{app.name}</h3>
          <p className="mt-0.5 font-thai text-[12px] leading-[1.5] text-ink-60 line-clamp-1">{app.description}</p>
        </div>
        <span className={`font-mono text-[10px] font-bold ${accentText[accent]} transition-transform group-hover:translate-x-0.5`}>
          {app.status === "soon" ? "Soon" : "→"}
        </span>
      </div>
    </div>
  );

  return disabled ? <div className="h-full">{card}</div> : <Link href={app.href as any} className="h-full block">{card}</Link>;
}

function ContentCard({ app }: { app: AppMeta }) {
  const disabled = app.status === "soon";
  const inner = (
    <div className={`group flex items-center gap-4 rounded-2xl bg-white p-4 transition-all duration-200 ${disabled ? "opacity-60" : "hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(0,0,0,0.12)]"}`}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-wellness-ultra text-xl ring-1 ring-wellness-pale">{app.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-head text-sm font-bold text-ink truncate">{app.name}</div>
        <div className="font-thai text-xs text-ink-60 line-clamp-1">{app.description}</div>
      </div>
      <span className="text-ink-20 transition-transform group-hover:translate-x-0.5">{app.status === "soon" ? "Soon" : "›"}</span>
    </div>
  );
  return disabled ? <div>{inner}</div> : <Link href={app.href as any}>{inner}</Link>;
}

function statusLabel(s: AppMeta["status"]): string {
  return s === "live" ? "live" : s === "beta" ? "beta" : "soon";
}
