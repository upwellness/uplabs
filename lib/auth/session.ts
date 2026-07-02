/**
 * Server-side session helpers. Call from RSC, route handlers, server actions.
 */
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VIEW_AS_COOKIE } from "./view-as-constants";
import type { Role } from "./roles";

export interface SessionProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
}

export interface ViewAsInfo {
  active: true;
  adminId: string;
  adminLabel: string;
}

async function loadRealSession() {
  const supa = createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supa
    .from("profiles")
    .select("id, email, display_name, role")
    .eq("id", user.id)
    .single();

  const { data: grants } = await supa
    .from("user_app_grants")
    .select("app_slug")
    .eq("user_id", user.id);

  return {
    user,
    profile: (profile ?? { id: user.id, email: user.email ?? null, display_name: null, role: "other" }) as SessionProfile,
    grantedAppSlugs: (grants ?? []).map(g => g.app_slug as string),
  };
}

/** The REAL authenticated identity — always ignores "view as". Use for permission checks. */
export async function getRealSession() {
  return loadRealSession();
}

/**
 * The effective session pages/components should render against. When an admin
 * has an active "view as" cookie (see lib/auth/view-as.ts), this returns the
 * impersonated target user's profile + grants instead of the admin's own, so
 * ordinary app code (coach_id checks, role branches, dashboards) shows exactly
 * what that user would see. Writes stay blocked separately in middleware.ts —
 * this only changes what is *read*, never who is allowed to *write*.
 */
export async function getSession() {
  const real = await loadRealSession();
  if (!real) return null;
  if (real.profile.role !== "admin") return real;

  const jar = await cookies();
  const targetId = jar.get(VIEW_AS_COOKIE)?.value;
  if (!targetId || targetId === real.user.id) return real;

  const admin = createAdminClient();
  const { data: targetProfile } = await admin
    .from("profiles")
    .select("id, email, display_name, role")
    .eq("id", targetId)
    .maybeSingle();
  if (!targetProfile) return real;

  const { data: grants } = await admin
    .from("user_app_grants")
    .select("app_slug")
    .eq("user_id", targetId);

  return {
    user: { ...real.user, id: targetProfile.id, email: targetProfile.email },
    profile: targetProfile as SessionProfile,
    grantedAppSlugs: (grants ?? []).map((g) => g.app_slug as string),
    viewAs: {
      active: true,
      adminId: real.user.id,
      adminLabel: real.profile.display_name ?? real.profile.email ?? "admin",
    } as ViewAsInfo,
  };
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

/** Always checks the REAL identity — never satisfied by an impersonated "view as" session. */
export async function requireAdmin() {
  const real = await getRealSession();
  if (!real) throw new Error("UNAUTHENTICATED");
  if (real.profile.role !== "admin") throw new Error("FORBIDDEN");
  return real;
}
