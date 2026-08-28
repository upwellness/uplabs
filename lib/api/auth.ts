/**
 * External API request authentication.
 *
 * Order matters and is the same for every route (docs/SPEC-External-API.md §6.2):
 *   token present → parseable → exists → not revoked → not expired
 *   → under rate limit → has the scope → customer is inside the token's scope
 *
 * Everything is logged, refusals included. A token that starts probing endpoints it
 * has no scope for is exactly the signal you want in a log, and it is invisible if
 * you only record successes.
 *
 * Customer scoping reuses `lib/customers/access.ts` rather than reimplementing the
 * downline walk. Two copies of an access rule drift, and the copy without a UI in
 * front of it is the one nobody notices has drifted.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageCustomer } from "@/lib/customers/access";
import { parseToken, readTokenFromHeaders, verifySecret } from "./tokens";
import { apiError } from "./respond";
import type { Scope } from "./scopes";

export interface TokenRow {
  id: string;
  name: string;
  token_prefix: string;
  token_hash: string;
  scopes: string[];
  customer_scope: string;
  rate_limit_per_min: number;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface ApiContext {
  token: TokenRow;
  startedAt: number;
  req: Request;
  /** Filled in by the route once it knows which customer it touched. */
  customerId?: string;
  intent?: string;
  q?: string;
}

/** Left in place by `authenticate` so `logCall` can record refusals too. */
interface AuthFailure {
  response: Response;
  prefix: string | null;
  code: string;
}

export type AuthResult = { ok: true; ctx: ApiContext } | { ok: false; fail: AuthFailure };

