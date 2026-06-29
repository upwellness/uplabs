import { listUsers, listAssignableCustomers } from "./actions";
import { UsersTable } from "./UsersTable";
import { NewUserButton } from "./NewUserButton";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [users, allCustomers] = await Promise.all([listUsers(), listAssignableCustomers()]);

  return (
    <div className="mx-auto max-w-content px-10 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">User Administration</div>
          <h1 className="mt-2 font-head text-3xl font-extrabold tracking-tight text-ink">จัดการผู้ใช้</h1>
          <p className="mt-2 font-thai text-sm text-ink-60">{users.length} user · จัดการ role · email · password reset · permissions</p>
        </div>
        <NewUserButton />
      </header>

      <UsersTable users={users} allCustomers={allCustomers} />
    </div>
  );
}
