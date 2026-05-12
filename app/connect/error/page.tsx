import { Logo } from "@/components/ui/Logo";

export default function ConnectError({ searchParams }: { searchParams: { reason?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="max-w-md rounded-3xl border border-ink-10 bg-white p-10 text-center">
        <div className="mb-4 text-5xl">⚠️</div>
        <Logo size="md" />
        <h1 className="mt-4 font-head text-2xl font-extrabold text-ink">เชื่อมต่อไม่สำเร็จ</h1>
        <p className="mt-3 font-thai text-[14px] leading-[1.7] text-ink-60">
          ลองใหม่จากลิงก์เดิมอีกครั้งได้ ถ้ายังไม่ได้ติดต่อโค้ชนะคะ
        </p>
        {searchParams.reason && (
          <p className="mt-4 break-all rounded-lg bg-surface p-3 font-mono text-[11px] text-ink-40">
            {searchParams.reason}
          </p>
        )}
      </div>
    </main>
  );
}
