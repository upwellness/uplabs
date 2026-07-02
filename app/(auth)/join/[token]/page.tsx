import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { RegisterForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("user_invites")
    .select("token, created_by, used_at, expires_at")
    .eq("token", params.token)
    .maybeSingle();

  const invalid =
    !invite ? "ลิงก์เชิญไม่ถูกต้อง"
    : invite.used_at ? "ลิงก์นี้ถูกใช้ไปแล้ว"
    : new Date(invite.expires_at).getTime() < Date.now() ? "ลิงก์เชิญหมดอายุแล้ว"
    : null;

  let inviterName: string | null = null;
  if (invite && !invalid) {
    const { data: inviter } = await admin
      .from("profiles")
      .select("display_name, email")
      .eq("id", invite.created_by)
      .maybeSingle();
    inviterName = inviter?.display_name ?? inviter?.email ?? null;
  }

  if (invalid) {
    return (
      <div className="rounded-3xl border border-ink-10 bg-white p-10 text-center">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-status-danger">Invitation</div>
        <h1 className="font-head text-2xl font-extrabold tracking-tight text-ink">{invalid}</h1>
        <p className="mt-2 font-thai text-sm text-ink-60">กรุณาขอลิงก์เชิญใหม่จากผู้ที่ชวนคุณ</p>
        <Link href="/login" className="mt-6 inline-block rounded-full bg-rose px-5 py-2 text-[13px] font-semibold text-white hover:bg-rose-mid">
          ไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-ink-10 bg-white p-10">
      <div className="mb-8">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-rose">Create Account</div>
        <h1 className="font-head text-3xl font-extrabold tracking-tight text-ink">สมัครสมาชิก</h1>
        <p className="mt-2 font-thai text-sm text-ink-60">
          {inviterName ? <>คุณได้รับเชิญจาก <strong className="text-ink">{inviterName}</strong> · </> : null}
          ตั้ง password ของคุณเอง และกรอก email จริง (ไว้ใช้ reset password)
        </p>
      </div>
      <RegisterForm token={params.token} />
      <p className="mt-6 text-center font-thai text-[13px] text-ink-60">
        มีบัญชีอยู่แล้ว? <Link href="/login" className="font-semibold text-rose hover:underline">เข้าสู่ระบบ</Link>
      </p>
    </div>
  );
}
