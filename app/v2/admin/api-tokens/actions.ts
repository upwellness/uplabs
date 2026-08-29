"use server";

/**
 * Server actions behind /v2/admin/api-tokens.
 *
 * Every one of these re-checks `requireAdmin()` itself. The admin layout already
 * gates the page, but a server action is a callable POST endpoint — a layout does
 * not protect it, so the check has to live here too.
 *
 * `createToken` is the only place the full credential exists. It is returned to the
 * caller once and never written down; if the admin closes the dialog it is gone and
 * they must issue a new one.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { mintToken, maskToken } from "@/lib/api/tokens";
import { normalizeScopes } from "@/lib/api/scopes";
import { ownerReachIds } from "@/lib/api/auth";
import { intersectWithOwnerReach } from "@/lib/api/reach";

export interface TokenListRow {
  id: string;
  name: string;
  owner_user_id: string | null;
  owner_label: string;
  owner_role: string | null;
  token_prefix: string;
  masked: string;
  scopes: string[];
  customer_scope: string;
  rate_limit_per_min: number;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
  note: string | null;
  calls_7d: number;
}

export async function listTokens(): Promise<TokenListRow[]> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data } = await admin.from("api_tokens").select("*").order("created_at", { ascending: false });
  const rows = (data ?? []) as any[];

  // owner labels — a token's reach is its owner's, so the table must name them
  const ownerIds = [...new Set(rows.map((r) => r.owner_user_id).filter(Boolean))];
  const owners = new Map<string, { label: string; role: string | null }>();
  if (ownerIds.length) {
    const { data: profs } = await admin
      .from("profiles").select("id, display_name, email, role").in("id", ownerIds);
    for (const p of profs ?? []) {
      const q = p as any;
      owners.set(q.id, { label: q.display_name || q.email || q.id.slice(0, 8), role: q.role });
    }
  }

  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const counts = new Map<string, number>();
  if (rows.length) {
    const { data: logs } = await admin
      .from("api_token_logs").select("token_id").gte("ts", since)
      .in("token_id", rows.map((r) => r.id));
    for (const l of logs ?? []) {
      const id = (l as any).token_id as string;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return rows.map((r) => ({
    id: r.id, name: r.name,
    owner_user_id: r.owner_user_id,
    owner_label: owners.get(r.owner_user_id)?.label ?? "— ไม่มีเจ้าของ —",
    owner_role: owners.get(r.owner_user_id)?.role ?? null,
    token_prefix: r.token_prefix,
    masked: maskToken(r.token_prefix),
    scopes: r.scopes ?? [], customer_scope: r.customer_scope,
    rate_limit_per_min: r.rate_limit_per_min, expires_at: r.expires_at,
    revoked_at: r.revoked_at, last_used_at: r.last_used_at, created_at: r.created_at,
    note: r.note, calls_7d: counts.get(r.id) ?? 0,
  }));
}

export interface CoachOption { id: string; label: string; role: string; customerCount: number }

/** Users a token may be issued to. A token always acts as one of these people. */
export async function listCoaches(): Promise<CoachOption[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles").select("id, display_name, email, role")
    .in("role", ["abo", "admin"]).order("display_name");

  const people = (data ?? []) as any[];
  // show how many customers each person actually reaches, so the admin can see the
  // blast radius of a token before issuing it
  const counts = await Promise.all(people.map((p) => ownerReachIds(p.id).then((ids) => ids.length)));

  return people.map((p, i) => ({
    id: p.id,
    label: `${p.display_name || p.email || p.id.slice(0, 8)} · ${p.role}`,
    role: p.role,
    customerCount: counts[i],
  }));
}

