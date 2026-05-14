/**
 * Program Designer — embeds v1 single-page React app from /public/designer-v1.html
 * Wrapped in UPLABS shell so auth gate (layout.tsx) still applies.
 *
 * v1 features (Baseline 3.2.1):
 *  - 5-step wizard: Energy Block · Cell Nutrients · Gut Balance · Targeted Care · Final Summary
 *  - Product database with prices, pack sizes, can-discount flags
 *  - Standard 60d preset · 30d/60d toggle
 *  - Condition addons (high BP · high cholesterol · plateau · hunger · cancer/immune)
 *  - Auto-calculate units from doses (morning/noon/evening) and duration
 *  - 15% discount logic (BDK max 3, others max 1)
 *  - Membership fees: reg (+900) / e-Starter (-300) / A-Joy (-500)
 *  - PV + Cashback rate calculation
 *  - Save as 1800px HD image (html2canvas)
 *
 * SKU naming aligned with Pulse rules: Bio C (was BioC Plus).
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Logo } from "@/components/ui/Logo";

export const dynamic = "force-dynamic";

export default async function DesignerPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="flex min-h-screen flex-col bg-white">
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
      <iframe
        src="/designer-v1.html"
        title="Program Designer"
        className="flex-1 w-full border-0"
        style={{ height: "calc(100vh - 56px)" }}
      />
    </main>
  );
}
