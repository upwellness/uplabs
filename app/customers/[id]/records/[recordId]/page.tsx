import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/ui/Logo";
import { CATEGORY_LABEL, type Category } from "@/lib/records/catalog";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, { fg: string; bg: string; label: string }> = {
  normal:     { fg: "#16A34A", bg: "#DCFCE7", label: "ปกติ" },
  low:        { fg: "#F97316", bg: "#FED7AA", label: "ต่ำกว่าปกติ" },
  high:       { fg: "#DC2626", bg: "#FEE2E2", label: "สูงกว่าปกติ" },
  borderline: { fg: "#EAB308", bg: "#FEF9C3", label: "borderline" },
  critical:   { fg: "#7F1D1D", bg: "#FECACA", label: "วิกฤต" },
  unknown:    { fg: "#64748B", bg: "#F1F5F9", label: "—" },
};

export default async function RecordDetailPage({ params }: { params: { id: string; recordId: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const admin = createAdminClient();
  const [{ data: customer }, { data: record }, { data: values }] = await Promise.all([
    admin.from("customers").select("name, coach_id").eq("id", params.id).maybeSingle(),
    admin.from("customer_records").select("*").eq("id", params.recordId).maybeSingle(),
    admin.from("customer_lab_values").select("*")
      .eq("record_id", params.recordId)
      .order("category"),
  ]);

  if (!customer || !record) redirect(`/customers/${params.id}/records`);

  const isAdmin = session.profile.role === "admin";
  if (!isAdmin && customer.coach_id !== session.user.id) redirect(`/customers/${params.id}`);

  // Group values by category
  const grouped = new Map<string, any[]>();
  for (const v of values ?? []) {
    (grouped.get(v.category) ?? grouped.set(v.category, []).get(v.category))!.push(v);
  }

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
          <div className="mt-4 rounded-2xl border border-ink-10 bg-white p-4 font-thai text-[13px] leading-[1.7] text-ink-60">
            <strong className="text-ink">หมายเหตุ:</strong> {record.notes}
          </div>
        )}

        {/* Values grouped by category */}
        <section className="mt-6 space-y-4">
          {Array.from(grouped.entries()).map(([cat, items]) => (
            <div key={cat} className="rounded-3xl border border-ink-10 bg-white p-6">
              <h2 className="font-head text-[16px] font-extrabold tracking-tight text-ink">
                {CATEGORY_LABEL[cat as Category] ?? cat}
              </h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-10 text-left">
                      <Th>รายการ</Th>
                      <Th align="right">ผล</Th>
                      <Th>หน่วย</Th>
                      <Th>ค่าปกติ</Th>
                      <Th>สถานะ</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((v: any) => {
                      const meta = STATUS_COLOR[v.status] ?? STATUS_COLOR.unknown;
                      const range = v.ref_low != null && v.ref_high != null
                        ? `${v.ref_low} - ${v.ref_high}`
                        : v.ref_low != null   ? `> ${v.ref_low}`
                        : v.ref_high != null  ? `< ${v.ref_high}`
                        : v.ref_text ?? "—";
                      return (
                        <tr key={v.id} className="border-b border-ink-5 last:border-b-0">
                          <Td>
                            <div className="font-thai text-ink">{v.metric_label_th ?? v.metric_key}</div>
                            {v.metric_label_en && <div className="font-mono text-[10px] text-ink-40">{v.metric_label_en}</div>}
                          </Td>
                          <Td align="right">
                            <strong className="font-mono text-[14px] text-ink" style={{ color: meta.fg }}>
                              {v.value ?? "—"}
                            </strong>
                          </Td>
                          <Td>{v.unit || "—"}</Td>
                          <Td><span className="font-mono text-[11px] text-ink-60">{range}</span></Td>
                          <Td>
                            <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-mono font-bold"
                              style={{ background: meta.bg, color: meta.fg }}>
                              {meta.label}
                            </span>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-40 ${align === "right" ? "text-right" : ""}`}>{children}</th>;
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={`px-3 py-3 ${align === "right" ? "text-right" : ""}`}>{children}</td>;
}
function Dot() { return <span className="h-1 w-1 rounded-full bg-ink-20" />; }
