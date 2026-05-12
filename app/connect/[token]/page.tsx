import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/ui/Logo";
import { BrowserCheck } from "./BrowserCheck";

export const dynamic = "force-dynamic";

export default async function ConnectPage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("pulse_invites")
    .select("token, customer_id, expires_at, used_at, customers!inner(name)")
    .eq("token", params.token)
    .maybeSingle();

  if (!invite) {
    return <ErrorScreen title="ลิงก์ไม่ถูกต้อง" body="ลิงก์เชิญนี้ไม่พบในระบบ — ติดต่อโค้ชเพื่อขอลิงก์ใหม่" />;
  }
  if (invite.used_at) {
    return <ErrorScreen title="ลิงก์ถูกใช้แล้ว" body="ลิงก์นี้ใช้ไปแล้ว ถ้าต้องการเชื่อมใหม่ ติดต่อโค้ชเพื่อขอลิงก์ใหม่" />;
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return <ErrorScreen title="ลิงก์หมดอายุ" body="ลิงก์นี้หมดอายุแล้ว — ติดต่อโค้ชเพื่อขอลิงก์ใหม่" />;
  }

  const name = (invite.customers as any)?.name ?? "คุณ";
  const h = headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const fullUrl = `${proto}://${host}/connect/${params.token}`;

  return (
    <main className="min-h-screen bg-surface">
      <header className="border-b border-ink-10 bg-white">
        <div className="mx-auto flex h-14 max-w-content items-center justify-center px-6">
          <Logo size="sm" />
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-6 py-12">
        <BrowserCheck url={fullUrl} />
        <div className="rounded-3xl border border-ink-10 bg-white p-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">UP Pulse · Connect</div>
          <h1 className="mt-2 font-head text-[28px] font-extrabold tracking-tight text-ink">
            สวัสดีค่ะ {name} 👋
          </h1>
          <p className="mt-3 font-thai text-[15px] leading-[1.7] text-ink-60">
            โค้ชของคุณส่งลิงก์นี้มาเพื่อเชื่อมต่อข้อมูลสุขภาพจาก smartwatch ของคุณ — เพื่อใช้แนะนำดูแลคุณได้ตรงจุดมากขึ้น
          </p>

          <div className="mt-8 space-y-5 border-t border-ink-5 pt-6">
            <Section title="📊 เราจะดึงข้อมูลอะไร">
              <li>อัตราการเต้นของหัวใจ (Heart Rate · HRV)</li>
              <li>การนอนหลับ (จำนวนชั่วโมง · ช่วงนอน)</li>
              <li>การเคลื่อนไหวรายวัน (steps · calories)</li>
              <li>ออกซิเจนในเลือด (SpO2) — ถ้ารองรับ</li>
            </Section>

            <Section title="🎯 ใช้ทำอะไร">
              <li>วิเคราะห์ว่าร่างกายอาจจะขาด nutrient อะไร</li>
              <li>แนะนำ supplement ที่เหมาะกับคุณ — ผ่านเภสัชกรของ UP Wellness</li>
              <li>ติดตามผลก่อน-หลัง ปรับให้ตรงคุณ</li>
            </Section>

            <Section title="👥 ใครเห็นข้อมูล">
              <li>คุณ — เห็นได้ทุกอย่างตลอดเวลา</li>
              <li>โค้ชของคุณ + เภสัชกรของ UP Wellness</li>
              <li>เราไม่ขาย · ไม่แชร์ third party</li>
            </Section>

            <Section title="⏱️ เก็บไว้นานแค่ไหน">
              <li>2 ปีจากวันที่บันทึก จากนั้นลบอัตโนมัติ</li>
              <li>ยกเลิกการเชื่อมต่อและขอลบทันทีได้ตลอดเวลา</li>
            </Section>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-ink-5 pt-6">
            <p className="font-thai text-[13px] text-ink-60">
              ขั้นต่อไป คุณจะเข้าสู่หน้า login Google → กดยอมรับสิทธิ์การอ่านข้อมูลสุขภาพ
            </p>
            <a
              href={`/api/pulse/oauth/start?token=${params.token}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rose px-6 py-3.5 font-head text-base font-bold text-white shadow-[0_4px_12px_rgba(140,76,76,0.25)] transition-all hover:shadow-[0_6px_20px_rgba(140,76,76,0.35)] active:scale-[0.98]"
            >
              ✓ ยอมรับและเชื่อมต่อ Google Fit
            </a>
            <p className="text-center font-mono text-[10px] text-ink-40">
              ถ้ายังไม่ยินยอม ปิดหน้านี้ได้เลย — เราจะไม่ดึงข้อมูลใดๆ
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-thai text-[13px] font-bold text-ink">{title}</div>
      <ul className="mt-1.5 ml-5 list-disc space-y-1 font-thai text-[13px] text-ink-60">{children}</ul>
    </div>
  );
}

function ErrorScreen({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="max-w-md rounded-3xl border border-ink-10 bg-white p-10 text-center">
        <div className="text-5xl">⚠️</div>
        <h1 className="mt-4 font-head text-2xl font-extrabold text-ink">{title}</h1>
        <p className="mt-3 font-thai text-sm text-ink-60">{body}</p>
      </div>
    </main>
  );
}
