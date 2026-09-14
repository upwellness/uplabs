/** I/O for the BCA reveal page: issue a scan's share token, load a scan by token. Decisions live in engine.ts. */
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ageFrom } from "@/lib/api/data";
import type { RevealInput } from "./engine";

const num = (v: unknown): number | null => { const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN; return Number.isFinite(n) ? n : null; };

/** Latest scan of the customer, or the given one. Creates the token on first call; same token after. */
export async function issueBcaShare(customerId: string, measurementId?: string | null): Promise<{ measurement_id: string; token: string } | null> {
  const admin = createAdminClient();
  let q = admin.from("measurements").select("id, share_token").eq("customer_id", customerId);
  q = measurementId ? q.eq("id", measurementId) : q.order("recorded_at", { ascending: false }).limit(1);
  const { data } = await q.maybeSingle();
  if (!data) return null;
  if ((data as any).share_token) return { measurement_id: (data as any).id, token: (data as any).share_token };
  const token = randomBytes(18).toString("base64url");
  const { error } = await admin.from("measurements").update({ share_token: token }).eq("id", (data as any).id);
  if (error) throw new Error(error.message);
  return { measurement_id: (data as any).id, token };
}

export interface RevealScan {
  measurement_id: string; recorded_at: string;
  customer: { id: string; first_name: string; gender: "male" | "female" | null; age: number | null; height_cm: number | null; coach_name: string | null; line_id: string | null };
  input: RevealInput;
  history: { at: string; weight: number | null; fat_pct: number | null; muscle_pct: number | null; visceral: number | null }[];
}

export async function bcaByToken(token: string): Promise<RevealScan | null> {
  if (!token || token.length < 16 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const admin = createAdminClient();
  const { data: m } = await admin.from("measurements").select("id, customer_id, recorded_at, weight, fat_pct, muscle_pct, visceral, body_age, bmr").eq("share_token", token).maybeSingle();
  if (!m) return null;
  const [{ data: c }, { data: hist }] = await Promise.all([
    admin.from("customers").select("id, name, gender, birth_date, height, coach_id, line_id, disabled_at").eq("id", (m as any).customer_id).maybeSingle(),
    admin.from("measurements").select("recorded_at, weight, fat_pct, muscle_pct, visceral").eq("customer_id", (m as any).customer_id).lte("recorded_at", (m as any).recorded_at).order("recorded_at", { ascending: false }).limit(8),
  ]);
  if (!c || (c as any).disabled_at) return null;
  const coach = (c as any).coach_id ? await admin.from("profiles").select("display_name").eq("id", (c as any).coach_id).maybeSingle() : { data: null };
  const coachName = String((coach.data as any)?.display_name ?? "").trim();
  void admin.from("measurements").update({ share_opened_at: new Date().toISOString() }).eq("id", (m as any).id).is("share_opened_at", null).then(() => {});
  const gender = (c as any).gender === "male" || (c as any).gender === "female" ? (c as any).gender : null;
  const first = String((c as any).name ?? "").trim().split(/\s+/)[0] || "คุณ";
  return {
    measurement_id: (m as any).id, recorded_at: String((m as any).recorded_at),
    customer: { id: (c as any).id, first_name: first, gender, age: ageFrom((c as any).birth_date), height_cm: num((c as any).height), coach_name: /\p{L}/u.test(coachName) ? coachName : null, line_id: (c as any).line_id ?? null },
    input: { gender, age: ageFrom((c as any).birth_date), height_cm: num((c as any).height), weight: num((m as any).weight), fat_pct: num((m as any).fat_pct), muscle_pct: num((m as any).muscle_pct), visceral: num((m as any).visceral), body_age: num((m as any).body_age), bmr: num((m as any).bmr) },
    history: ((hist ?? []) as any[]).reverse().map((h) => ({ at: String(h.recorded_at), weight: num(h.weight), fat_pct: num(h.fat_pct), muscle_pct: num(h.muscle_pct), visceral: num(h.visceral) })),
  };
}
