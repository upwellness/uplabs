import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { Logo } from "@/components/ui/Logo";
import { ConfigEditor } from "./ConfigEditor";

export const dynamic = "force-dynamic";

export default async function LineBotCustomerPage({
  params,
}: {
  params: { customerId: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Verify the customer exists + the coach owns it (admin: any). Mirrors the
  // admin-client + coach_id check used by the customer-child API routes.
  const admin = createAdminClient();
  const { data: customer } = await admin
    .from("customers")
    .select("id, name, height, coach_id")
    .eq("id", params.customerId)
    .maybeSingle();

  if (!customer) notFound();
  const isAdmin = session.profile.role === "admin";
  if (!isAdmin && customer.coach_id !== session.user.id) redirect("/line-bot");

  // Latest weight for the preview hint (best-effort).
  let latestWeight: number | null = null;
  try {
    const { data: m } = await admin
      .from("measurements")
      .select("weight, recorded_at")
      .eq("customer_id", params.customerId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const w = m?.weight;
    latestWeight = typeof w === "number" ? w : w != null ? Number(w) : null;
    if (latestWeight != null && !Number.isFinite(latestWeight)) latestWeight = null;
  } catch {
    /* best-effort */
  }

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
          <div className="flex items-center gap-5">
            <Link href="/line-bot" className="text-ink-40 hover:text-ink transition-colors text-sm">← LINE Bot</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-wellness-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-wellness">
              ตั้งค่าแผน
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-content px-4 py-6 sm:px-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Plate config · supplements</div>
        <h1 className="mt-1 font-head text-[26px] font-extrabold tracking-tight text-ink sm:text-[28px]">
          ⚙️ {customer.name}
        </h1>
        <p className="mt-2 max-w-2xl font-thai text-sm text-ink-60">
          ตั้งเป้าหมาย + ข้อจำกัดอาหารที่ป้อนให้ engine และวิตามิน/อาหารเสริมต่อมื้อ — บอทจะใช้ค่านี้กับ
          ส่วนสูง {customer.height ? `${customer.height} ซม.` : "(ยังไม่มีในโปรไฟล์)"}
          {latestWeight != null ? ` + น้ำหนักล่าสุด ${latestWeight} กก.` : " + น้ำหนักล่าสุด (ยังไม่มี)"}
        </p>

        {(!customer.height || latestWeight == null) && (
          <div className="mt-4 rounded-xl border border-amber-pale bg-amber-ultra px-4 py-3 font-thai text-[12.5px] text-amber">
            ⚠ บอทคำนวณเมนูไม่ได้จนกว่าจะมี <b>ส่วนสูง</b> และ <b>น้ำหนักล่าสุด</b> ของลูกค้า —
            เพิ่มได้ที่หน้า <Link href={`/customers/${customer.id}`} className="underline">โปรไฟล์ลูกค้า</Link> (ส่วนสูง) และ BCA/measurements (น้ำหนัก)
          </div>
        )}

        <ConfigEditor customerId={customer.id} />
      </div>
    </main>
  );
}
