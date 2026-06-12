import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Logo } from "@/components/ui/Logo";
import { UserMenu } from "@/components/ui/UserMenu";
import { ProspectsClient } from "./ProspectsClient";

export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="relative min-h-screen overflow-hidden bg-warm-white">
      <BgMesh />

      {/* ── Header ───────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-ink-10/60 bg-warm-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-5 min-w-0">
            <Link href="/" className="group flex items-center gap-1.5 text-ink-40 hover:text-ink transition-colors text-sm shrink-0">
              <span className="transition-transform group-hover:-translate-x-0.5">←</span>
              <span className="font-thai">Hub</span>
            </Link>
            <div className="h-5 w-px bg-ink-10 shrink-0" />
            <Logo size="sm" />
            <span className="rounded-full border border-rose/20 bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-rose shrink-0">
              Prospect List
            </span>
          </div>
          <UserMenu profile={session.profile} />
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative mx-auto max-w-content px-6 lg:px-10 pt-10 lg:pt-14 pb-2">
        <div className="mb-5 inline-flex items-center gap-2">
          <span className="h-px w-7 bg-rose" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-rose">
            Memory Dump · 100 Names
          </span>
        </div>
        <h1 className="font-head font-extrabold leading-[1.04] tracking-[-1.5px] text-ink text-[clamp(32px,4.2vw,48px)]">
          รายชื่อ Prospect
          <br />
          <span className="bg-gradient-to-br from-rose-deep via-rose to-amber bg-clip-text text-transparent">
            ที่จะคุยด้วย
          </span>
        </h1>
        <p className="mt-4 max-w-2xl font-thai text-[15px] leading-[1.75] text-ink-60">
          ใส่ชื่อเร็วๆ · จัด tier A/B/C · convert → CheckForm ด้วยคลิกเดียว · เริ่มจากที่เก่งสุด · 100 ชื่อใน 15 นาที
        </p>
      </section>

      <div className="relative mx-auto max-w-content px-6 lg:px-10 pb-20">
        <ProspectsClient />
      </div>
    </main>
  );
}

function BgMesh() {
  return (
    <>
      <style>{`
        @keyframes pl-mesh-a { 0%,100% { transform: translate(0,0); } 50% { transform: translate(30px,-20px); } }
        @keyframes pl-mesh-b { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-20px,15px); } }
        .pl-mesh-a { animation: pl-mesh-a 22s ease-in-out infinite; }
        .pl-mesh-b { animation: pl-mesh-b 26s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .pl-mesh-a, .pl-mesh-b { animation: none; }
        }
      `}</style>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
        <div className="pl-mesh-a absolute -top-24 -left-16 h-[380px] w-[380px] rounded-full bg-rose-pale/45 blur-[120px]" />
        <div className="pl-mesh-b absolute top-16 right-0 h-[340px] w-[340px] rounded-full bg-wellness-pale/50 blur-[120px]" />
      </div>
    </>
  );
}
