import { SCOPES } from "@/lib/api/scopes";
import { protectedResourceMetadata } from "@/lib/oauth/core";
import { baseUrl, json, preflight } from "@/lib/oauth/http";

export const dynamic = "force-dynamic";

/** RFC 9728 — served at /.well-known/oauth-protected-resource via next.config rewrite. */
export async function GET(req: Request) {
  return json(protectedResourceMetadata(baseUrl(req), SCOPES), 200, { "cache-control": "public, max-age=3600" });
}
export async function OPTIONS() { return preflight(); }
