/** Small helpers shared by the OAuth route handlers. */
import { NextResponse } from "next/server";

export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version",
};
export const NO_STORE = { "cache-control": "no-store", pragma: "no-cache" };

/** Public origin of this deployment, as the client sees it. */
export const baseUrl = (req: Request) => new URL(req.url).origin;

export const oauthError = (error: string, error_description: string, status = 400) =>
  NextResponse.json({ error, error_description }, { status, headers: { ...CORS, ...NO_STORE } });

export const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...CORS, ...NO_STORE, ...extra } });

export const preflight = () => new Response(null, { status: 204, headers: { ...CORS, "access-control-max-age": "86400" } });

/** Token/revoke endpoints accept application/x-www-form-urlencoded (the standard) or JSON. */
export async function readForm(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  const text = await req.text();
  const out: Record<string, string> = {};
  if (ct.includes("application/json")) {
    try { for (const [k, v] of Object.entries(JSON.parse(text) ?? {})) if (typeof v === "string") out[k] = v; } catch { /* empty */ }
    return out;
  }
  for (const [k, v] of new URLSearchParams(text)) out[k] = v;
  return out;
}

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
