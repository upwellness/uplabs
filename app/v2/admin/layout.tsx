import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

/**
 * UP Labs v2 · Admin gate (SPEC §7.12 — "admin gate /admin/* เฉพาะ role admin")
 * ────────────────────────────────────────────────────────────────────────────
 * Mirrors v1 app/admin/layout.tsx access check: redirect unauthenticated → /login,
 * non-admin → / . Unlike v1 this layout renders NO header of its own — each v2
 * admin page renders the shared v2 Shell (top bar + app switcher + breadcrumb),
 * so this layout only enforces the role gate and passes children through.
 */
export default async function V2AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile.role !== "admin") redirect("/");

  return <>{children}</>;
}
