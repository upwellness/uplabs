import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { canManageCustomer } from "@/lib/customers/access";
import { validateEntry } from "@/lib/food/entries";
import { insertEntry } from "@/lib/food/store";
import { recomputeQuietly } from "@/lib/health-design/load";

export const dynamic = "force-dynamic";

/**
 * POST /api/nutriscan/save — store a meal AFTER the person has seen (and possibly
 * edited) the AI estimate. The analyze endpoint no longer writes by itself.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "body ต้องเป็น JSON" }, { status: 400 }); }

  const customerId: string | null = typeof body.customer_id === "string" && body.customer_id ? body.customer_id : null;
  if (customerId) {
    const { data: c } = await createAdminClient().from("customers").select("coach_id").eq("id", customerId).maybeSingle();
    if (!c) return NextResponse.json({ error: "customer not found" }, { status: 404 });
    const ok = session.profile.role === "admin" || (c as any).coach_id === session.user.id || (await canManageCustomer(session.user.id, customerId));
    if (!ok) return NextResponse.json({ error: "ลูกค้าคนนี้ไม่ได้อยู่ในความดูแลของคุณ" }, { status: 403 });
  }

  const v = validateEntry(body, new Date().toISOString(), { source: body.source === "text" ? "text" : "photo", estimated_by: "gemini" });
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  try {
    const entry = await insertEntry({ customerId, userId: session.user.id, entry: v.value, raw: body.raw_analysis ?? undefined, edited: body.edited ?? null });
    if (customerId) await recomputeQuietly(customerId, "food_log");
    return NextResponse.json({ saved: true, entry });
  } catch (e: any) {
    console.error("[nutriscan/save]", e?.message ?? e);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}
