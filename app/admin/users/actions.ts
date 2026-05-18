"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/session";
import type { Role } from "@/lib/auth/roles";

export interface ManagedCustomer {
  id: string;
  name: string;
}

export interface UserListRow {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
  abo_number: string | null;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  granted_app_slugs: string[];
  managed_customers: ManagedCustomer[];
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function listUsers(): Promise<UserListRow[]> {
  await requireAdmin();
  const admin = createAdminClient();

  // Page through auth.users (max 1000 per page).
  const { data: authList, error: aErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (aErr) throw aErr;

  const [{ data: profiles }, { data: grants }, { data: customers }] = await Promise.all([
    admin.from("profiles").select("id, email, display_name, role, abo_number, phone"),
    admin.from("user_app_grants").select("user_id, app_slug"),
    admin.from("customers").select("id, name, coach_id").not("coach_id", "is", null).order("name"),
  ]);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  const grantsMap = new Map<string, string[]>();
  for (const g of grants ?? []) {
    const arr = grantsMap.get(g.user_id) ?? [];
    arr.push(g.app_slug);
    grantsMap.set(g.user_id, arr);
  }
  const customersByCoach = new Map<string, ManagedCustomer[]>();
  for (const c of customers ?? []) {
    if (!c.coach_id) continue;
    const arr = customersByCoach.get(c.coach_id) ?? [];
    arr.push({ id: c.id, name: c.name });
    customersByCoach.set(c.coach_id, arr);
  }

  return authList.users.map((u) => {
    const p = profileMap.get(u.id) as any;
    return {
      id: u.id,
      email: u.email ?? p?.email ?? null,
      display_name: p?.display_name ?? null,
      role: (p?.role ?? "other") as Role,
      abo_number: p?.abo_number ?? null,
      phone: p?.phone ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      granted_app_slugs: grantsMap.get(u.id) ?? [],
      managed_customers: customersByCoach.get(u.id) ?? [],
    };
  }).sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
}

export async function updateUserRole(userId: string, role: Role) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateUserEmail(userId: string, email: string) {
  await requireAdmin();
  if (!email.includes("@")) return { error: "email ไม่ถูกต้อง" };
  const admin = createAdminClient();
  // Update both auth.users + profiles
  const { error: aErr } = await admin.auth.admin.updateUserById(userId, { email });
  if (aErr) return { error: aErr.message };
  await admin.from("profiles").update({ email }).eq("id", userId);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateAboNumber(userId: string, abo_number: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const value = abo_number.trim() || null;
  const { error } = await admin.from("profiles").update({ abo_number: value }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updatePhone(userId: string, phone: string) {
  await requireAdmin();
  const admin = createAdminClient();
  // Normalize: strip non-digits, +66 → 0
  const cleaned = phone.replace(/\D/g, "").replace(/^66/, "0");
  const value = cleaned || null;
  const { error } = await admin.from("profiles").update({ phone: value }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateDisplayName(userId: string, display_name: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ display_name }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function sendResetEmail(email: string) {
  await requireAdmin();
  if (!email) return { error: "ไม่มี email" };
  const admin = createAdminClient();
  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/reset-password`,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Generate a password-recovery link the admin can copy and DM to the user.
 * Useful when email is unreliable or the user has no email access.
 */
export async function generateResetLink(email: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${siteUrl()}/reset-password` },
  });
  if (error) return { error: error.message };
  return { ok: true, url: data?.properties?.action_link ?? null };
}

export async function toggleAppGrant(userId: string, appSlug: string, grant: boolean) {
  await requireAdmin();
  const admin = createAdminClient();
  if (grant) {
    const { error } = await admin.from("user_app_grants").upsert({ user_id: userId, app_slug: appSlug });
    if (error) return { error: error.message };
  } else {
    const { error } = await admin.from("user_app_grants").delete().eq("user_id", userId).eq("app_slug", appSlug);
    if (error) return { error: error.message };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function createUser(email: string, password: string, role: Role, display_name?: string) {
  await requireAdmin();
  if (!email || !password) return { error: "email และ password จำเป็น" };
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: display_name ? { display_name } : undefined,
  });
  if (error) return { error: error.message };
  // Trigger handle_new_user fires; then set role explicitly.
  if (data.user) {
    await admin.from("profiles").update({ role, display_name }).eq("id", data.user.id);
  }
  revalidatePath("/admin/users");
  return { ok: true };
}
