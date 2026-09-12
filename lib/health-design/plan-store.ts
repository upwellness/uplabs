/**
 * Plan I/O — decisions in plan.ts. One live plan per customer: drafting again
 * archives the previous draft; confirming freezes `final`; sending stamps sent_at and
 * makes /r/plan/<share_token> readable.
 */
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomer, ageFrom } from "@/lib/api/data";
import { latestAssessment, runAssessment } from "./load";
import { draftPlan, type HealthPlan } from "./plan";
import type { Goal, PlanConfig } from "@/lib/plate-planner/engine";

export type PlanStatus = "draft" | "confirmed" | "sent" | "archived";
export interface StoredPlan {
  id: string; customer_id: string; assessment_id: string | null; status: PlanStatus; origin: string; goal: Goal;
  draft: HealthPlan; final: HealthPlan | null; edits: Record<string, unknown> | null; coach_note: string | null;
  share_token: string | null; created_at: string; confirmed_at: string | null; sent_at: string | null; sent_via: string | null;
}
const COLS = "id, customer_id, assessment_id, status, origin, goal, draft, final, edits, coach_note, share_token, created_at, confirmed_at, sent_at, sent_via";

export async function currentPlan(customerId: string): Promise<StoredPlan | null> {
  const { data } = await createAdminClient().from("health_plans").select(COLS).eq("customer_id", customerId)
    .neq("status", "archived").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as StoredPlan | null) ?? null;
}

export async function planHistory(customerId: string, limit = 10) {
  const { data } = await createAdminClient().from("health_plans").select("id, status, goal, created_at, confirmed_at, sent_at, sent_via")
    .eq("customer_id", customerId).order("created_at", { ascending: false }).limit(limit);
  return data ?? [];
}

/** Build a new draft from the latest assessment (computing one if none) and archive any older draft. */
export async function createDraft(customerId: string, userId: string | null, goalOverride?: Goal | null): Promise<StoredPlan | null> {
  const admin = createAdminClient();
  const cust = await getCustomer(customerId);
  if (!cust) return null;
  const stored = (await latestAssessment(customerId)) ?? (await runAssessment(customerId, "manual"));
  if (!stored) return null;

  const [{ data: ms }, { data: cfg }, { data: supp }] = await Promise.all([
    admin.from("measurements").select("weight").eq("customer_id", customerId).order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("plate_plan_config").select("goal, config").eq("customer_id", customerId).maybeSingle(),
    admin.from("supplement_schedule").select("meal_slot, items, sort").eq("customer_id", customerId).order("sort"),
  ]);

  const plan = draftPlan({
    assessment: stored.assessment, assessment_id: stored.id,
    customer: {
      gender: cust.gender === "male" || cust.gender === "female" ? cust.gender : null, age: ageFrom(cust.birth_date),
      weight: (ms as any)?.weight == null ? null : Number((ms as any).weight), height_cm: cust.height ? Number(cust.height) || null : null,
    },
    goal: goalOverride ?? ((cfg as any)?.goal as Goal | undefined) ?? null,
    planConfig: ((cfg as any)?.config as PlanConfig | undefined) ?? null,
    supplements: supp?.length ? (supp as any[]).map((r) => ({ meal_slot: r.meal_slot, items: Array.isArray(r.items) ? r.items : [] })) : null,
    today: new Date().toISOString(),
  });

  // only one live draft — older unconfirmed drafts are superseded
  await admin.from("health_plans").update({ status: "archived" }).eq("customer_id", customerId).eq("status", "draft");
  const { data, error } = await admin.from("health_plans").insert({
    customer_id: customerId, assessment_id: stored.id, status: "draft", origin: "engine", goal: plan.goal, draft: plan, created_by: userId,
  }).select(COLS).single();
  if (error || !data) throw new Error(error?.message ?? "insert failed");
  return data as StoredPlan;
}

export interface ConfirmEdits { goals_90d?: HealthPlan["goals_90d"]; lifestyle?: HealthPlan["lifestyle"]; retest?: HealthPlan["retest"]; coach_note?: string | null }

/** Coach confirms: `final` = draft with the edited sections swapped in; every changed section is recorded. */
export async function confirmPlan(planId: string, userId: string, edits: ConfirmEdits): Promise<StoredPlan | null> {
  const admin = createAdminClient();
  const { data: row } = await admin.from("health_plans").select(COLS).eq("id", planId).maybeSingle();
  if (!row || (row as StoredPlan).status === "archived") return null;
  const p = row as StoredPlan;
  const final: HealthPlan = { ...p.draft };
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of ["goals_90d", "lifestyle", "retest"] as const) {
    const v = edits[k];
    if (v && JSON.stringify(v) !== JSON.stringify(p.draft[k])) { diff[k] = { from: p.draft[k], to: v }; (final as any)[k] = v; }
  }
  const { data, error } = await admin.from("health_plans").update({
    status: "confirmed", origin: Object.keys(diff).length ? "coach" : "engine", final, edits: Object.keys(diff).length ? diff : null,
    coach_note: edits.coach_note ?? null, confirmed_by: userId, confirmed_at: new Date().toISOString(),
    share_token: p.share_token ?? randomBytes(18).toString("base64url"),
  }).eq("id", planId).select(COLS).single();
  if (error || !data) throw new Error(error?.message ?? "update failed");
  return data as StoredPlan;
}

export async function markSent(planId: string, via: "link" | "line"): Promise<StoredPlan | null> {
  const { data } = await createAdminClient().from("health_plans").update({ status: "sent", sent_at: new Date().toISOString(), sent_via: via })
    .eq("id", planId).in("status", ["confirmed", "sent"]).select(COLS).maybeSingle();
  return (data as StoredPlan | null) ?? null;
}

/** For /r/plan/<token>: only a confirmed-and-sent plan is readable. */
export async function planByToken(token: string): Promise<{ plan: HealthPlan; customer_name: string; sent_at: string; coach_note: string | null } | null> {
  const { data } = await createAdminClient().from("health_plans").select("final, sent_at, coach_note, customers!inner(name)")
    .eq("share_token", token).not("sent_at", "is", null).maybeSingle();
  if (!data || !(data as any).final) return null;
  return { plan: (data as any).final, customer_name: (data as any).customers?.name ?? "คุณ", sent_at: (data as any).sent_at, coach_note: (data as any).coach_note };
}
