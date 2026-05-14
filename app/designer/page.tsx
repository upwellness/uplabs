import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Logo } from "@/components/ui/Logo";
import { DesignerClient } from "./DesignerClient";

export const dynamic = "force-dynamic";

export default async function DesignerPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
          <div className="flex items-center gap-5">
            <Link href="/" className="text-ink-40 hover:text-ink transition-colors text-sm">← Hub</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-rose">
              Program Designer
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-content px-6 py-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
          Full Course Customizer
        </div>
        <h1 className="mt-1 font-head text-[28px] font-extrabold tracking-tight text-ink">
          🎨 Program Designer
        </h1>
        <p className="mt-2 max-w-2xl font-thai text-sm text-ink-60">
          ออกแบบ Full Course เฉพาะบุคคล · 5 ขั้นตอน · คำนวณ unit อัตโนมัติ · ส่วนลด · PV + cashback · ส่งออก HD report
        </p>

        <DesignerClient />
      </div>
    </main>
  );
}
