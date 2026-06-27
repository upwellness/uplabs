import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Logo } from "@/components/ui/Logo";
import { LineBotDashboard } from "./_components/LineBotDashboard";

export const dynamic = "force-dynamic";

export default async function LineBotPage() {
  // Layout already gates access; this guards direct render too (matches plate-planner/page).
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
          <div className="flex items-center gap-5">
            <Link href="/" className="text-ink-40 hover:text-ink transition-colors text-sm">← Hub</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-wellness-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-wellness">
              LINE Bot
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-content px-4 py-6 sm:px-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
          น้องจาน · Plate Planner LINE Bot
        </div>
        <h1 className="mt-1 font-head text-[26px] font-extrabold tracking-tight text-ink sm:text-[28px]">
          🍽️ LINE Bot <span className="text-base font-semibold text-ink-40 sm:text-lg">น้องจาน</span>
        </h1>
        <p className="mt-2 max-w-2xl font-thai text-sm text-ink-60">
          ผูก LINE group เข้ากับโปรไฟล์ลูกค้า · ตั้งเป้าหมาย/ข้อจำกัดอาหาร + วิตามินต่อมื้อ · บอทส่งเมนูรายวันให้อัตโนมัติ
          (เมนูคำนวณจาก Plate Planner engine ตัวเดียวกับในเว็บ)
        </p>

        <LineBotDashboard />
      </div>
    </main>
  );
}