export async function authenticate(req: Request): Promise<AuthResult> {
  const startedAt = Date.now();
  const raw = readTokenFromHeaders(req.headers);

  if (!raw) {
    return fail(
      apiError("missing_token", "ต้องส่ง token มาด้วย — ใส่ header `Authorization: Bearer uplab_live_…` หรือ `x-api-key`"),
      null, "missing_token",
    );
  }

  const parsed = parseToken(raw);
  if (!parsed) {
    return fail(apiError("malformed_token", "รูปแบบ token ไม่ถูกต้อง"), null, "malformed_token");
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("api_tokens")
    .select("id, name, token_prefix, token_hash, scopes, customer_scope, rate_limit_per_min, expires_at, revoked_at")
    .eq("token_prefix", parsed.prefix)
    .maybeSingle();

  // Same message whether the prefix is unknown or the secret is wrong — telling the
  // caller which half was right narrows a brute force to one half.
  if (!row || !verifySecret(parsed.secret, (row as TokenRow).token_hash)) {
    return fail(apiError("invalid_token", "token ไม่ถูกต้อง"), parsed.prefix, "invalid_token");
  }

  const token = row as TokenRow;
  if (token.revoked_at) {
    return fail(apiError("token_revoked", "token นี้ถูกเพิกถอนแล้ว"), parsed.prefix, "token_revoked");
  }
  if (token.expires_at && new Date(token.expires_at).getTime() < Date.now()) {
    return fail(apiError("token_expired", "token นี้หมดอายุแล้ว"), parsed.prefix, "token_expired");
  }

  const limit = token.rate_limit_per_min ?? 60;
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("api_token_logs")
    .select("id", { count: "exact", head: true })
    .eq("token_id", token.id)
    .gte("ts", since);
  if ((count ?? 0) >= limit) {
    return fail(
      apiError("rate_limited", `เรียกเกิน ${limit} ครั้ง/นาที — รอสักครู่แล้วลองใหม่`, { retry_after: 60, limit }),
      parsed.prefix, "rate_limited",
    );
  }

  return { ok: true, ctx: { token, startedAt, req } };
}

function fail(response: Response, prefix: string | null, code: string): AuthResult {
  return { ok: false, fail: { response, prefix, code } };
}

export function requireScope(ctx: ApiContext, scope: Scope): Response | null {
  if (ctx.token.scopes?.includes(scope)) return null;
  return apiError("insufficient_scope", `token นี้ไม่มีสิทธิ์ "${scope}"`, {
    required_scope: scope,
    your_scopes: ctx.token.scopes ?? [],
  });
}

/* ── customer scoping ─────────────────────────────────────────────────────── */

export function parseCustomerScope(scope: string): { kind: "all" } | { kind: "coach"; userId: string } | { kind: "list"; ids: string[] } {
  if (!scope || scope === "all") return { kind: "all" };
  if (scope.startsWith("coach:")) return { kind: "coach", userId: scope.slice(6).trim() };
  if (scope.startsWith("list:")) {
    return { kind: "list", ids: scope.slice(5).split(",").map((s) => s.trim()).filter(Boolean) };
  }
  return { kind: "list", ids: [] }; // unrecognised → deny everything, never fall open
}

/**
 * May this token touch this customer?
 * 404 rather than 403 on "not found" is deliberate — a 403 would confirm the id
 * exists, which is itself a leak when ids can be guessed from elsewhere.
 */
export async function assertCustomerInScope(ctx: ApiContext, customerId: string): Promise<Response | null> {
  const scope = parseCustomerScope(ctx.token.customer_scope);
  const admin = createAdminClient();

  const { data: customer } = await admin
    .from("customers").select("id, coach_id").eq("id", customerId).maybeSingle();
  if (!customer) return apiError("not_found", "ไม่พบลูกค้ารายนี้");

  if (scope.kind === "all") return null;
  if (scope.kind === "list") {
    return scope.ids.includes(customerId)
      ? null
      : apiError("customer_out_of_scope", "token นี้ไม่ได้รับสิทธิ์เข้าถึงลูกค้ารายนี้");
  }

  // coach: owner, co-coach, or anywhere upline of the owner — same rule as the web app
  if ((customer as any).coach_id === scope.userId) return null;
  if (await canManageCustomer(scope.userId, customerId)) return null;
  return apiError("customer_out_of_scope", "token นี้ไม่ได้รับสิทธิ์เข้าถึงลูกค้ารายนี้");
}

/** Narrow a customer list query to what this token may see. */
export async function visibleCustomerIds(ctx: ApiContext): Promise<{ all: true } | { all: false; ids: string[] }> {
  const scope = parseCustomerScope(ctx.token.customer_scope);
  if (scope.kind === "all") return { all: true };
  if (scope.kind === "list") return { all: false, ids: scope.ids };

  const admin = createAdminClient();
  const { data: descendants } = await admin.rpc("profile_descendant_ids", { root: scope.userId });
  const coachIds = [scope.userId, ...(Array.isArray(descendants) ? (descendants as string[]) : [])];

  const { data: owned } = await admin.from("customers").select("id").in("coach_id", coachIds);
  const { data: assigned } = await admin
    .from("customer_assignments").select("customer_id").eq("user_id", scope.userId);

  const ids = new Set<string>();
  for (const r of owned ?? []) ids.add((r as any).id);
  for (const r of assigned ?? []) ids.add((r as any).customer_id);
  return { all: false, ids: [...ids] };
}

/* ── logging ──────────────────────────────────────────────────────────────── */

export async function logCall(opts: {
  tokenId?: string | null;
  prefix?: string | null;
  req: Request;
  status: number;
  error?: string | null;
  intent?: string | null;
  customerId?: string | null;
  rowCount?: number | null;
  startedAt: number;
  q?: string | null;
}) {
  try {
    const admin = createAdminClient();
    const url = new URL(opts.req.url);
    await admin.from("api_token_logs").insert({
      token_id: opts.tokenId ?? null,
      token_prefix: opts.prefix ?? null,
      method: opts.req.method,
      path: url.pathname + (url.search || ""),
      intent: opts.intent ?? null,
      customer_id: opts.customerId ?? null,
      status: opts.status,
      error: opts.error ?? null,
      duration_ms: Date.now() - opts.startedAt,
      row_count: opts.rowCount ?? null,
      ip: opts.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: opts.req.headers.get("user-agent")?.slice(0, 300) ?? null,
      // truncated so the log does not quietly become a second store of health PII
      q: opts.q ? opts.q.slice(0, 500) : null,
    });

    if (opts.tokenId) {
      await admin.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", opts.tokenId);
    }
    // opportunistic retention sweep — avoids depending on a cron that can silently die
    if (Math.random() < 0.005) await admin.rpc("prune_api_token_logs");
  } catch (err: any) {
    console.error("[api/v1] log failed:", err?.message ?? err); // logging must never break a request
  }
}

/**
 * The wrapper every /api/v1 route uses: authenticate → run → log, whatever happens.
 */
export async function withApi(
  req: Request,
  handler: (ctx: ApiContext) => Promise<Response>,
): Promise<Response> {
  const startedAt = Date.now();

  // `authenticate` itself can throw — createAdminClient() does when the Supabase env
  // is missing. Before this try existed, a misconfigured deploy answered /api/v1 with
  // a Next.js stack trace naming our internal modules instead of a clean 500.
  let auth: AuthResult;
  try {
    auth = await authenticate(req);
  } catch (err: any) {
    console.error("[api/v1] authenticate threw:", err?.message ?? err);
    return apiError("internal_error", "ระบบยังไม่พร้อมให้บริการ (การตั้งค่าเซิร์ฟเวอร์ไม่ครบ)");
  }

  if (!auth.ok) {
    await logCall({
      prefix: auth.fail.prefix, req, status: auth.fail.response.status,
      error: auth.fail.code, startedAt,
    });
    return auth.fail.response;
  }

  const { ctx } = auth;
  try {
    const res = await handler(ctx);
    await logCall({
      tokenId: ctx.token.id, prefix: ctx.token.token_prefix, req,
      status: res.status, intent: ctx.intent ?? null, customerId: ctx.customerId ?? null,
      rowCount: Number(res.headers.get("x-row-count")) || null,
      error: res.ok ? null : res.headers.get("x-error-code"),
      startedAt: ctx.startedAt, q: ctx.q ?? null,
    });
    return res;
  } catch (err: any) {
    console.error("[api/v1] handler threw:", err?.message ?? err);
    await logCall({
      tokenId: ctx.token.id, prefix: ctx.token.token_prefix, req, status: 500,
      error: "internal_error", intent: ctx.intent ?? null, customerId: ctx.customerId ?? null,
      startedAt: ctx.startedAt, q: ctx.q ?? null,
    });
    return apiError("internal_error", "เกิดข้อผิดพลาดภายในระบบ");
  }
}
