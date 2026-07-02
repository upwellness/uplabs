"use server";

import { revalidatePath, revalidateTag } from "next/cache";
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
  assigned_customers: ManagedCustomer[];
  /** MLM hierarchy: this user's upline (parent) — null if top-level. */
  parent_id: string | null;
  parent_label: string | null;
}

export interface AssignableCustomer {
  id: string;
  name: string;
  coach_id: string | null;
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

  const [{ data: profiles }, { data: grants }, { data: customers }, { data: assignments }] = await Promise.all([
    admin.from("profiles").select("id, email, display_name, role, abo_number, phone, parent_id"),
    admin.from("user_app_grants").select("user_id, app_slug"),
    admin.from("customers").select("id, name, coach_id").order("name"),
    admin.from("customer_assignments").select("user_id, customer_id"),
  ]);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  const grantsMap = new Map<string, string[]>();
  for (const g of grants ?? []) {
    const arr = grantsMap.get(g.user_id) ?? [];
    arr.push(g.app_slug);
    grantsMap.set(g.user_id, arr);
  }
  const customersByCoach = new Map<string, ManagedCustomer[]>();
  const customerName = new Map<string, string>();
  for (const c of customers ?? []) {
    customerName.set(c.id, c.name);
    if (!c.coach_id) continue;
    const arr = customersByCoach.get(c.coach_id) ?? [];
    arr.push({ id: c.id, name: c.name });
    customersByCoach.set(c.coach_id, arr);
  }
  // Customers explicitly shared with a user (co-coach), keyed by user_id.
  const assignedByUser = new Map<string, ManagedCustomer[]>();
  for (const a of assignments ?? []) {
    const arr = assignedByUser.get(a.user_id) ?? [];
    arr.push({ id: a.customer_id, name: customerName.get(a.customer_id) ?? "—" });
    assignedByUser.set(a.user_id, arr);
  }

  const labelOf = (id: string | null | undefined): string | null => {
    if (!id) return null;
    const pp = profileMap.get(id) as any;
    return pp?.display_name ?? pp?.email ?? null;
  };

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
      assigned_customers: assignedByUser.get(u.id) ?? [],
      parent_id: p?.parent_id ?? null,
      parent_label: labelOf(p?.parent_id),
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

/** All customers (id · name · owner) — for the admin's "assign customer" picker. */
export async function listAssignableCustomers(): Promise<AssignableCustomer[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin.from("customers").select("id, name, coach_id").order("name");
  return (data ?? []) as AssignableCustomer[];
}

/** Share a customer with an additional user (co-coach): they can see + edit it. */
export async function assignCustomer(userId: string, customerId: string) {
  const session = await requireAdmin();
  if (!userId || !customerId) return { error: "ข้อมูลไม่ครบ" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("customer_assignments")
    .upsert({ customer_id: customerId, user_id: userId, assigned_by: session.user.id });
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  revalidateTag("dashboard"); // refresh the assigned user's customer-list cache
  return { ok: true };
}

/**
 * Set (or clear) a user's upline in the MLM hierarchy. Admin-only. Prevents cycles:
 * the new parent may not be the user itself nor any of the user's own descendants
 * (that would create a loop). Pass parentId=null to make the user top-level.
 */
export async function setUserParent(userId: string, parentId: string | null) {
  await requireAdmin();
  if (!userId) return { error: "ไม่มี user" };
  if (parentId === userId) return { error: "ตั้ง upline เป็นตัวเองไม่ได้" };

  const admin = createAdminClient();
  if (parentId) {
    // parentId must not be a descendant of userId (would form a cycle).
    const { data: descendants } = await admin.rpc("profile_descendant_ids", { root: userId });
    if (Array.isArray(descendants) && descendants.includes(parentId)) {
      return { error: "ตั้ง upline เป็นคนในสายงานล่างของตัวเองไม่ได้ (จะวน loop)" };
    }
  }

  const { error } = await admin.from("profiles").update({ parent_id: parentId }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  revalidateTag("dashboard"); // downline visibility affects customer-list caches
  return { ok: true };
}

/** Revoke a co-coach assignment (does NOT touch ownership or any customer data). */
export async function unassignCustomer(userId: string, customerId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("customer_assignments")
    .delete()
    .eq("user_id", userId)
    .eq("customer_id", customerId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  revalidateTag("dashboard");
  return { ok: true };
}
