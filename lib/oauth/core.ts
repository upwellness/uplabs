/**
 * OAuth 2.1 authorization server — the decisions, with no I/O.
 *
 * Why an authorization server exists here at all: claude.ai's custom connectors and
 * ChatGPT's connectors will only talk to an MCP server through OAuth (discovery →
 * dynamic client registration → authorization code + PKCE). They have no field for a
 * bearer token. So a UP Labs user logs in on our own consent page and we mint them a
 * normal `api_tokens` row as the access token — every downstream check (scope, reach,
 * rate limit, revocation, audit log) is then the one the REST API already has.
 *
 * Standards: RFC 6749 (OAuth 2.0) · RFC 7636 (PKCE) · RFC 7591 (dynamic registration)
 * · RFC 8414 (AS metadata) · RFC 9728 (protected resource metadata) · RFC 8707
 * (resource indicators) · MCP authorization spec 2025-06-18.
 */
import { createHash, randomBytes } from "node:crypto";

export const CODE_TTL_MS = 10 * 60_000;              // authorization code: 10 minutes, single use
export const ACCESS_TTL_MS = 7 * 864e5;               // access token = api_tokens row: 7 days
export const REFRESH_TTL_MS = 90 * 864e5;             // refresh token: 90 days, rotated on use
export const OAUTH_RATE_LIMIT_PER_MIN = 120;

export const MCP_PATH = "/api/mcp";

export const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
export const randomUrlSafe = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** RFC 7636 §4.6 — S256 only. `plain` is refused; the MCP spec requires S256. */
export function verifyPkce(verifier: unknown, challenge: string): boolean {
  if (typeof verifier !== "string" || verifier.length < 43 || verifier.length > 128) return false;
  if (!/^[A-Za-z0-9\-._~]+$/.test(verifier)) return false;
  const computed = createHash("sha256").update(verifier, "ascii").digest("base64url");
  return computed === challenge;
}

/**
 * Where may a client be sent back to? https anywhere (claude.ai, chatgpt.com, n8n
 * cloud…) and plain http only on loopback for local development. No fragments.
 */
export function isValidRedirectUri(uri: unknown): uri is string {
  if (typeof uri !== "string" || uri.length > 2048) return false;
  let u: URL;
  try { u = new URL(uri); } catch { return false; }
  if (u.hash) return false;
  if (u.protocol === "https:") return true;
  if (u.protocol === "http:") return u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
  return false;
}

export const TOKEN_AUTH_METHODS = ["none", "client_secret_post", "client_secret_basic"] as const;
export type TokenAuthMethod = (typeof TOKEN_AUTH_METHODS)[number];

export interface RegistrationInput {
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method: TokenAuthMethod;
  grant_types: string[];
  client_uri: string | null;
  logo_uri: string | null;
}

