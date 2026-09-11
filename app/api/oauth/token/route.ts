import { verifyPkce, normaliseResource, readClientAuth, sha256, MCP_PATH } from "@/lib/oauth/core";
import { getClient, consumeCode, issueTokens, findRefresh, revokeRefresh, revokeFamily, getUserRole, type OAuthClient } from "@/lib/oauth/store";
import { oauthError, json, preflight, readForm, baseUrl } from "@/lib/oauth/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/oauth/token — RFC 6749 §4.1.3 (authorization_code + PKCE) and §6 (refresh_token).
 *
 * Every failure is `invalid_grant`/`invalid_client` with a Thai description; the
 * response never says which half was wrong (code vs verifier, id vs secret).
 */
export async function POST(req: Request) {
  const body = await readForm(req);
  const auth = readClientAuth(req.headers.get("authorization"), body);
  if (!auth.client_id) return oauthError("invalid_client", "ต้องระบุ client_id", 401);

  const client = await getClient(auth.client_id);
  if (!client) return oauthError("invalid_client", "ไม่รู้จัก client", 401);

  // Confidential clients must present their secret; public clients rely on PKCE alone.
  if (client.token_endpoint_auth_method !== "none") {
    if (!auth.client_secret || !client.client_secret_hash || sha256(auth.client_secret) !== client.client_secret_hash) {
      return oauthError("invalid_client", "client_secret ไม่ถูกต้อง", 401);
    }
  }

  const resource = body.resource;
  if (resource && normaliseResource(resource) !== normaliseResource(`${baseUrl(req)}${MCP_PATH}`)) {
    return oauthError("invalid_target", `resource ต้องเป็น ${baseUrl(req)}${MCP_PATH}`);
  }

  switch (body.grant_type) {
    case "authorization_code": return authorizationCode(client, body);
    case "refresh_token": return refreshToken(client, body);
    default: return oauthError("unsupported_grant_type", "grant_type ต้องเป็น authorization_code หรือ refresh_token");
  }
}

async function authorizationCode(client: OAuthClient, body: Record<string, string>) {
  if (!body.code || !body.code_verifier) return oauthError("invalid_request", "ต้องส่ง code และ code_verifier");
  const grant = await consumeCode(body.code);
  if (!grant || grant.client_id !== client.client_id) return oauthError("invalid_grant", "code ไม่ถูกต้อง หมดอายุ หรือถูกใช้ไปแล้ว");
  if (body.redirect_uri && body.redirect_uri !== grant.redirect_uri) return oauthError("invalid_grant", "redirect_uri ไม่ตรงกับตอนขอ code");
  if (!verifyPkce(body.code_verifier, grant.code_challenge)) return oauthError("invalid_grant", "code_verifier ไม่ตรงกับ code_challenge");

  try {
    const role = await getUserRole(grant.user_id);
    const t = await issueTokens({ client, user_id: grant.user_id, user_role: role, scopes: grant.scopes });
    return json({ token_type: "Bearer", ...t });
  } catch (e: any) {
    console.error("[oauth] issue failed:", e?.message ?? e);
    return oauthError("server_error", "ออก token ไม่สำเร็จ", 500);
  }
}

async function refreshToken(client: OAuthClient, body: Record<string, string>) {
  if (!body.refresh_token) return oauthError("invalid_request", "ต้องส่ง refresh_token");
  const row = await findRefresh(body.refresh_token);
  if (!row || row.client_id !== client.client_id) return oauthError("invalid_grant", "refresh_token ไม่ถูกต้อง");
  if (row.revoked_at) {
    // A rotated-out token being replayed means it leaked, or two clients share it.
    // Either way the current pair is burned too — not just this stale row.
    await revokeFamily(row.user_id, row.client_id);
    return oauthError("invalid_grant", "refresh_token นี้ถูกใช้ไปแล้ว — token ทั้งชุดถูกเพิกถอน ต้องเชื่อมต่อใหม่");
  }
  if (new Date(row.expires_at).getTime() < Date.now()) return oauthError("invalid_grant", "refresh_token หมดอายุ — ต้องเชื่อมต่อใหม่");

  // Narrowing on refresh is allowed (RFC 6749 §6); widening is not.
  let scopes = row.scopes;
  if (body.scope) {
    const asked = body.scope.split(/\s+/).filter(Boolean);
    if (asked.some((s) => !row.scopes.includes(s))) return oauthError("invalid_scope", "ขอ scope เกินกว่าที่เคยอนุญาต");
    scopes = asked;
  }

  try {
    await revokeRefresh(row);
    const role = await getUserRole(row.user_id);
    const t = await issueTokens({ client, user_id: row.user_id, user_role: role, scopes });
    return json({ token_type: "Bearer", ...t });
  } catch (e: any) {
    console.error("[oauth] refresh failed:", e?.message ?? e);
    return oauthError("server_error", "ต่ออายุ token ไม่สำเร็จ", 500);
  }
}
export async function OPTIONS() { return preflight(); }
