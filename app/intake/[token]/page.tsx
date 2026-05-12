import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/ui/Logo";
import { IntakeForm } from "./IntakeForm";

export const dynamic = "force-dynamic";

export default async function IntakePage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();
  const { data: intake } = await admin
    .from("pulse_intakes")
    .select("token, submitted_at, expires_at, customers!inner(name)")
    .eq("token", params.token).maybeSingle();

  if (!intake) return <ErrorScreen title="ลิงก์ไม่ถูกต้อง" body="ติดต่อโค้ชเพื่อขอลิงก์ใหม่" />;
  if (intake.submitted_at) return <ErrorScreen title="กรอกข้อมูลแล้ว" body="ขอบคุณที่กรอกข้อมูล โค้ชของคุณจะส่งคำแนะนำให้เร็วๆ นี้" emoji="✅" />;
  if (new Date(intake.expires_at).getTime() < Date.now())
    return <ErrorScreen title="ลิงก์หมดอายุ" body="ติดต่อโค้ชเพื่อขอลิงก์ใหม่" />;

  const name = (intake.customers as any).name ?? "คุณ";

  return (
    <main className="min-h-screen bg-surface">
      <header className="border-b border-ink-10 bg-white">
        <div className="mx-auto flex h-14 max-w-content items-center justify-center px-6">
          <Logo size="sm" />
        </div>
      </header>
      <section className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-3xl border border-ink-10 bg-white p-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">UP Pulse · Intake</div>
          <h1 className="mt-2 font-head text-[28px] font-extrabold tracking-tight text-ink">สวัสดีค่ะ {name} 👋</h1>
          <p className="mt-3 font-thai text-[14px] leading-[1.7] text-ink-60">
            ก่อนเราจะวิเคราะห์ข้อมูลจาก smartwatch ขอเช็คข้อมูลสุขภาพพื้นฐานก่อนนะคะ — ใช้เวลา 2 นาที
          </p>
          <IntakeForm token={params.token} />
        </div>
      </section>
    </main>
  );
}

function ErrorScreen({ title, body, emoji = "⚠️" }: { title: string; body: string; emoji?: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="max-w-md rounded-3xl border border-ink-10 bg-white p-10 text-center">
        <div className="text-5xl">{emoji}</div>
        <h1 className="mt-4 font-head text-2xl font-extrabold text-ink">{title}</h1>
        <p className="mt-3 font-thai text-sm text-ink-60">{body}</p>
      </div>
    </main>
  );
}
