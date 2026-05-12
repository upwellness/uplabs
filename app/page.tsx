import Link from "next/link";
import { APPS, appsByAudience, type AppMeta } from "@/lib/apps-registry";
import { Logo } from "@/components/ui/Logo";

export default function UPMenu() {
  return (
    <main className="min-h-screen bg-white">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-10">
          <Logo size="md" />
          <div className="flex items-center gap-6">
            <span className="hidden md:inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-40">
              <span className="h-1.5 w-1.5 rounded-full bg-status-optimal animate-pulse" />
              System operational
            </span>
            <span className="rounded-full border border-rose-pale bg-rose-ultra px-3 py-1 text-[11px] font-semibold text-rose">
              v2.0 · 2026
            </span>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-content px-10 pt-20 pb-16">
        <div className="mb-7 flex items-center gap-3">
          <div className="h-px w-8 bg-rose" />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose">
            Health Intelligence Platform
          </span>
        </div>

        <h1 className="font-head text-[clamp(44px,6vw,72px)] font-extrabold leading-[1.02] tracking-[-2px] text-ink">
          ระบบสุขภาพอัจฉริยะ<br />
          <span className="text-rose">เพื่อการตัดสินใจ</span>ที่มั่นใจ
        </h1>

        <p className="mt-7 max-w-xl font-thai text-[17px] leading-[1.75] text-ink-60">
          UPLABS รวมเครื่องมือ AI วิเคราะห์สุขภาพ การติดตามผลลัพธ์ และการออกแบบโปรแกรมเฉพาะบุคคล —
          อิงงานวิจัยที่น่าเชื่อถือ ไม่ใช่ trend หรือ marketing claims
        </p>

        <div className="mt-12 grid grid-cols-2 gap-x-12 gap-y-6 sm:grid-cols-4">
          {[
            { label: "Applications",   value: APPS.length.toString() },
            { label: "Audience Groups", value: "3" },
            { label: "Live Apps",      value: APPS.filter(a => a.status === "live").length.toString() },
            { label: "Version",        value: "2026.1" },
          ].map((s) => (
            <div key={s.label} className="border-l border-ink-10 pl-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-40">{s.label}</div>
              <div className="mt-1 font-head text-2xl font-extrabold tracking-tight text-ink">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* ── Customer Apps ──────────────────────────────────── */}
      <AudienceSection
        number="01"
        title="สำหรับลูกค้า"
        subtitle="Customer-facing"
        description="แอปประเมินและติดตามสุขภาพที่ลูกค้าใช้ได้ด้วยตัวเอง — ออกแบบให้เข้าใจง่ายแต่อิงงานวิจัย"
        accent="science"
        apps={appsByAudience("customer")}
      />

      <Divider />

      {/* ── Business Apps ──────────────────────────────────── */}
      <AudienceSection
        number="02"
        title="สำหรับนักธุรกิจ"
        subtitle="For Wellness Partners"
        description="เครื่องมือช่วยนักธุรกิจให้คุณค่ากับลูกค้าผ่านการวิเคราะห์ที่ลึกและน่าเชื่อถือ"
        accent="rose"
        apps={appsByAudience("business")}
      />

      <Divider />

      {/* ── Internal ───────────────────────────────────────── */}
      <AudienceSection
        number="03"
        title="เครื่องมือภายใน"
        subtitle="Internal Tools"
        description="สำหรับทีมงานและที่ปรึกษาเภสัชกร — ใช้เพื่อความแม่นยำในการให้คำแนะนำ"
        accent="amber"
        apps={appsByAudience("internal")}
      />

      {/* ── Content ────────────────────────────────────────── */}
      <ContentSection apps={appsByAudience("content")} />

      {/* ── Footer ─────────────────────────────────────────── */}
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
                <li>Brand Guidelines</li>
                <li>API Documentation</li>
                <li>Release Notes</li>
              </ul>
            </div>
            <div>
              <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">Contact</div>
              <ul className="space-y-2 text-sm text-white/50">
                <li>hello@upwellness.co</li>
                <li>LINE: @upwellness</li>
              </ul>
            </div>
          </div>
          <div className="flex items-center justify-between pt-6 font-mono text-[11px] text-white/30">
            <span>UPLABS v2.0 · 2026 · UP Wellness</span>
            <span>github.com/upwellness/uplabs</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ────────────────────────────────────────────────────── */

function Divider() {
  return <div className="mx-auto max-w-content px-10"><div className="h-px bg-ink-10" /></div>;
}

const accentMap = {
  rose:    { dot: "bg-rose",    bg: "bg-rose-ultra",    text: "text-rose",    accent: "bg-rose" },
  wellness:{ dot: "bg-wellness",bg: "bg-wellness-ultra",text: "text-wellness",accent: "bg-wellness" },
  science: { dot: "bg-science", bg: "bg-science-ultra", text: "text-science", accent: "bg-science" },
  amber:   { dot: "bg-amber",   bg: "bg-amber-ultra",   text: "text-amber",   accent: "bg-amber" },
};

interface AudienceSectionProps {
  number: string;
  title: string;
  subtitle: string;
  description: string;
  accent: keyof typeof accentMap;
  apps: AppMeta[];
}

function AudienceSection({ number, title, subtitle, description, accent, apps }: AudienceSectionProps) {
  const c = accentMap[accent];
  return (
    <section className="mx-auto max-w-content px-10 py-24">
      <div className="mb-14 grid items-end gap-10 md:grid-cols-2">
        <div>
          <span className="font-mono text-[11px] text-ink-40">{number}</span>
          <div className="mt-3 flex items-center gap-3">
            <span className={`h-2 w-2 rounded-full ${c.dot}`} />
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-40">{subtitle}</span>
          </div>
          <h2 className="mt-3 font-head font-thai text-[40px] font-extrabold leading-tight tracking-tight text-ink">
            {title}
          </h2>
        </div>
        <p className="font-thai text-[15px] leading-[1.75] text-ink-60">{description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => (
          <AppCard key={app.slug} app={app} accent={accent} />
        ))}
      </div>
    </section>
  );
}

function AppCard({ app, accent }: { app: AppMeta; accent: keyof typeof accentMap }) {
  const c = accentMap[accent];
  const disabled = app.status !== "live";

  const card = (
    <div className={`group relative overflow-hidden rounded-2xl border border-ink-10 bg-white transition-all duration-200 ${disabled ? "opacity-60" : "hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.06)] hover:border-ink-20"}`}>
      <div className={`h-1 w-full ${c.accent}`} />
      <div className="p-6">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.bg} text-xl`}>
          {app.icon}
        </div>
        <h3 className="mt-4 font-head text-[17px] font-bold tracking-tight text-ink">{app.name}</h3>
        <p className="mt-1.5 font-thai text-[13px] leading-[1.6] text-ink-60 line-clamp-2">{app.description}</p>
      </div>
      <div className="flex items-center justify-between border-t border-ink-5 bg-surface px-6 py-3">
        <span className={`text-[10px] font-bold uppercase tracking-[0.1em] ${c.text}`}>
          {accent === "rose" ? "Business" : accent === "science" ? "Customer" : accent === "amber" ? "Internal" : "Wellness"}
        </span>
        <span className="font-mono text-[11px] text-ink-40">
          {app.status === "live" ? "Open →" : app.status === "beta" ? "Beta →" : "Soon"}
        </span>
      </div>
    </div>
  );

  return disabled ? <div>{card}</div> : <Link href={app.href as any}>{card}</Link>;
}

function ContentSection({ apps }: { apps: AppMeta[] }) {
  if (apps.length === 0) return null;
  return (
    <section className="mx-auto max-w-content px-10 pb-24">
      <div className="rounded-3xl border border-ink-10 bg-surface p-10">
        <div className="mb-6 flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-wellness" />
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-40">Content Library</span>
        </div>
        <h3 className="mb-8 font-head text-[28px] font-extrabold tracking-tight text-ink">บทความ & เอกสาร</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {apps.map((app) => (
            <Link
              key={app.slug}
              href={app.href as any}
              className="flex items-center gap-4 rounded-xl bg-white p-4 transition-shadow hover:shadow-sm"
            >
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
