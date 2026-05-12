/**
 * Server-side session helpers. Call from RSC, route handlers, server actions.
 */
import { createClient } from "@/lib/supabase/server";
import type { Role } from "./roles";

export interface SessionProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
}

export async function getSession() {
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

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.profile.role !== "admin") throw new Error("FORBIDDEN");
  return session;
}
