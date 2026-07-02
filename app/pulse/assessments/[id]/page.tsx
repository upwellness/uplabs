import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer, isDownlineCustomer } from "@/lib/customers/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReportView } from "../../_components/ReportView";

export const dynamic = "force-dynamic";

export default async function AssessmentPreviewPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const admin = createAdminClient();
  const { data } = await admin
    .from("pulse_assessments")
    .select("ai_output, blocked, block_reasons, sent_at, created_at, customer_id, customers!inner(name, coach_id)")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface px-6">
        <div className="max-w-md rounded-3xl border border-ink-10 bg-white p-10 text-center">
          <div className="text-5xl">⚠️</div>
          <p className="mt-4 font-thai text-sm text-ink-60">ไม่พบ assessment</p>
        </div>
      </main>
    );
  }

  // Permission: admin or owning coach
  const isAdmin = session.profile.role === "admin";
  const coachId = (data.customers as any).coach_id;
  if (!isAdmin && coachId !== session.user.id && !(await isAssignedToCustomer(session.user.id, data.customer_id)) && !(await isDownlineCustomer(session.user.id, data.customer_id))) redirect("/");

  return (
    <ReportView
      customerName={(data.customers as any).name ?? "ลูกค้า"}
      aiOutput={data.ai_output as any}
      blocked={data.blocked}
      blockReasons={data.block_reasons ?? []}
      generatedAt={data.created_at}
      isPreview={!data.sent_at}
    />
  );
}
