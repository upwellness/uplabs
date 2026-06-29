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
