import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-surface flex flex-col">
      <header className="px-10 py-6">
        <Link href="/login"><Logo size="md" /></Link>
      </header>
      <div className="flex-1 flex items-center justify-center px-6 pb-20">
        <div className="w-full max-w-md">{children}</div>
      </div>
      <footer className="border-t border-ink-10 py-5 text-center font-mono text-[11px] text-ink-40">
        UPLABS · UP Wellness · Health Intelligence Platform
      </footer>
    </main>
  );
}
