import { createAdminClient } from "@/lib/supabase/admin";
import { ReportView } from "../../pulse/_components/ReportView";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pulse_assessments")
    .select("ai_output, blocked, block_reasons, sent_at, created_at, customers!inner(name)")
    .eq("share_token", params.token)
    .maybeSingle();

  if (!data) return <ErrorScreen body="ไม่พบรายงาน" />;
  if (!data.sent_at) return <ErrorScreen body="รายงานนี้ยังไม่ถูกเผยแพร่ — โค้ชของคุณจะส่งให้เมื่อพร้อมค่ะ" />;

  return (
    <ReportView
      customerName={(data.customers as any).name ?? "คุณ"}
      aiOutput={data.ai_output as any}
      blocked={data.blocked}
      blockReasons={data.block_reasons ?? []}
      generatedAt={data.sent_at}
    />
  );
}

function ErrorScreen({ body }: { body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="max-w-md rounded-3xl border border-ink-10 bg-white p-10 text-center">
        <div className="text-5xl">📋</div>
        <p className="mt-4 font-thai text-sm text-ink-60">{body}</p>
      </div>
    </main>
  );
}
