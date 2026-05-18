import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Logo } from "@/components/ui/Logo";
import { UserMenu } from "@/components/ui/UserMenu";
import { CheckFormClient } from "./CheckFormClient";

export const dynamic = "force-dynamic";

export default async function CheckFormPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="relative min-h-screen overflow-hidden bg-warm-white">
      <BgMesh />

      {/* ── Header ────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-ink-10/60 bg-warm-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-5">
            <Link href="/" className="group flex items-center gap-1.5 text-ink-40 hover:text-ink transition-colors text-sm">
              <span className="transition-transform group-hover:-translate-x-0.5">←</span>
              <span className="font-thai">Hub</span>
            </Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full border border-rose/20 bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-rose">
              Check FORM
            </span>
          </div>
          <UserMenu profile={session.profile} />
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────── */}
      <section className="relative mx-auto max-w-content px-6 lg:px-10 pt-10 lg:pt-14 pb-2">
        <div className="mb-5 inline-flex items-center gap-2">
          <span className="h-px w-7 bg-rose" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-rose">Lead Qualification · FORM Method</span>
        </div>
        <h1 className="font-head font-extrabold leading-[1.04] tracking-[-1.5px] text-ink text-[clamp(32px,4.2vw,48px)]">
          วิเคราะห์ Prospect ก่อน
          <br />
          <span className="bg-gradient-to-br from-rose-deep via-rose to-amber bg-clip-text text-transparent">
            แนะนำที่ใช่
          </span>
        </h1>
        <p className="mt-4 max-w-2xl font-thai text-[15px] leading-[1.75] text-ink-60">
          เครื่องมือ <b>FORM</b> (Family · Occupation · Recreation · Money) — มี <b>dialog ตัวอย่าง</b> ในทุกด้าน · ใช้พูดตามได้เลย · กรอก notes ระหว่างคุย · จบแล้วได้คำแนะนำ next action
        </p>
      </section>

      <div className="relative mx-auto max-w-content px-6 lg:px-10 pb-20">
        <CheckFormClient />
      </div>
    </main>
  );
}

function BgMesh() {
  return (
    <>
      <style>{`
        @keyframes cf-mesh-a { 0%,100% { transform: translate(0,0); } 50% { transform: translate(30px,-20px); } }
        @keyframes cf-mesh-b { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-20px,15px); } }
        .cf-mesh-a { animation: cf-mesh-a 22s ease-in-out infinite; }
        .cf-mesh-b { animation: cf-mesh-b 26s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .cf-mesh-a, .cf-mesh-b { animation: none; }
        }
      `}</style>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
        <div className="cf-mesh-a absolute -top-24 -left-16 h-[380px] w-[380px] rounded-full bg-rose-pale/45 blur-[120px]" />
        <div className="cf-mesh-b absolute top-16 right-0 h-[340px] w-[340px] rounded-full bg-wellness-pale/50 blur-[120px]" />
      </div>
    </>
  );
}
