import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Logo } from "@/components/ui/Logo";
import { UserMenu } from "@/components/ui/UserMenu";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile.role !== "admin") redirect("/");

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-10">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm text-ink-40 hover:text-ink transition-colors">← Hub</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-amber-pale px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-amber">Admin</span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/admin/users"  className="rounded-full px-3 py-1.5 font-medium text-ink-60 hover:bg-ink-5 hover:text-ink">Users</Link>
            <Link href="/admin/backup" className="rounded-full px-3 py-1.5 font-medium text-ink-60 hover:bg-ink-5 hover:text-ink">Backup / Restore</Link>
            <UserMenu profile={session.profile} />
          </nav>
        </div>
      </header>
      {children}
    </main>
  );
}
