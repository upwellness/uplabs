import { SCOPES } from "@/lib/api/scopes";
import { authorizationServerMetadata } from "@/lib/oauth/core";
import { baseUrl, json, preflight } from "@/lib/oauth/http";

export const dynamic = "force-dynamic";

/** RFC 8414 — served at /.well-known/oauth-authorization-server via next.config rewrite. */
export async function GET(req: Request) {
  return json(authorizationServerMetadata(baseUrl(req), SCOPES), 200, { "cache-control": "public, max-age=3600" });
}
export async function OPTIONS() { return preflight(); }
