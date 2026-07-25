import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Shared customer access control.
 *
 * A customer is owned by one coach (`customers.coach_id`). Admins see all. On top
 * of that, an admin can ASSIGN a customer to additional user accounts (co-coaches)
 * via the `customer_assignments` table — those users get the same see+edit access
 * as the owner (except deleting the customer / re-assigning, which stay owner+admin).
 *
 * Use `isAssignedToCustomer` to extend the existing owner check at each call site:
 *   if (!isAdmin && c.coach_id !== uid && !(await isAssignedToCustomer(uid, cid))) -> 403
 * The DB query only runs for non-admin non-owners (the `&&` short-circuits), so
 * owners and admins pay nothing.
 */
export async function isAssignedToCustomer(userId: string, customerId: string): Promise<boolean> {
  if (!userId || !customerId) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("customer_assignments")
    .select("customer_id")
    .eq("customer_id", customerId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/** Customer ids a user has been assigned to (co-coach). Used to widen list queries. */
export async function assignedCustomerIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("customer_assignments")
    .select("customer_id")
    .eq("user_id", userId);
  return (data ?? []).map((r: any) => r.customer_id as string);
}

/**
 * MLM hierarchy — FULL CARE (read + write) since 2026-07-24.
 *
 * An "upline" user may view AND manage the customers owned by everyone transitively
 * below them in the profiles.parent_id tree (all levels, not just direct children —
 * see the recursive `profile_descendant_ids` RPC). Business rule from ต้น:
 * "upline สามารถดูแลได้ทุกระดับชั้นลงไป".
 *
 * ⚠️ Route authors: do NOT hand-roll owner/assigned checks — call `canManageCustomer`
 * so read and write paths can never drift apart again.
 */

/** User ids transitively below `userId` (their downline). Empty if none. */
export async function downlineUserIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const admin = createAdminClient();
  const { data } = await admin.rpc("profile_descendant_ids", { root: userId });
  // rpc returns setof uuid → array of strings
  return Array.isArray(data) ? (data as string[]) : [];
}

/**
 * THE access check for everything except "is this literally my own customer".
 *
 * True when the user may view *and* manage the customer because they are either a
 * co-coach (`customer_assignments`) or anywhere upline of the owner. Callers still
 * short-circuit on admin + owner first:
 *
 *   if (!isAdmin && c.coach_id !== uid && !(await canManageCustomer(uid, cid))) → 403
 */
export async function canManageCustomer(userId: string, customerId: string): Promise<boolean> {
  if (!userId || !customerId) return false;
  if (await isAssignedToCustomer(userId, customerId)) return true;
  return isDownlineCustomer(userId, customerId);
}

/** True if `customerId` is owned by anyone transitively below `userId` in the tree. */
export async function isDownlineCustomer(userId: string, customerId: string): Promise<boolean> {
  if (!userId || !customerId) return false;
  const downline = await downlineUserIds(userId);
  if (downline.length === 0) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .in("coach_id", downline)
    .maybeSingle();
  return !!data;
}
