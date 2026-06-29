import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer } from "@/lib/customers/access";

/**
 * DELETE · Remove allergy test (cascades to allergens via FK ON DELETE CASCADE)
 */
export async function DELETE(_req: Request, { params }: { params: { id: string; testId: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const admin = createAdminClient();

    // Verify customer ownership
    const { data: customer } = await admin
      .from("customers")
      .select("id, coach_id")
      .eq("id", params.id)
      .maybeSingle();
    if (!customer) return NextResponse.json({ error: "customer not found" }, { status: 404 });

    const isAdmin = session.profile.role === "admin";
    if (!isAdmin && customer.coach_id !== session.user.id && !(await isAssignedToCustomer(session.user.id, params.id))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { error } = await admin
      .from("customer_allergy_tests")
      .delete()
      .eq("id", params.testId)
      .eq("customer_id", params.id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
