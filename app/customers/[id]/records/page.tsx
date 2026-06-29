import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer } from "@/lib/customers/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/ui/Logo";
import { CATEGORY_LABEL } from "@/lib/records/catalog";

export const dynamic = "force-dynamic";

export default async function RecordsListPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const admin = createAdminClient();
  const { data: customer } = await admin.from("customers").select("*").eq("id", params.id).maybeSingle();
  if (!customer) redirect("/customers");

  const isAdmin = session.profile.role === "admin";
  if (!isAdmin && customer.coach_id !== session.user.id && !(await isAssignedToCustomer(session.user.id, params.id))) redirect("/customers");

  const { data: records } = await admin.from("customer_records")
    .select("*")
    .eq("customer_id", params.id)
    .order("recorded_at", { ascending: false });

  // For each record, fetch value counts per category
  const recordIds = (records ?? []).map((r) => r.id);
  const { data: allValues } = recordIds.length > 0
    ? await admin.from("customer_lab_values")
        .select("record_id, category, status")
        .in("record_id", recordIds)
    : { data: [] };

  const valuesByRecord = new Map<string, { categories: Record<string, number>; abnormal: number }>();
  for (const v of allValues ?? []) {
    const cur = valuesByRecord.get(v.record_id) ?? { categories: {}, abnormal: 0 };
    cur.categories[v.category] = (cur.categories[v.category] ?? 0) + 1;
    if (v.status === "low" || v.status === "high" || v.status === "critical") cur.abnormal += 1;
    valuesByRecord.set(v.record_id, cur);
  }

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
          <div className="flex items-center gap-5">
            <Link href={`/customers/${params.id}`} className="text-ink-40 hover:text-ink transition-colors text-sm">← Profile</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-rose">
              Medical Records
            </span>
          </div>
          <Link href={`/customers/${params.id}/records/new`} className="rounded-full bg-rose px-4 py-2 text-sm font-semibold text-white">
            + เพิ่มผลตรวจ
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-content px-6 py-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Customer Records</div>
        <h1 className="mt-1 font-head text-[28px] font-extrabold tracking-tight text-ink">{customer.name}</h1>
        <p className="mt-1 font-thai text-sm text-ink-60">{(records ?? []).length} รอบการตรวจ</p>

        <section className="mt-6 space-y-3">
          {(records ?? []).length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-ink-10 bg-white py-16 text-center">
              <div className="text-4xl">🧾</div>
              <p className="mt-3 font-thai text-sm text-ink-40">ยังไม่มีระเบียนผลตรวจ</p>
              <Link href={`/customers/${params.id}/records/new`} className="mt-4 inline-block rounded-full bg-rose px-5 py-2 text-sm font-semibold text-white">
                + เพิ่มผลตรวจครั้งแรก
              </Link>
            </div>
          ) : (
            (records ?? []).map((r: any) => {
              const stats = valuesByRecord.get(r.id) ?? { categories: {}, abnormal: 0 };
              return (
                <Link key={r.id} href={`/customers/${params.id}/records/${r.id}`}
                  className="block rounded-2xl border border-ink-10 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-head text-[16px] font-bold text-ink">
                          {new Date(r.recorded_at).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
                        </h3>
                        {stats.abnormal > 0 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wider text-amber-700">
                            {stats.abnormal} ABNORMAL
                          </span>
                        )}
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-ink-40">
                        {r.source ?? "—"} {r.source_id && `· ${r.source_id}`} · {r.document_type ?? "lab"}
                      </div>
                      {r.notes && <p className="mt-2 font-thai text-[12px] text-ink-60 line-clamp-2">{r.notes}</p>}
                    </div>
                    <span className="text-ink-20">›</span>
                  </div>

                  {/* Category badges */}
                  {Object.keys(stats.categories).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Object.entries(stats.categories).map(([cat, count]) => (
                        <span key={cat} className="inline-flex items-center gap-1 rounded-full bg-ink-5 px-2.5 py-0.5 text-[10px] font-mono">
                          {CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL] ?? cat}
                          <span className="font-bold text-ink">{count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
