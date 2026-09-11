import { validateRegistration } from "@/lib/oauth/core";
import { registerClient } from "@/lib/oauth/store";
import { oauthError, json, preflight, clientIp } from "@/lib/oauth/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/oauth/register — RFC 7591 dynamic client registration.
 *
 * Open by design: claude.ai and ChatGPT register themselves before the user has
 * logged in anywhere, so there is nobody to authenticate yet. Registering grants
 * nothing — a real UP Labs user still has to sign in and consent on /oauth/authorize,
 * and the consent page shows the client's name and redirect host so a look-alike
 * registration is visible to the person clicking "allow".
 */
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return oauthError("invalid_client_metadata", "body ต้องเป็น JSON"); }
  const v = validateRegistration(body);
  if (!v.ok) return oauthError(v.error, v.error_description);

  let issued: { client_id: string; client_secret: string | null };
  try { issued = await registerClient(v.value, clientIp(req)); }
  catch (e: any) { console.error("[oauth] register failed:", e?.message ?? e); return oauthError("server_error", "ลงทะเบียนไม่สำเร็จ", 500); }

  return json({
    client_id: issued.client_id,
    ...(issued.client_secret ? { client_secret: issued.client_secret, client_secret_expires_at: 0 } : {}),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: v.value.client_name,
    redirect_uris: v.value.redirect_uris,
    token_endpoint_auth_method: v.value.token_endpoint_auth_method,
    grant_types: v.value.grant_types,
    response_types: ["code"],
    ...(v.value.client_uri ? { client_uri: v.value.client_uri } : {}),
    ...(v.value.logo_uri ? { logo_uri: v.value.logo_uri } : {}),
  }, 201);
}
export async function OPTIONS() { return preflight(); }
