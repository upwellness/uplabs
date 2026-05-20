import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

/**
 * Return allergy test summary + food allergens + supplement safety for one customer.
 * Used by AllergyPanel on customer profile.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();

    const [{ data: tests }, { data: allergens }, { data: safety }] = await Promise.all([
      supa.from("customer_allergy_tests")
        .select("id, test_type, test_lab, test_name, panel_size, tested_at, notes")
        .eq("customer_id", params.id)
        .order("tested_at", { ascending: false }),
      supa.from("customer_food_allergens")
        .select("food_key, food_name_th, food_name_en, food_category, score, severity, recommended_action, tested_at")
        .eq("customer_id", params.id)
        .order("score", { ascending: false }),
      supa.from("customer_supplement_safety")
        .select("product_key, product_th, product_en, sku_id, status, conflicting_ingredients, conflict_severity, reason, alternative_product, verified_at")
        .eq("customer_id", params.id)
        .order("status", { ascending: true }),
    ]);

    return NextResponse.json({
      tests:     tests ?? [],
      allergens: allergens ?? [],
      safety:    safety ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
