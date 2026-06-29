import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer } from "@/lib/customers/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/ui/Logo";
import { NewRecordForm } from "./NewRecordForm";

export const dynamic = "force-dynamic";

export default async function NewRecordPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const admin = createAdminClient();
  const { data: customer } = await admin.from("customers").select("*").eq("id", params.id).maybeSingle();
  if (!customer) redirect("/customers");

  const isAdmin = session.profile.role === "admin";
  if (!isAdmin && customer.coach_id !== session.user.id && !(await isAssignedToCustomer(session.user.id, params.id))) redirect("/customers");

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
          <div className="flex items-center gap-5">
            <Link href={`/customers/${params.id}/records`} className="text-ink-40 hover:text-ink transition-colors text-sm">← Records</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-rose">
              เพิ่มผลตรวจ
            </span>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-content px-6 py-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">New Record</div>
        <h1 className="mt-1 font-head text-[28px] font-extrabold tracking-tight text-ink">เพิ่มผลตรวจของ {customer.name}</h1>
        <p className="mt-1 font-thai text-sm text-ink-60">
          เลือก metric ที่ตรวจมา · ใส่ค่า · ถ้า metric ไม่อยู่ในรายการ บอกผมให้เพิ่มได้
        </p>
        <div className="mt-6">
          <NewRecordForm customerId={params.id} />
        </div>
      </div>
    </main>
  );
}
