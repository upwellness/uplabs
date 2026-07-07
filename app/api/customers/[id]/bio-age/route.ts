/**
 * Health Age (PhenoAge) — prefill + auto-result for one customer.
 * Returns the 9-marker prefill (latest value per marker, unit-sniffed) so the
 * /v2/bio-age calculator can pre-populate the form; computes the result server-side
 * when all markers are present. Auth/ownership mirrors the /360 endpoint.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer, isDownlineCustomer } from "@/lib/customers/access";
import { deriveChronoAge } from "@/lib/bca-derive";
import { phenoPrefillFromLabs, computePhenoAge, PHENO_MARKER_TH, type PhenoInput } from "@/lib/bio-age";

const PHENO_KEYS = ["albumin", "creatinine", "fbs", "hs_crp", "crp", "hscrp", "lymphocytes", "lymphocyte", "mcv", "rdw", "alp", "wbc"];

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const admin = createAdminClient();
    const { data: customer } = await admin
      .from("customers")
      .select("id, name, gender, birth_date, birth_year, coach_id")
      .eq("id", params.id)
      .maybeSingle();
    if (!customer) return NextResponse.json({ error: "not found" }, { status: 404 });

    const isAdmin = session.profile.role === "admin";
    if (
      !isAdmin &&
      customer.coach_id !== session.user.id &&
      !(await isAssignedToCustomer(session.user.id, params.id)) &&
      !(await isDownlineCustomer(session.user.id, params.id))
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { data: rows } = await admin
      .from("customer_lab_values")
      .select("metric_key, value_num, unit, recorded_at")
      .eq("customer_id", params.id)
      .in("metric_key", PHENO_KEYS)
      .order("recorded_at", { ascending: false })
      .limit(80);

    const age = deriveChronoAge(customer.birth_date ?? customer.birth_year, new Date().toISOString());
    const prefill = phenoPrefillFromLabs(rows ?? [], age);
    const result = prefill.complete && age != null ? computePhenoAge(prefill.input as PhenoInput) : null;

    return NextResponse.json({
      customer: { id: customer.id, name: customer.name, gender: customer.gender, age },
      prefill: {
        input: prefill.input,
        present: prefill.present,
        missing: prefill.missing,
        missingLabels: prefill.missing.map((m) => PHENO_MARKER_TH[m] ?? m),
        complete: prefill.complete,
      },
      result,
    });
  } catch (err: any) {
    console.error("[bio-age] error", err);
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
