import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer, isDownlineCustomer } from "@/lib/customers/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/ui/Logo";
import { RecordTabs } from "./RecordTabs";

export const dynamic = "force-dynamic";

export default async function RecordDetailPage({ params }: { params: { id: string; recordId: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const admin = createAdminClient();
  const [{ data: customer }, { data: record }, { data: values }] = await Promise.all([
    admin.from("customers").select("name, gender, coach_id").eq("id", params.id).maybeSingle(),
    admin.from("customer_records").select("*").eq("id", params.recordId).maybeSingle(),
    admin.from("customer_lab_values").select("*")
      .eq("record_id", params.recordId)
      .order("category"),
  ]);

  if (!customer || !record) redirect(`/customers/${params.id}/records`);

  const isAdmin = session.profile.role === "admin";
  if (!isAdmin && customer.coach_id !== session.user.id && !(await isAssignedToCustomer(session.user.id, params.id)) && !(await isDownlineCustomer(session.user.id, params.id))) redirect(`/customers/${params.id}`);

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
          <div className="flex items-center gap-5">
            <Link href={`/customers/${params.id}/records`} className="text-ink-40 hover:text-ink transition-colors text-sm">← Records</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-content px-6 py-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
          Record · {record.source_id ?? record.id.slice(0, 8)}
        </div>
        <h1 className="mt-1 font-head text-[28px] font-extrabold tracking-tight text-ink">
          ผลตรวจ {new Date(record.recorded_at).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 font-thai text-sm text-ink-60">
          <span>{customer.name}</span>
          <Dot />
          <span>{record.source ?? "—"}</span>
          <Dot />
          <span>{(values ?? []).length} ค่า</span>
        </div>
        {record.notes && (
          <div className="mt-4 rounded-2xl border border-ink-10 bg-white p-4 font-thai text-[13px] leading-[1.7] text-ink-60 whitespace-pre-wrap">
            <strong className="text-ink">หมายเหตุ:</strong> {record.notes}
          </div>
        )}

        <div className="mt-6">
          <RecordTabs values={(values ?? []) as any} gender={customer.gender} />
        </div>
      </div>
    </main>
  );
}

function Dot() { return <span className="h-1 w-1 rounded-full bg-ink-20" />; }
