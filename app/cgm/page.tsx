/**
 * CGM Analyzer — embeds the v1 single-page React app from /public/cgm-v1.html
 * Wrapped in UP Wellness Ops shell so auth gate (layout.tsx) still applies.
 *
 * The v1 file has: profile pagination · 0-3hr meal analysis · compare modal · CSV
 * import · AI section · save-as-image. Auth is via Supabase anon key inline.
 *
 * Color palette has been mapped indigo → rose to match brand.
 */
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function CGMPage() {
  return (
    <main className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
          <div className="flex items-center gap-5">
            <Link href="/" className="text-ink-40 hover:text-ink transition-colors text-sm">← Hub</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-rose">
              CGM Analyzer
            </span>
          </div>
        </div>
      </header>
      <iframe
        src="/cgm-v1.html"
        title="CGM Analyzer"
        className="flex-1 w-full border-0"
        style={{ height: "calc(100vh - 56px)" }}
      />
    </main>
  );
}
