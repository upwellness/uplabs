import { readClientAuth, sha256 } from "@/lib/oauth/core";
import { parseToken } from "@/lib/api/tokens";
import { getClient, findRefresh, revokeRefresh, revokeAccessByRaw } from "@/lib/oauth/store";
import { oauthError, preflight, readForm, CORS, NO_STORE } from "@/lib/oauth/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/oauth/revoke — RFC 7009. Called when a user disconnects the connector.
 * Always answers 200 for a well-formed request, whether or not the token existed.
 */
export async function POST(req: Request) {
  const body = await readForm(req);
  const auth = readClientAuth(req.headers.get("authorization"), body);
  if (!auth.client_id) return oauthError("invalid_client", "ต้องระบุ client_id", 401);
  const client = await getClient(auth.client_id);
  if (!client) return oauthError("invalid_client", "ไม่รู้จัก client", 401);
  if (client.token_endpoint_auth_method !== "none" && (!auth.client_secret || sha256(auth.client_secret) !== client.client_secret_hash)) {
    return oauthError("invalid_client", "client_secret ไม่ถูกต้อง", 401);
  }
  if (!body.token) return oauthError("invalid_request", "ต้องส่ง token");

  const parsed = parseToken(body.token);
  if (parsed) {
    await revokeAccessByRaw(parsed.prefix, client.client_id);
  } else {
    const row = await findRefresh(body.token);
    if (row && row.client_id === client.client_id) await revokeRefresh(row);
  }
  return new Response(null, { status: 200, headers: { ...CORS, ...NO_STORE } });
}
export async function OPTIONS() { return preflight(); }
