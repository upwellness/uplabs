import { ResetForm } from "./ResetForm";

export default function ResetPasswordPage() {
  return (
    <div className="rounded-3xl border border-ink-10 bg-white p-10">
      <div className="mb-8">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-rose">Set New Password</div>
        <h1 className="font-head text-3xl font-extrabold tracking-tight text-ink">ตั้ง password ใหม่</h1>
        <p className="mt-2 font-thai text-sm text-ink-60">อย่างน้อย 8 ตัวอักษร แนะนำผสมตัวอักษร+ตัวเลข</p>
      </div>
      <ResetForm />
    </div>
  );
}
