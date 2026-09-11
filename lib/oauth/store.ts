/**
 * OAuth I/O. Decisions live in core.ts; this file reads and writes rows.
 * Access tokens are minted as ordinary api_tokens so lib/api/auth.ts needs no change.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { mintToken } from "@/lib/api/tokens";
import { sha256, randomUrlSafe, CODE_TTL_MS, ACCESS_TTL_MS, REFRESH_TTL_MS, OAUTH_RATE_LIMIT_PER_MIN, type RegistrationInput } from "./core";

export interface OAuthClient {
  client_id: string; client_secret_hash: string | null; client_name: string; redirect_uris: string[];
  token_endpoint_auth_method: string; grant_types: string[]; client_uri: string | null; logo_uri: string | null;
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  if (!clientId) return null;
  const { data } = await createAdminClient().from("oauth_clients").select("*").eq("client_id", clientId).maybeSingle();
  return (data as OAuthClient | null) ?? null;
}

export async function registerClient(input: RegistrationInput, ip: string | null): Promise<{ client_id: string; client_secret: string | null }> {
  const client_id = `uplab_mcp_${randomUrlSafe(12)}`;
  const client_secret = input.token_endpoint_auth_method === "none" ? null : randomUrlSafe(32);
  const { error } = await createAdminClient().from("oauth_clients").insert({
    client_id, client_secret_hash: client_secret ? sha256(client_secret) : null,
    client_name: input.client_name, redirect_uris: input.redirect_uris,
    token_endpoint_auth_method: input.token_endpoint_auth_method, grant_types: input.grant_types,
    client_uri: input.client_uri, logo_uri: input.logo_uri, created_ip: ip,
  });
  if (error) throw new Error(error.message);
  return { client_id, client_secret };
}

export interface CodeGrant {
  client_id: string; user_id: string; redirect_uri: string; code_challenge: string; scopes: string[]; resource: string | null;
}

export async function issueCode(grant: CodeGrant): Promise<string> {
  const code = randomUrlSafe(32);
  const { error } = await createAdminClient().from("oauth_codes").insert({
    code_hash: sha256(code), ...grant, expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (error) throw new Error(error.message);
  return code;
}

/** Atomically claim a code: returns it only if unexpired and never used before. */
export async function consumeCode(code: string): Promise<(CodeGrant & { expires_at: string }) | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("oauth_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", sha256(code)).is("used_at", null).gt("expires_at", new Date().toISOString())
    .select("client_id, user_id, redirect_uri, code_challenge, scopes, resource, expires_at").maybeSingle();
  return (data as any) ?? null;
}

export interface IssuedTokens { access_token: string; expires_in: number; refresh_token: string; scope: string }

/**
 * Mint the access token (an api_tokens row owned by the user) and a refresh token that
 * can renew it. Admins get reach "all" like in the web app; everyone else "owner".
 */
export async function issueTokens(opts: { client: OAuthClient; user_id: string; user_role: string | null; scopes: string[] }): Promise<IssuedTokens> {
  const admin = createAdminClient();
  const minted = mintToken("live");
  const expiresAt = new Date(Date.now() + ACCESS_TTL_MS);
  const { data: tok, error } = await admin.from("api_tokens").insert({
    name: `OAuth · ${opts.client.client_name}`,
    owner_user_id: opts.user_id,
    token_prefix: minted.prefix, token_hash: minted.hash,
    scopes: opts.scopes,
    customer_scope: opts.user_role === "admin" ? "all" : "owner",
    rate_limit_per_min: OAUTH_RATE_LIMIT_PER_MIN,
    expires_at: expiresAt.toISOString(),
    note: `ออกโดย OAuth ให้ client ${opts.client.client_id} — ต่ออายุอัตโนมัติด้วย refresh token`,
    created_by: opts.user_id,
    oauth_client_id: opts.client.client_id,
  }).select("id").single();
  if (error || !tok) throw new Error(error?.message ?? "insert api_tokens failed");

  const refresh = randomUrlSafe(32);
  const { error: rerr } = await admin.from("oauth_refresh_tokens").insert({
    token_hash: sha256(refresh), client_id: opts.client.client_id, user_id: opts.user_id,
    api_token_id: (tok as any).id, scopes: opts.scopes,
    expires_at: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
  });
  if (rerr) throw new Error(rerr.message);

  await admin.from("oauth_clients").update({ last_used_at: new Date().toISOString() }).eq("client_id", opts.client.client_id);
  return { access_token: minted.token, expires_in: Math.floor(ACCESS_TTL_MS / 1000), refresh_token: refresh, scope: opts.scopes.join(" ") };
}

export interface RefreshRow { token_hash: string; client_id: string; user_id: string; api_token_id: string; scopes: string[]; expires_at: string; revoked_at: string | null }

export async function findRefresh(token: string): Promise<RefreshRow | null> {
  const { data } = await createAdminClient().from("oauth_refresh_tokens").select("*").eq("token_hash", sha256(token)).maybeSingle();
  return (data as RefreshRow | null) ?? null;
}

/** Retire a refresh token and the access token it guards (rotation, logout, revocation). */
export async function revokeRefresh(row: RefreshRow): Promise<void> {
  const admin = createAdminClient(); const now = new Date().toISOString();
  await admin.from("oauth_refresh_tokens").update({ revoked_at: now }).eq("token_hash", row.token_hash).is("revoked_at", null);
  await admin.from("api_tokens").update({ revoked_at: now }).eq("id", row.api_token_id).is("revoked_at", null);
}

/** Revoke an access token by its raw value (RFC 7009). Only OAuth-issued tokens are touched. */
export async function revokeAccessByRaw(prefix: string, clientId: string): Promise<void> {
  const admin = createAdminClient(); const now = new Date().toISOString();
  const { data } = await admin.from("api_tokens").select("id").eq("token_prefix", prefix).eq("oauth_client_id", clientId).is("revoked_at", null).maybeSingle();
  if (!data) return;
  await admin.from("api_tokens").update({ revoked_at: now }).eq("id", (data as any).id);
  await admin.from("oauth_refresh_tokens").update({ revoked_at: now }).eq("api_token_id", (data as any).id).is("revoked_at", null);
}

export async function getUserRole(userId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("profiles").select("role").eq("id", userId).maybeSingle();
  return ((data as any)?.role as string) ?? null;
}
