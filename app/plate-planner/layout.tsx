import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { canAccessApp } from "@/lib/auth/roles";
import { findApp } from "@/lib/apps-registry";

export default async function PlatePlannerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const app = findApp("plate-planner");
  if (!app) redirect("/");
  if (!canAccessApp(session.profile.role, app.allowedRoles, session.grantedAppSlugs, "plate-planner")) {
    redirect("/");
  }

  return <>{children}</>;
}
