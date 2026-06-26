import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/ui/Logo";
import PlatePlanner from "./PlatePlanner";

export const dynamic = "force-dynamic";

export default async function PlatePlannerPage({
  searchParams,
}: {
  searchParams: { customer?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // ── Optional prefill: ?customer=<id> → ดึงส่วนสูง + น้ำหนักล่าสุดมาเติมให้ในฟอร์ม ──
  // (ห่อ try/catch ทั้งก้อน — หน้าไม่พังถ้า query/permission มีปัญหา · ไม่มี/ไม่เจอ = ใช้ค่า default ของ component)
  let initialH: number | undefined;
  let initialW: number | undefined;
  const customerId = searchParams.customer;
  if (customerId) {
    try {
      const admin = createAdminClient();
      const [{ data: customer }, { data: latestM }] = await Promise.all([
        admin.from("customers").select("height").eq("id", customerId).maybeSingle(),
        admin
          .from("measurements")
          .select("weight, recorded_at")
          .eq("customer_id", customerId)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const h = customer?.height;
      if (typeof h === "number" && h > 0) initialH = h;
      const wRaw = latestM?.weight;
      const w = typeof wRaw === "number" ? wRaw : wRaw != null ? Number(wRaw) : NaN;
      if (Number.isFinite(w) && w > 0) initialW = w;
    } catch {
      /* prefill is best-effort — fall through with undefined */
    }
  }

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
          <div className="flex items-center gap-5">
            <Link href="/" className="text-ink-40 hover:text-ink transition-colors text-sm">← Hub</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-wellness-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-wellness">
              Plate Planner
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-content px-4 py-6 sm:px-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">
          Muscle-Centric · Dr. Gabrielle Lyon
        </div>
        <h1 className="mt-1 font-head text-[26px] font-extrabold tracking-tight text-ink sm:text-[28px]">
          🍽️ Plate Planner <span className="text-base font-semibold text-ink-40 sm:text-lg">by Dr. Gabrielle Lyon</span>
        </h1>
        <p className="mt-2 max-w-2xl font-thai text-sm text-ink-60">
          วางแผนมื้ออาหารตามหลักกล้ามเนื้อ (Forever Strong) · 3 เป้าหมายคำนวณแยก (ลด / longevity / กล้าม) · อาหารไทยไม่ซ้ำ + รูปจาน portion จริง · สร้างรูปอาหารได้เลยไม่ต้องตั้งค่า
        </p>

        <div className="mt-5 overflow-hidden rounded-2xl border border-ink-10 bg-white shadow-[0_12px_40px_-20px_rgba(0,0,0,0.18)]">
          <PlatePlanner initialW={initialW} initialH={initialH} />
        </div>
      </div>
    </main>
  );
}
