import Link from "next/link";
import { redirect } from "next/navigation";
import { APPS, appsByAudience, type AppMeta } from "@/lib/apps-registry";
import { canAccessApp } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { Logo } from "@/components/ui/Logo";
import { UserMenu } from "@/components/ui/UserMenu";

export const dynamic = "force-dynamic";

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

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-10">
          <Logo size="md" />
          <div className="flex items-center gap-4">
            <span className="hidden md:inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-40">
              <span className="h-1.5 w-1.5 rounded-full bg-status-optimal animate-pulse" />
              System operational
            </span>
            <UserMenu profile={profile} />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-content px-10 pt-20 pb-16">
        <div className="mb-7 flex items-center gap-3">
          <div className="h-px w-8 bg-rose" />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose">Health Intelligence Platform</span>
        </div>
        <h1 className="font-head text-[clamp(40px,5.5vw,68px)] font-extrabold leading-[1.04] tracking-[-2px] text-ink">
          สวัสดี, <span className="text-rose">{profile.display_name ?? "ผู้ใช้"}</span>
        </h1>
        <p className="mt-6 max-w-xl font-thai text-[16px] leading-[1.7] text-ink-60">
          คุณมีสิทธิ์เข้าใช้งาน <strong>{visibleCount}</strong> apps —
          เลือก app ที่ต้องการใช้งานด้านล่าง หรือดูเอกสารใน Content Library
        </p>

        <div className="mt-10 grid grid-cols-2 gap-x-12 gap-y-6 sm:grid-cols-4">
          <Stat label="Visible apps"  value={visibleCount.toString()} />
          <Stat label="Live"          value={APPS.filter(a => a.status === "live" && canSee(a)).length.toString()} />
          <Stat label="Your role"     value={profile.role.toUpperCase()} />
          <Stat label="Version"       value="2026.1" />
        </div>
      </section>

      <Divider />

      {customerApps.length > 0 && (<>
        <AudienceSection number="01" title="สำหรับลูกค้า" subtitle="Customer-facing" description="แอปประเมินและติดตามสุขภาพที่ลูกค้าใช้ได้ด้วยตัวเอง" accent="science" apps={customerApps} />
        <Divider />
      </>)}

      {businessApps.length > 0 && (<>
        <AudienceSection number="02" title="สำหรับนักธุรกิจ" subtitle="For Wellness Partners" description="เครื่องมือช่วยให้คุณค่ากับลูกค้าผ่านการวิเคราะห์ที่ลึกและน่าเชื่อถือ" accent="rose" apps={businessApps} />
        <Divider />
      </>)}

      {internalApps.length > 0 && (
        <AudienceSection number="03" title="เครื่องมือภายใน" subtitle="Internal Tools" description="สำหรับทีมงานและที่ปรึกษาเภสัชกร" accent="amber" apps={internalApps} />
      )}

      {contentApps.length > 0 && <ContentSection apps={contentApps} />}

      {visibleCount === 0 && (
        <section className="mx-auto max-w-content px-10 py-32 text-center">
          <div className="font-head text-2xl font-bold text-ink mb-3">ยังไม่มี app ที่เปิดให้คุณใช้งาน</div>
          <p className="font-thai text-sm text-ink-60">โปรดติดต่อ admin เพื่อขอสิทธิ์การใช้งาน</p>
        </section>
      )}

      <footer className="mt-32 bg-ink py-16 text-white/60">
        <div className="mx-auto max-w-content px-10">
          <div className="grid gap-12 pb-12 md:grid-cols-[2fr_1fr_1fr] border-b border-white/10">
            <div>
              <Logo size="lg" inverted />
              <p className="mt-6 max-w-sm font-thai text-sm leading-[1.8] text-white/40">
                UPLABS โดย UP Wellness — Science-based · Human-centered · Evidence-first
              </p>
            </div>
            <div>
              <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">Platform</div>
              <ul className="space-y-2 text-sm text-white/50">
                <li>v2.0 · 2026</li>
                <li>{APPS.length} applications</li>
              </ul>
            </div>
            <div>
              <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">Contact</div>
              <ul className="space-y-2 text-sm text-white/50">
                <li>hello@upwellness.co</li>
              </ul>
            </div>
          </div>
          <div className="flex items-center justify-between pt-6 font-mono text-[11px] text-white/30">
            <span>UPLABS v2.0 · UP Wellness</span>
            <span>github.com/upwellness/uplabs</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Divider() {
  return <div className="mx-auto max-w-content px-10"><div className="h-px bg-ink-10" /></div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-ink-10 pl-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-40">{label}</div>
      <div className="mt-1 font-head text-2xl font-extrabold tracking-tight text-ink">{value}</div>
    </div>
  );
}

