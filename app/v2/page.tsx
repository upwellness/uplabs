/**
 * UP Labs v2 · Home / App launcher (SPEC §7.1)
 * ────────────────────────────────────────────
 * Real launcher (replaces the static preview). Mirrors v1 app/page.tsx visibility:
 * tags each app with canAccessApp(role ∪ grant) and groups by audience.
 * Clinical-warm cards · Lucide-free app glyphs come from the registry · links to
 * /v2/customers and /v2/bca.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users, Briefcase, Wrench, BookOpen, ArrowRight, Lock, ChevronRight, Scale,
} from "lucide-react";
import { APPS, appsByAudience, type AppMeta, type AppAudience } from "@/lib/apps-registry";
import { canAccessApp } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/session";
import { Shell } from "./_components/Shell";

export const dynamic = "force-dynamic";

type AppWithAccess = AppMeta & { allowed: boolean };

const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function bangkokNow(): Date { return new Date(Date.now() + 7 * 60 * 60 * 1000); }
function greeting(): string {
  const h = bangkokNow().getUTCHours();
  if (h < 5) return "ดึกแล้วนะ";
  if (h < 11) return "อรุณสวัสดิ์";
  if (h < 13) return "สวัสดีตอนเที่ยง";
  if (h < 17) return "สวัสดีตอนบ่าย";
  if (h < 20) return "สวัสดีตอนเย็น";
  return "สวัสดียามค่ำ";
}
function thaiDate(): string {
  const d = bangkokNow();
  return `${d.getUTCDate()} ${TH_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`;
}

const STATUS_TAG: Record<AppMeta["status"], { label: string; cls: string }> = {
  live: { label: "พร้อมใช้", cls: "bg-status-bg-optimal text-status-optimal" },
  beta: { label: "เบต้า", cls: "bg-status-bg-caution text-status-caution" },
  soon: { label: "เร็วๆ นี้", cls: "bg-ink-5 text-ink-40" },
};

const SECTIONS: { audience: AppAudience; title: string; desc: string; icon: typeof Users }[] = [
  { audience: "business", title: "เครื่องมือสำหรับนักธุรกิจ", desc: "ดูแลลูกค้าด้วยข้อมูลที่มีหลักฐาน", icon: Briefcase },
  { audience: "customer", title: "สำหรับลูกค้า", desc: "แบบประเมินที่ส่งให้ prospect ทำเองได้", icon: Users },
  { audience: "internal", title: "เครื่องมือภายใน", desc: "สำหรับทีมงานและที่ปรึกษาเภสัชกร", icon: Wrench },
  { audience: "content", title: "บทความ & เอกสาร", desc: "ความรู้สุขภาพและคู่มือ", icon: BookOpen },
];

export default async function V2Home() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { profile, grantedAppSlugs } = session;
  const canSee = (app: AppMeta) => canAccessApp(profile.role, app.allowedRoles, grantedAppSlugs, app.slug);
  const tag = (apps: AppMeta[]): AppWithAccess[] => apps.map((a) => ({ ...a, allowed: canSee(a) }));

  const groups = SECTIONS.map((s) => ({ ...s, apps: tag(appsByAudience(s.audience)) }));
  const allowedCount = groups.reduce((sum, g) => sum + g.apps.filter((a) => a.allowed).length, 0);

  return (
    <Shell breadcrumb={[{ label: "หน้าแรก" }]} profile={profile}>
      {/* Greeting */}
      <section className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-rose">
          <span className="h-px w-6 bg-rose" />
          {thaiDate()}
        </div>
        <h1 className="font-head text-[28px] font-extrabold leading-tight tracking-tight text-ink lg:text-[34px]">
          {greeting()}, {profile.display_name ?? "Wellness Partner"}
        </h1>
        <p className="mt-2 max-w-xl font-thai text-[14px] leading-[1.6] text-ink-60">
          Science-based · Longevity-first — เปิดใช้งานได้ {allowedCount}/{APPS.length} แอป
        </p>

        {/* Quick links to the two v2 surfaces shipped in this iteration */}
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link
            href="/v2/customers"
            className="inline-flex items-center gap-2 rounded-full bg-rose px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-rose-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            <Users size={15} strokeWidth={2.25} aria-hidden /> ลูกค้า <ArrowRight size={14} strokeWidth={2.5} aria-hidden />
          </Link>
          <Link
            href="/v2/bca"
            className="inline-flex items-center gap-2 rounded-full border border-ink-10 bg-white px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-rose hover:text-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2"
          >
            <Scale size={15} strokeWidth={2.25} aria-hidden /> BCA Tracker
          </Link>
        </div>
      </section>

      {/* App groups */}
      <div className="space-y-9">
        {groups.map((g) =>
          g.apps.length === 0 ? null : (
            <section key={g.audience} aria-labelledby={`grp-${g.audience}`}>
              <div className="mb-3 flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-ultra text-rose">
                  <g.icon size={16} strokeWidth={2} aria-hidden />
                </span>
                <div>
                  <h2 id={`grp-${g.audience}`} className="font-head text-[16px] font-bold tracking-tight text-ink">{g.title}</h2>
                  <p className="font-thai text-[12px] text-ink-60">{g.desc}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.apps.map((a) => <AppCard key={a.slug} app={a} />)}
              </div>
            </section>
          ),
        )}

        {allowedCount === 0 && (
          <section className="rounded-2xl border border-ink-10 bg-white px-6 py-16 text-center">
            <div className="font-head text-[18px] font-bold text-ink">ยังไม่มีแอปที่เปิดให้คุณใช้งาน</div>
            <p className="mt-2 font-thai text-[13px] text-ink-60">โปรดติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์การใช้งาน</p>
          </section>
        )}
      </div>

      <footer className="mt-12 border-t border-ink-10 pt-5 font-mono text-[11px] text-ink-40">
        UP Labs v2 · {thaiDate()} · {APPS.length} applications · {allowedCount} เปิดอยู่
      </footer>
    </Shell>
  );
}

