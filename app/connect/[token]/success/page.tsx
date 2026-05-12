import { Logo } from "@/components/ui/Logo";

export default function ConnectSuccess() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="max-w-md rounded-3xl border border-ink-10 bg-white p-10 text-center">
        <div className="mb-4 text-5xl">✅</div>
        <Logo size="md" />
        <h1 className="mt-4 font-head text-2xl font-extrabold text-ink">เชื่อมต่อสำเร็จ</h1>
        <p className="mt-3 font-thai text-[14px] leading-[1.7] text-ink-60">
          เราได้ดึงข้อมูล 7 วันล่าสุดของคุณเรียบร้อยแล้ว — โค้ชจะวิเคราะห์และส่งคำแนะนำให้คุณเร็วๆ นี้ค่ะ
        </p>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-wider text-ink-40">
          ปิดหน้านี้ได้เลย
        </p>
      </div>
    </main>
  );
}
