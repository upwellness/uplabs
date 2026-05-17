import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default function LoginPage({ searchParams }: { searchParams: { next?: string; e?: string } }) {
  return (
    <div className="rounded-3xl border border-ink-10 bg-white p-10">
      <div className="mb-8">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-rose">Sign in</div>
        <h1 className="font-head text-3xl font-extrabold tracking-tight text-ink">เข้าสู่ระบบ UP Wellness Ops</h1>
        <p className="mt-2 font-thai text-sm text-ink-60">ใช้ email และ password ที่ admin มอบให้</p>
      </div>

      <LoginForm next={searchParams.next} initialError={searchParams.e} />

      <div className="mt-7 flex items-center justify-between border-t border-ink-10 pt-6 text-sm">
        <Link href="/forgot-password" className="font-medium text-ink-60 hover:text-rose">ลืม password?</Link>
        <span className="font-mono text-[11px] text-ink-40">v2.0</span>
      </div>
    </div>
  );
}