function AppCard({ app }: { app: AppWithAccess }) {
  const blocked = !app.allowed || app.status === "soon";
  const lock = !app.allowed;
  const tag = STATUS_TAG[app.status];
  const external = app.href.startsWith("http");

  const inner = (
    <div
      className={`group relative flex h-full items-start gap-3 rounded-2xl border border-ink-10 bg-white p-4 transition-all duration-200 ${
        lock
          ? "cursor-not-allowed opacity-60"
          : app.status === "soon"
            ? "opacity-70"
            : "hover:-translate-y-0.5 hover:border-ink-20 hover:shadow-[0_12px_28px_-16px_rgba(24,21,26,0.18)]"
      }`}
    >
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-ultra text-xl ring-1 ring-rose-pale/60">
        {app.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="font-head text-[15px] font-bold tracking-tight text-ink">{app.name}</h3>
          {lock && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink-5 px-1.5 py-0.5 text-[10px] font-semibold text-ink-40">
              <Lock size={10} strokeWidth={2.5} aria-hidden /> ไม่มีสิทธิ์
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 font-thai text-[12px] leading-[1.55] text-ink-60">{app.description}</p>
        <div className="mt-2.5 flex items-center justify-between">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tag.cls}`}>{tag.label}</span>
          {!blocked && (
            <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-rose">
              เปิด <ChevronRight size={13} strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (blocked) return <div title={lock ? "ไม่มีสิทธิ์ใช้งาน" : "เร็วๆ นี้"}>{inner}</div>;
  return external ? (
    <a href={app.href} target="_blank" rel="noopener noreferrer" className="block h-full">{inner}</a>
  ) : (
    <Link href={app.href as any} className="block h-full">{inner}</Link>
  );
}
