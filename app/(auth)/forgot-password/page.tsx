import Link from "next/link";
import { ForgotForm } from "./ForgotForm";

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-3xl border border-ink-10 bg-white p-10">
      <div className="mb-8">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-rose">Reset Password</div>
        <h1 className="font-head text-3xl font-extrabold tracking-tight text-ink">ลืม password?</h1>
        <p className="mt-2 font-thai text-sm leading-[1.7] text-ink-60">
          กรอก email ที่ใช้สมัคร — ระบบจะส่ง link สำหรับตั้ง password ใหม่
        </p>
      </div>

      <ForgotForm />

      <div className="mt-7 border-t border-ink-10 pt-6 text-sm">
        <Link href="/login" className="font-medium text-ink-60 hover:text-rose">← กลับไปเข้าสู่ระบบ</Link>
      </div>
    </div>
  );
}
