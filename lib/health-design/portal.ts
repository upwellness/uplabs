/**
 * Customer portal (SPEC-Health-Design §3.6) — a customer opens /my/<token> and sees
 * their own assessment and plan, logs meals, uploads a CGM file. Token-gated like
 * /connect and /r because customers have no accounts yet (Q5 open).
 *
 * The AI estimate for a typed/photographed meal uses the server Gemini key — the
 * second documented exception to BYO-key (the first is lib/pulse/gemini.ts): a
 * customer has no key of their own. Bounded by a per-customer daily cap.
 */
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const PORTAL_DAILY_AI_CAP = 40;

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