export async function createToken(input: {
  name: string;
  scopes: string[];
  /** The user the token acts as — its reach is derived from them on every request. */
  ownerUserId: string;
  customerScopeKind: "owner" | "all" | "list";
  customerIds?: string;
  expiresInDays?: number | null;
  rateLimit?: number;
  note?: string;
}): Promise<{ ok: true; token: string; prefix: string; warning?: string } | { ok: false; error: string }> {
  const admin_session = await requireAdmin();

  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "ต้องตั้งชื่อ token" };

  const scopes = normalizeScopes(input.scopes);
  if (scopes.length === 0) return { ok: false, error: "ต้องเลือกสิทธิ์อย่างน้อย 1 อย่าง" };

  if (!input.ownerUserId) return { ok: false, error: "ต้องเลือกเจ้าของ token" };
  const adminDb = createAdminClient();
  const { data: owner } = await adminDb
    .from("profiles").select("id, role").eq("id", input.ownerUserId).maybeSingle();
  if (!owner) return { ok: false, error: "ไม่พบผู้ใช้ที่เลือกเป็นเจ้าของ" };

  let customerScope = "owner";
  let warning: string | undefined;

  if (input.customerScopeKind === "all") {
    // Refused rather than silently narrowed: at creation time the admin is right here
    // and can pick someone else, so telling them beats quietly issuing a weaker token
    // than they think they made.
    if ((owner as any).role !== "admin") {
      return { ok: false, error: 'ให้สิทธิ์ "เห็นทุกคน" ได้เฉพาะ token ที่เจ้าของเป็นแอดมิน — เลือกเจ้าของที่เป็นแอดมิน หรือใช้ขอบเขตตามสายงานแทน' };
    }
    customerScope = "all";
  } else if (input.customerScopeKind === "list") {
    const ids = (input.customerIds ?? "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return { ok: false, error: "ต้องใส่ customer id อย่างน้อย 1 รายการ" };

    // A list may only narrow. Anything outside the owner's reach is dropped now and
    // would be rejected at request time anyway — better to say so while creating it.
    const reach = await ownerReachIds(input.ownerUserId);
    const { allowed, rejected } = intersectWithOwnerReach(ids, reach);
    if (allowed.length === 0) {
      return { ok: false, error: "ลูกค้าที่ระบุไม่มีใครอยู่ในสายงานของเจ้าของ token เลย" };
    }
    if (rejected.length) {
      warning = `ตัด ${rejected.length} รายที่อยู่นอกสายงานของเจ้าของออก — token เห็นได้ ${allowed.length} ราย`;
    }
    customerScope = `list:${allowed.join(",")}`;
  }

  const minted = mintToken("live");
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 864e5).toISOString()
    : null;

  const { error } = await adminDb.from("api_tokens").insert({
    name,
    owner_user_id: input.ownerUserId,
    token_prefix: minted.prefix,
    token_hash: minted.hash,
    scopes,
    customer_scope: customerScope,
    rate_limit_per_min: Math.min(600, Math.max(1, input.rateLimit ?? 60)),
    expires_at: expiresAt,
    note: (input.note ?? "").trim() || null,
    created_by: admin_session.user.id,
  });
  if (error) return { ok: false, error: "สร้าง token ไม่สำเร็จ" };

  revalidatePath("/v2/admin/api-tokens");
  return { ok: true, token: minted.token, prefix: minted.prefix, ...(warning ? { warning } : {}) };
}

export async function revokeToken(id: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  await createAdminClient().from("api_tokens")
    .update({ revoked_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/v2/admin/api-tokens");
  return { ok: true };
}

export interface LogRow {
  id: number; ts: string; token_prefix: string | null; method: string | null;
  path: string | null; intent: string | null; status: number | null;
  error: string | null; duration_ms: number | null; row_count: number | null; q: string | null;
}

export async function listLogs(tokenId?: string): Promise<LogRow[]> {
  await requireAdmin();
  let query = createAdminClient().from("api_token_logs")
    .select("id, ts, token_prefix, method, path, intent, status, error, duration_ms, row_count, q")
    .order("ts", { ascending: false }).limit(200);
  if (tokenId) query = query.eq("token_id", tokenId);
  const { data } = await query;
  return (data ?? []) as LogRow[];
}
