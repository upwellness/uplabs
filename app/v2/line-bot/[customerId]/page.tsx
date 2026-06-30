import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, PencilLine, ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer } from "@/lib/customers/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { Shell } from "../../_components/Shell";
import { IdentityBlock } from "@/lib/v2/IdentityBlock";
import { displayName } from "@/lib/v2/identity";
import { ConfigEditor } from "./_v2/ConfigEditor";

export const dynamic = "force-dynamic";

/**
 * UP Labs v2 · LINE Bot per-customer config (SPEC §7.10)
 * ──────────────────────────────────────────────────────
 * Mirrors v1 app/line-bot/[customerId]/page.tsx — same ownership/co-coach gate
 * (admin: any · coach_id · assignment) and the same height/weight readiness hint.
 * Redesigned clinical-warm: IdentityBlock header (§4) + ConfigEditor (reuses
 * /api/line-bot/config/[customerId] + /supplements/[customerId]).
 */
export default async function V2LineBotCustomerPage({
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
    .select("id, name, gender, birth_date, birth_year, height, coach_id")
    .eq("id", params.customerId)
    .maybeSingle();

  if (!customer) notFound();
  const isAdmin = session.profile.role === "admin";
  if (!isAdmin && customer.coach_id !== session.user.id && !(await isAssignedToCustomer(session.user.id, params.customerId))) {
    redirect("/v2/line-bot");
  }

  // Latest weight for the readiness hint (best-effort).
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

  const name = displayName(customer as any);
  const breadcrumb = [
    { label: "หน้าแรก", href: "/v2" },
    { label: "LINE Bot", href: "/v2/line-bot" },
    { label: name },
  ];

  const notReady = !customer.height || latestWeight == null;

  return (
    <Shell breadcrumb={breadcrumb}>
      <div className="mb-4">
        <Link
          href="/v2/line-bot"
          className="inline-flex min-h-[40px] items-center gap-1.5 text-[13px] font-semibold text-ink-60 transition-colors hover:text-rose"
        >
          <ArrowLeft size={15} strokeWidth={2.25} aria-hidden /> กลับไปหน้า LINE Bot
        </Link>
      </div>

      {/* Page header */}
      <div className="mb-4">
        <h1 className="font-head text-[23px] font-extrabold tracking-tight text-ink">ตั้งค่าแผน &amp; วิตามิน</h1>
        <p className="mt-1 max-w-2xl font-thai text-[13px] leading-[1.6] text-ink-60">
          ตั้งเป้าหมาย + ข้อจำกัดอาหารที่ป้อนให้ engine และวิตามิน/อาหารเสริมต่อมื้อ — บอทจะใช้ค่านี้คู่กับ
          ส่วนสูง {customer.height ? `${customer.height} ซม.` : "(ยังไม่มีในโปรไฟล์)"}
          {latestWeight != null ? ` + น้ำหนักล่าสุด ${latestWeight} กก.` : " + น้ำหนักล่าสุด (ยังไม่มี)"}
        </p>
      </div>

      {/* ★ Identity block (SPEC §4): name · DOB ค.ศ. · age · gender · height */}
      <IdentityBlock customer={customer as any} editHref={`/customers/${customer.id}`} className="mb-5" />

      {notReady && (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-pale bg-amber-ultra px-4 py-3 font-thai text-[12.5px] leading-[1.6] text-amber">
          <AlertTriangle size={16} strokeWidth={2.25} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            บอทคำนวณเมนูไม่ได้จนกว่าจะมี <b>ส่วนสูง</b> และ <b>น้ำหนักล่าสุด</b> ของลูกค้า — เพิ่มได้ที่หน้า{" "}
            <Link href={`/customers/${customer.id}`} className="inline-flex items-center gap-1 font-semibold underline">
              <PencilLine size={12} strokeWidth={2.25} aria-hidden /> โปรไฟล์ลูกค้า
            </Link>{" "}
            (ส่วนสูง) และ BCA/measurements (น้ำหนัก)
          </span>
        </div>
      )}

      <ConfigEditor customerId={customer.id} />
    </Shell>
  );
}
