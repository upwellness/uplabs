import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/ui/Logo";
import { CheckForm } from "./CheckForm";

export const dynamic = "force-dynamic";

export default async function PublicCheckPage({ params }: { params: { coachId: string } }) {
  const admin = createAdminClient();
  const { data: coach } = await admin
    .from("profiles")
    .select("display_name, email")
    .eq("id", params.coachId).maybeSingle();

  const coachName = coach?.display_name ?? "UP Wellness Coach";

  return (
    <main className="min-h-screen bg-surface">
      <header className="border-b border-ink-10 bg-white">
        <div className="mx-auto flex h-14 max-w-content items-center justify-center px-6">
          <Logo size="sm" />
        </div>
      </header>
      <section className="mx-auto max-w-2xl px-6 py-10">
        <div className="rounded-3xl border border-ink-10 bg-white p-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">UP Wellness · Health Check</div>
          <h1 className="mt-2 font-head text-[28px] font-extrabold tracking-tight text-ink">
            ตรวจสุขภาพเบื้องต้น 3 นาที
          </h1>
          <p className="mt-3 font-thai text-[14px] leading-[1.7] text-ink-60">
            ตอบ 20+ คำถามสั้นๆ — รับผล risk score + คำแนะนำเฉพาะคุณ + เชื่อมต่อกับ <strong>{coachName}</strong> สำหรับติดตามผล
          </p>
          <CheckForm coachId={params.coachId} coachName={coachName} />
        </div>
      </section>
    </main>
  );
}
