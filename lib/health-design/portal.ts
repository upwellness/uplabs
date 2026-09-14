/**
 * Customer portal (SPEC-Health-Design §3.6) — a customer opens /my/<token> and sees
 * their own assessment and plan, logs meals, uploads a CGM file. Token-gated like
 * /connect and /r because customers have no accounts yet (Q5 open).
 *
 * The AI estimate for a typed/photographed meal uses the server Gemini key — the
 * second documented exception to BYO-key (the first is lib/pulse/gemini.ts): a
 * customer has no key of their own. Bounded by a per-customer daily cap.
 *
 * The third exception (decided 14 Sep 2026, SPEC-Mobile-Portal.md Q1): "ให้ AI อธิบาย"
 * on the portal rephrases an engine-graded value with the same server key, capped at
 * PORTAL_EXPLAIN_CAP per customer per day and counted in portal_events.
 */
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const PORTAL_DAILY_AI_CAP = 40;
export const PORTAL_EXPLAIN_CAP = Math.max(1, Number(process.env.PORTAL_EXPLAIN_CAP ?? 20) || 20);

export type PortalEventKind = "open" | "metric" | "explain" | "food_log" | "cgm_upload";

/** Fire-and-forget usage log (R7). Never throws — a logging failure must not break the page. */
export async function logPortalEvent(customerId: string, kind: PortalEventKind, meta?: Record<string, unknown>): Promise<void> {
  try { await createAdminClient().from("portal_events").insert({ customer_id: customerId, kind, meta: meta ?? null }); } catch { /* ignore */ }
}

/** AI explanations used in the last 24 h (explain cap). */
export async function explainUsedToday(customerId: string): Promise<number> {
  const since = new Date(Date.now() - 864e5).toISOString();
  const { count } = await createAdminClient().from("portal_events").select("id", { count: "exact", head: true })
    .eq("customer_id", customerId).eq("kind", "explain").gte("at", since);
  return count ?? 0;
}

export interface PortalCustomer { id: string; name: string; gender: string | null; birth_date: string | null; coach_id: string | null; first_opened_at: string | null }

export async function customerByPortalToken(token: string): Promise<PortalCustomer | null> {
  if (!token || token.length < 16) return null;
  const { data } = await createAdminClient().from("customers").select("id, name, gender, birth_date, coach_id, portal_first_opened_at, disabled_at")
    .eq("portal_token", token).maybeSingle();
  if (!data || (data as any).disabled_at) return null;
  const d = data as any;
  return { id: d.id, name: d.name, gender: d.gender, birth_date: d.birth_date, coach_id: d.coach_id, first_opened_at: d.portal_first_opened_at };
}

export async function markPortalOpened(customerId: string): Promise<void> {
  await createAdminClient().from("customers").update({ portal_first_opened_at: new Date().toISOString() }).eq("id", customerId).is("portal_first_opened_at", null);
  await logPortalEvent(customerId, "open");
}

/** Issue (or rotate) the portal token. Rotating invalidates the old link immediately. */
export async function issuePortalToken(customerId: string, rotate: boolean): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("customers").select("portal_token").eq("id", customerId).maybeSingle();
  if (!data) return null;
  if ((data as any).portal_token && !rotate) return (data as any).portal_token;
  const token = randomBytes(24).toString("base64url");
  const { error } = await admin.from("customers").update({ portal_token: token, portal_token_created_at: new Date().toISOString() }).eq("id", customerId);
  if (error) throw new Error(error.message);
  return token;
}

/** How many AI food estimates this customer used in the last 24 h (portal cap). */
export async function portalAiUsedToday(customerId: string): Promise<number> {
  const since = new Date(Date.now() - 864e5).toISOString();
  const { count } = await createAdminClient().from("nutriscan_scans").select("id", { count: "exact", head: true })
    .eq("customer_id", customerId).gte("created_at", since).in("source", ["photo", "text", "photo_backfill"]);
  return count ?? 0;
}
