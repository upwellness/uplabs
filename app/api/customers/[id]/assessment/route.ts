import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { canManageCustomer } from "@/lib/customers/access";
import { latestAssessment, runAssessment, assessmentHistory } from "@/lib/health-design/load";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Same access rule as the other Customer 360 endpoints (admin · owner · co-coach · upline).
async function allowed(customerId: string) {
  const session = await getSession();
  if (!session) return { status: 401 as const, error: "unauthenticated" };
  const { data: c } = await createAdminClient().from("customers").select("id, coach_id").eq("id", customerId).maybeSingle();
  if (!c) return { status: 404 as const, error: "customer not found" };
  if (session.profile.role === "admin" || (c as any).coach_id === session.user.id || (await canManageCustomer(session.user.id, customerId))) return { status: 200 as const };
  return { status: 403 as const, error: "forbidden" };
}

/** GET /api/customers/[id]/assessment — latest (computed on demand if none) + history. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const a = await allowed(params.id);
  if (a.status !== 200) return NextResponse.json({ error: a.error }, { status: a.status });
  try {
    const latest = (await latestAssessment(params.id)) ?? (await runAssessment(params.id, "manual"));
    const history = await assessmentHistory(params.id);
    return NextResponse.json({ latest, history }, { headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    console.error("[assessment] GET failed:", e?.message ?? e);
    return NextResponse.json({ error: "assessment_failed" }, { status: 500 });
  }
}

/** POST — recompute now. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const a = await allowed(params.id);
  if (a.status !== 200) return NextResponse.json({ error: a.error }, { status: a.status });
  try {
    const latest = await runAssessment(params.id, "manual");
    return NextResponse.json({ latest }, { headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    console.error("[assessment] POST failed:", e?.message ?? e);
    return NextResponse.json({ error: "assessment_failed" }, { status: 500 });
  }
}