/** RFC 7591 request → what we will store, or a `{error, error_description}` per §3.2.2. */
export function validateRegistration(body: unknown): { ok: true; value: RegistrationInput } | { ok: false; error: string; error_description: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const uris = Array.isArray(b.redirect_uris) ? b.redirect_uris : [];
  if (uris.length === 0 || uris.length > 10) {
    return { ok: false, error: "invalid_redirect_uri", error_description: "redirect_uris ต้องมี 1–10 รายการ" };
  }
  for (const u of uris) {
    if (!isValidRedirectUri(u)) return { ok: false, error: "invalid_redirect_uri", error_description: `redirect_uri ไม่ผ่าน: ${String(u).slice(0, 120)} (ต้องเป็น https หรือ http://localhost)` };
  }
  const method = (b.token_endpoint_auth_method ?? "none") as string;
  if (!(TOKEN_AUTH_METHODS as readonly string[]).includes(method)) {
    return { ok: false, error: "invalid_client_metadata", error_description: `token_endpoint_auth_method ต้องเป็น ${TOKEN_AUTH_METHODS.join(" | ")}` };
  }
  const grants = Array.isArray(b.grant_types) && b.grant_types.length ? b.grant_types.map(String) : ["authorization_code", "refresh_token"];
  for (const g of grants) {
    if (g !== "authorization_code" && g !== "refresh_token") {
      return { ok: false, error: "invalid_client_metadata", error_description: `grant_type "${g}" ไม่รองรับ` };
    }
  }
  if (Array.isArray(b.response_types) && b.response_types.some((r) => r !== "code")) {
    return { ok: false, error: "invalid_client_metadata", error_description: 'response_types รองรับเฉพาะ "code"' };
  }
  const name = typeof b.client_name === "string" && b.client_name.trim() ? b.client_name.trim().slice(0, 100) : "MCP client";
  const url = (k: string) => (typeof b[k] === "string" && /^https?:\/\//.test(b[k] as string) ? (b[k] as string).slice(0, 500) : null);
  return { ok: true, value: { client_name: name, redirect_uris: uris as string[], token_endpoint_auth_method: method as TokenAuthMethod, grant_types: grants, client_uri: url("client_uri"), logo_uri: url("logo_uri") } };
}

export interface AuthorizeParams {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  state: string | null;
  scopes: string[];        // requested (may be empty = let the consent page pick defaults)
  resource: string | null;
}

export type AuthorizeParse =
  | { ok: true; value: AuthorizeParams }
  /** The client is identified and its redirect_uri checked → we may send the error back to it. */
  | { ok: false; redirectable: true; error: string; error_description: string }
  /** Cannot trust redirect_uri → show the error on our own page, never redirect. */
  | { ok: false; redirectable: false; error: string; error_description: string };

/**
 * Validate an authorization request against the registered client. Pure: the caller
 * looks the client up and passes its redirect_uris in.
 */
export function parseAuthorizeRequest(
  q: Record<string, string | undefined>,
  client: { redirect_uris: string[] } | null,
  expectedResource: string,
): AuthorizeParse {
  const client_id = q.client_id ?? "";
  if (!client_id || !client) return { ok: false, redirectable: false, error: "invalid_client", error_description: "ไม่รู้จัก client_id นี้ — ต้องลงทะเบียนที่ /api/oauth/register ก่อน" };

  const redirect_uri = q.redirect_uri ?? "";
  if (!redirect_uri || !client.redirect_uris.includes(redirect_uri)) {
    return { ok: false, redirectable: false, error: "invalid_request", error_description: "redirect_uri ไม่ตรงกับที่ลงทะเบียนไว้" };
  }
  // From here on the redirect target is trusted, so errors go back to the client.
  const fail = (error: string, error_description: string): AuthorizeParse => ({ ok: false, redirectable: true, error, error_description });

  if (q.response_type !== "code") return fail("unsupported_response_type", 'response_type ต้องเป็น "code"');
  if (!q.code_challenge) return fail("invalid_request", "ต้องส่ง code_challenge (PKCE บังคับ)");
  if ((q.code_challenge_method ?? "plain") !== "S256") return fail("invalid_request", "code_challenge_method ต้องเป็น S256");
  if (!/^[A-Za-z0-9\-_]{43}$/.test(q.code_challenge)) return fail("invalid_request", "code_challenge ไม่ใช่ base64url ของ SHA-256");

  const resource = q.resource ?? null;
  if (resource !== null && normaliseResource(resource) !== normaliseResource(expectedResource)) {
    return fail("invalid_target", `resource ต้องเป็น ${expectedResource}`);
  }

  const scopes = (q.scope ?? "").split(/\s+/).map((s) => s.trim()).filter(Boolean);
  return { ok: true, value: { client_id, redirect_uri, code_challenge: q.code_challenge, state: q.state ?? null, scopes, resource } };
}

export const normaliseResource = (r: string) => r.replace(/\/+$/, "").toLowerCase();

/**
 * Which scopes the consent page pre-ticks. Requested ∩ allowed when the client asked for
 * something; otherwise everything except `labs:write` — direct writes to lab history
 * bypass the human review queue and must be a deliberate opt-in.
 */
export function defaultScopes(requested: string[], allowed: readonly string[]): string[] {
  const wanted = requested.filter((s) => allowed.includes(s));
  if (wanted.length) return wanted;
  return allowed.filter((s) => s !== "labs:write");
}

/** Append OAuth params to a redirect URI, keeping any query it already has. */
export function withParams(uri: string, params: Record<string, string | null | undefined>): string {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) u.searchParams.set(k, v);
  return u.toString();
}

/** RFC 9728 */
export function protectedResourceMetadata(base: string, scopes: readonly string[]) {
  return {
    resource: `${base}${MCP_PATH}`,
    authorization_servers: [base],
    scopes_supported: [...scopes],
    bearer_methods_supported: ["header"],
    resource_name: "UP Labs",
    resource_documentation: `${base}/api/v1/openapi.json`,
  };
}

/** RFC 8414 */
export function authorizationServerMetadata(base: string, scopes: readonly string[]) {
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    scopes_supported: [...scopes],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: [...TOKEN_AUTH_METHODS],
    revocation_endpoint_auth_methods_supported: [...TOKEN_AUTH_METHODS],
    code_challenge_methods_supported: ["S256"],
    service_documentation: `${base}/api/v1/openapi.json`,
    ui_locales_supported: ["th", "en"],
  };
}

/** Client credentials may arrive as an HTTP Basic header or as form fields. */
export function readClientAuth(authorization: string | null, body: Record<string, string>): { client_id: string | null; client_secret: string | null; via: "basic" | "post" | "none" } {
  if (authorization?.toLowerCase().startsWith("basic ")) {
    try {
      const [id, secret = ""] = Buffer.from(authorization.slice(6).trim(), "base64").toString("utf8").split(":");
      return { client_id: decodeURIComponent(id), client_secret: decodeURIComponent(secret), via: "basic" };
    } catch { /* fall through */ }
  }
  if (body.client_id) return { client_id: body.client_id, client_secret: body.client_secret ?? null, via: body.client_secret ? "post" : "none" };
  return { client_id: null, client_secret: null, via: "none" };
}
