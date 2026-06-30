import { getSession } from "@/lib/auth/session";
import { Shell } from "../../_components/Shell";
// ★ Reuse v1 server actions directly (do NOT duplicate/modify them).
import { listUsers, listAssignableCustomers } from "@/app/admin/users/actions";
import { UsersManager } from "./_v2/UsersManager";

export const dynamic = "force-dynamic";

/**
 * UP Labs v2 · Admin · Users (SPEC §7.12)
 * ───────────────────────────────────────
 * Redesigned clinical-warm user management. Loads the SAME data as v1
 * (listUsers + listAssignableCustomers) and hands it to UsersManager, which
 * mirrors all v1 functionality: edit role · app grants · Assign customer
 * (co-coach) search+assign+unassign · password reset/link · create user.
 */
export default async function V2AdminUsersPage() {
  const session = await getSession(); // gated by app/v2/admin/layout.tsx (admin only)
  const [users, allCustomers] = await Promise.all([listUsers(), listAssignableCustomers()]);

  const breadcrumb = [{ label: "หน้าแรก", href: "/v2" }, { label: "ผู้ดูแลระบบ" }, { label: "ผู้ใช้" }];

  return (
    <Shell breadcrumb={breadcrumb} profile={session?.profile ?? undefined}>
      <UsersManager users={users} allCustomers={allCustomers} userCount={users.length} />
    </Shell>
  );
}
