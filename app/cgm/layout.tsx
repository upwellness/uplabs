import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { canAccessApp } from "@/lib/auth/roles";
import { findApp } from "@/lib/apps-registry";

export default async function CGMLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const app = findApp("cgm")!;
  if (!canAccessApp(session.profile.role, app.allowedRoles, session.grantedAppSlugs, "cgm")) {
    redirect("/");
  }

  return <>{children}</>;
}
