import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer } from "@/lib/customers/access";

/**
 * POST · Create new allergy test + bulk insert allergens
 * Body: { test: {...}, allergens: [{...}] }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json();
    const { test, allergens } = body;

    if (!test || !test.test_type || !test.tested_at) {
      return NextResponse.json({ error: "test.test_type and tested_at required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify customer exists + user can access
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

    // Insert test
    const { data: newTest, error: testError } = await admin
      .from("customer_allergy_tests")
      .insert({
        customer_id: params.id,
        test_type:   test.test_type,
        test_lab:    test.test_lab ?? null,
        test_name:   test.test_name ?? null,
        panel_size:  test.panel_size ?? null,
        tested_at:   test.tested_at,
        source_url:  test.source_url ?? null,
        notes:       test.notes ?? null,
        created_by:  session.user.id,
      })
      .select()
      .single();

    if (testError) throw testError;

    // Insert allergens
    if (Array.isArray(allergens) && allergens.length > 0) {
      const rows = allergens.map((a: any) => ({
        test_id:            newTest.id,
        customer_id:        params.id,
        food_key:           a.food_key,
        food_name_th:       a.food_name_th ?? null,
        food_name_en:       a.food_name_en ?? null,
        food_category:      a.food_category ?? null,
        score:              a.score != null ? Number(a.score) : null,
        severity:           a.severity ?? "unknown",
        recommended_action: a.recommended_action ?? null,
        tested_at:          test.tested_at,
        notes:              a.notes ?? null,
      }));
      const { error: aErr } = await admin.from("customer_food_allergens").insert(rows);
      if (aErr) throw aErr;
    }

    return NextResponse.json({ test: newTest, allergen_count: allergens?.length ?? 0 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