const accentMap = {
  rose:    { dot: "bg-rose",    bg: "bg-rose-ultra",    text: "text-rose",    accent: "bg-rose" },
  wellness:{ dot: "bg-wellness",bg: "bg-wellness-ultra",text: "text-wellness",accent: "bg-wellness" },
  science: { dot: "bg-science", bg: "bg-science-ultra", text: "text-science", accent: "bg-science" },
  amber:   { dot: "bg-amber",   bg: "bg-amber-ultra",   text: "text-amber",   accent: "bg-amber" },
};

function AudienceSection({ number, title, subtitle, description, accent, apps }: {
  number: string; title: string; subtitle: string; description: string;
  accent: keyof typeof accentMap; apps: AppMeta[];
}) {
  const c = accentMap[accent];
  return (
    <section className="mx-auto max-w-content px-10 py-20">
      <div className="mb-12 grid items-end gap-10 md:grid-cols-2">
        <div>
          <span className="font-mono text-[11px] text-ink-40">{number}</span>
          <div className="mt-3 flex items-center gap-3">
            <span className={`h-2 w-2 rounded-full ${c.dot}`} />
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-40">{subtitle}</span>
          </div>
          <h2 className="mt-3 font-thai text-[36px] font-extrabold leading-tight tracking-tight text-ink">{title}</h2>
        </div>
        <p className="font-thai text-[15px] leading-[1.75] text-ink-60">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => <AppCard key={app.slug} app={app} accent={accent} />)}
      </div>
    </section>
  );
}

function AppCard({ app, accent }: { app: AppMeta; accent: keyof typeof accentMap }) {
  const c = accentMap[accent];
  // Only "soon" is disabled — "beta" apps are clickable
  const disabled = app.status === "soon";
  const audienceLabel = { rose: "Business", science: "Customer", amber: "Internal", wellness: "Content" }[accent];

  const card = (
    <div className={`group relative overflow-hidden rounded-2xl border border-ink-10 bg-white transition-all duration-200 ${disabled ? "opacity-60" : "hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.06)] hover:border-ink-20"}`}>
      <div className={`h-1 w-full ${c.accent}`} />
      <div className="p-6">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.bg} text-xl`}>{app.icon}</div>
        <h3 className="mt-4 font-head text-[17px] font-bold tracking-tight text-ink">{app.name}</h3>
        <p className="mt-1.5 font-thai text-[13px] leading-[1.6] text-ink-60 line-clamp-2">{app.description}</p>
      </div>
      <div className="flex items-center justify-between border-t border-ink-5 bg-surface px-6 py-3">
        <span className={`text-[10px] font-bold uppercase tracking-[0.1em] ${c.text}`}>{audienceLabel}</span>
        <span className="font-mono text-[11px] text-ink-40">
          {app.status === "live" ? "Open →" : app.status === "beta" ? "Beta →" : "Soon"}
        </span>
      </div>
    </div>
  );

  return disabled ? <div>{card}</div> : <Link href={app.href as any}>{card}</Link>;
}

function ContentSection({ apps }: { apps: AppMeta[] }) {
  return (
    <section className="mx-auto max-w-content px-10 pb-24">
      <div className="rounded-3xl border border-ink-10 bg-surface p-10">
        <div className="mb-6 flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-wellness" />
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-40">Content Library</span>
        </div>
        <h3 className="mb-8 font-head text-[28px] font-extrabold tracking-tight text-ink">บทความ &amp; เอกสาร</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {apps.map((app) => (
            <Link key={app.slug} href={app.href as any} className="flex items-center gap-4 rounded-xl bg-white p-4 transition-shadow hover:shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-wellness-ultra text-lg">{app.icon}</div>
              <div className="flex-1">
                <div className="font-head text-sm font-bold text-ink">{app.name}</div>
                <div className="font-thai text-xs text-ink-60 line-clamp-1">{app.description}</div>
              </div>
              <span className="text-ink-20">›</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
