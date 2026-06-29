import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer } from "@/lib/customers/access";
import type { Goal, PlanConfig, Diet, Allergy } from "@/lib/plate-planner/engine";

/**
 * น้องจาน · per-customer Plate Planner config (1 row / customer).
 *   GET → current config + the customer's height + latest weight (for a preview hint).
 *   PUT → upsert plate_plan_config. Values are validated against the engine's enums
 *         so engine.calcTargets / buildPlan read clean inputs (SPEC R5: no garbage in).
 *
 * Auth mirrors the customer-child-table pattern: getSession → verify customers.coach_id.
 */

const GOALS: Goal[] = ["loss", "longevity", "muscle"];
const DIETS: Diet[] = ["none", "halal", "nopork", "nobeef", "noredmeat", "vegetarian", "vegan"];
const ALLERGIES: Allergy[] = ["seafood", "fish", "nuts", "soy", "dairy", "egg", "sesame", "gluten"];
const PLAN_LENS = [7, 30, 49];

async function authCustomer(customerId: string, session: { profile: { role: string }; user: { id: string } }) {
  const admin = createAdminClient();
  const { data: customer } = await admin
    .from("customers")
    .select("id, coach_id, name, height")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return { ok: false as const, status: 404, error: "customer not found" };
  const isAdmin = session.profile.role === "admin";
  if (!isAdmin && customer.coach_id !== session.user.id && !(await isAssignedToCustomer(session.user.id, customerId))) {
    return { ok: false as const, status: 403, error: "forbidden" };
  }
  return { ok: true as const, admin, customer };
}

export async function GET(_req: Request, { params }: { params: { customerId: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const auth = await authCustomer(params.customerId, session);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { admin, customer } = auth;

    const [{ data: cfg }, { data: latestM }] = await Promise.all([
      admin
        .from("plate_plan_config")
        .select("goal, config, seed, even3, plan_len, updated_at")
        .eq("customer_id", params.customerId)
        .maybeSingle(),
      admin
        .from("measurements")
        .select("weight, recorded_at")
        .eq("customer_id", params.customerId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      config: cfg ?? null,
      customer: { id: customer.id, name: customer.name, height: customer.height ?? null },
      latestWeight: latestM?.weight ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { customerId: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const auth = await authCustomer(params.customerId, session);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { admin } = auth;

    const body = await req.json();

    const goal: Goal = GOALS.includes(body.goal) ? body.goal : "longevity";
    const config = sanitizeConfig(body.config);
    const seed = numOr(body.seed, 1, 0);
    const even3 = !!body.even3;
    const planLen = PLAN_LENS.includes(Number(body.plan_len)) ? Number(body.plan_len) : 30;

    const { data, error } = await admin
      .from("plate_plan_config")
      .upsert(
        {
          customer_id: params.customerId,
          goal,
          config,
          seed,
          even3,
          plan_len: planLen,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "customer_id" },
      )
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ config: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

/* ── helpers ───────────────────────────────────────────── */

function numOr(v: unknown, fallback: number, min: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? Math.round(n) : fallback;
}

/** Keep only engine-understood keys/values so the bot never reads malformed config. */
function sanitizeConfig(input: unknown): PlanConfig {
  const c = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: PlanConfig = {};

  const diet = c.diet;
  if (typeof diet === "string" && DIETS.includes(diet as Diet) && diet !== "none") {
    out.diet = diet as Diet;
  }

  if (c.noVeg === true) out.noVeg = true;
  if (c.lockW === true) out.lockW = true;

  if (Array.isArray(c.allergy)) {
    const allergy = c.allergy.filter((a): a is Allergy => typeof a === "string" && ALLERGIES.includes(a as Allergy));
    if (allergy.length) out.allergy = allergy;
  }

  const shake = c.shake;
  if (shake && typeof shake === "object") {
    const s = shake as Record<string, unknown>;
    if (s.on === true) {
      out.shake = {
        on: true,
        breakfast: s.breakfast === true,
        dinner: s.dinner === true,
      };
    }
  }

  return out;
}
