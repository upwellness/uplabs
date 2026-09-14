/**
 * POST /api/mcp — the External API as an MCP server (Streamable HTTP, stateless).
 *
 * Any MCP-capable AI client — Claude Code, Claude Desktop, Cursor, Gemini CLI, Codex,
 * n8n's MCP node, custom agents on the official SDKs — connects here with the same
 * `Authorization: Bearer uplab_live_…` token the REST API uses. Nothing is duplicated:
 * every tool call is turned back into a `Request` and handed to the existing /api/v1
 * route handler, so token checks, scopes, customer reach, rate limits and the audit log
 * are the ones already in production. If it is refused over REST it is refused here.
 *
 * Two ways to hold a token: paste one issued by an admin (Claude Code, Cursor, n8n),
 * or go through our OAuth 2.1 server (claude.ai custom connectors, ChatGPT) which mints
 * the same kind of api_tokens row after the user logs in and consents — lib/oauth/.
 */
import { NextResponse } from "next/server";
import { SCOPES } from "@/lib/api/scopes";
import { INTENT_NAMES } from "@/lib/api/resolver";
import { buildSpec } from "@/lib/api/openapi-spec";
import { authenticate } from "@/lib/api/auth";
import { toolsFromSpec, publicTool, buildInvocation, type McpTool, type RouteKey } from "@/lib/mcp/tools";
import { handleHttpBody, PROTOCOL_VERSIONS, type ToolResult } from "@/lib/mcp/protocol";

import * as meta from "@/app/api/v1/meta/route";
import * as query from "@/app/api/v1/query/route";
import * as customers from "@/app/api/v1/customers/route";
import * as customer from "@/app/api/v1/customers/[id]/route";
import * as labs from "@/app/api/v1/customers/[id]/labs/route";
import * as labsSubmit from "@/app/api/v1/customers/[id]/labs/submit/route";
import * as labsCompare from "@/app/api/v1/customers/[id]/labs/compare/route";
import * as overview from "@/app/api/v1/customers/[id]/overview/route";
import * as measurements from "@/app/api/v1/customers/[id]/measurements/route";
import * as cgm from "@/app/api/v1/customers/[id]/cgm/route";
import * as cgmMetrics from "@/app/api/v1/customers/[id]/cgm/metrics/route";
import * as cgmImport from "@/app/api/v1/customers/[id]/cgm/import/route";
import * as assessment from "@/app/api/v1/customers/[id]/assessment/route";
import * as food from "@/app/api/v1/customers/[id]/food/route";
import * as photoDate from "@/app/api/v1/food/photo-date/route";
import * as plan from "@/app/api/v1/customers/[id]/plan/route";
import * as wearable from "@/app/api/v1/customers/[id]/wearable/route";
import * as portalLink from "@/app/api/v1/customers/[id]/portal-link/route";
import * as supplements from "@/app/api/v1/customers/[id]/supplements/route";
import * as notes from "@/app/api/v1/customers/[id]/notes/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // importCgmFile can carry 60k rows

// `id` is the only path param in v1; buildInvocation guarantees it is present for routes that declare it.
type Handler = (req: Request, ctx: { params: { id: string } }) => Promise<Response>;

/** Typed against RouteKey so a new operation in the spec fails the build until it is wired here. */
const HANDLERS: Record<RouteKey, Handler> = {
  "GET /meta": meta.GET,
  "POST /query": query.POST,
  "GET /customers": customers.GET,
  "POST /customers": customers.POST,
  "GET /customers/{id}": customer.GET,
  "PATCH /customers/{id}": customer.PATCH,
  "GET /customers/{id}/labs": labs.GET,
  "POST /customers/{id}/labs": labs.POST,
  "POST /customers/{id}/labs/submit": labsSubmit.POST,
  "GET /customers/{id}/labs/compare": labsCompare.GET,
  "GET /customers/{id}/overview": overview.GET,
  "GET /customers/{id}/measurements": measurements.GET,
  "POST /customers/{id}/measurements": measurements.POST,
  "GET /customers/{id}/cgm": cgm.GET,
  "GET /customers/{id}/cgm/metrics": cgmMetrics.GET,
  "POST /customers/{id}/cgm/import": cgmImport.POST,
  "GET /customers/{id}/assessment": assessment.GET,
  "POST /customers/{id}/assessment": assessment.POST,
  "GET /customers/{id}/food": food.GET,
  "POST /customers/{id}/food": food.POST,
  "POST /food/photo-date": photoDate.POST,
  "GET /customers/{id}/plan": plan.GET,
  "POST /customers/{id}/plan": plan.POST,
  "GET /customers/{id}/wearable": wearable.GET,
  "POST /customers/{id}/portal-link": portalLink.POST,
  "GET /customers/{id}/supplements": supplements.GET,
  "GET /customers/{id}/notes": notes.GET,
  "POST /customers/{id}/notes": notes.POST,
};

// Built once per instance; the spec is static apart from the server URL, which tools never see.
const TOOLS: McpTool[] = toolsFromSpec(buildSpec("https://uplabs.invalid", { scopes: SCOPES, intentNames: INTENT_NAMES }));
const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
const PUBLIC_TOOLS = TOOLS.map(publicTool);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id, accept",
  "access-control-expose-headers": "mcp-protocol-version",
};
const NO_STORE = { "cache-control": "no-store, max-age=0, must-revalidate" };

/** Forward only what the inner handler needs: credentials, client identity, caller IP. */
function innerHeaders(req: Request, toolName: string): Headers {
  const h = new Headers({ "content-type": "application/json", accept: "application/json" });
  for (const k of ["authorization", "x-api-key", "x-forwarded-for", "x-real-ip"]) {
    const v = req.headers.get(k); if (v) h.set(k, v);
  }
  // Audit log shows "mcp:<tool> <client>" so an MCP call is distinguishable from REST.
  h.set("user-agent", `mcp:${toolName} ${req.headers.get("user-agent") ?? ""}`.trim().slice(0, 300));
  return h;
}

/** Execute one tool by replaying it through the REST handler. Never throws for user errors. */
async function callTool(req: Request, name: string, args: Record<string, unknown> | undefined): Promise<ToolResult> {
  const tool = TOOL_BY_NAME.get(name)!;
  const base = new URL(req.url).origin + "/api/v1";
  const inv = buildInvocation(tool, args, base);
  if ("error" in inv) {
    return { isError: true, content: [{ type: "text", text: JSON.stringify({ ok: false, error: "bad_request", message: inv.error }) }] };
  }

  const inner = new Request(inv.url, {
    method: inv.method,
    headers: innerHeaders(req, name),
    body: inv.body === null ? undefined : JSON.stringify(inv.body),
  });
  const res = await HANDLERS[tool.route](inner, { params: inv.params as { id: string } });

  let payload: any;
  const text = await res.text();
  try { payload = JSON.parse(text); } catch { payload = { ok: false, error: "internal_error", message: text.slice(0, 500) }; }
  const isError = res.status >= 400 || payload?.ok === false;
  if (isError && typeof payload === "object" && payload) payload.http_status = res.status;

  return {
    isError,
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: typeof payload === "object" && payload ? payload : { value: payload },
  };
}

function unauthorized(res: Response, req: Request) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries({ ...CORS, ...NO_STORE })) h.set(k, v);
  // RFC 6750 + RFC 9728: a client that has no token follows resource_metadata into the
  // OAuth flow (claude.ai, ChatGPT); one that already holds a uplab_live_… token just sends it.
  if (res.status === 401) {
    const origin = new URL(req.url).origin;
    h.set("www-authenticate", `Bearer realm="${origin}/api/mcp", resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp"`);
  }
  return new Response(res.body, { status: res.status, headers: h });
}

export async function POST(req: Request) {
  // One authentication gate for the whole MCP request — initialize and tools/list
  // included. Rejections use the REST API's own error bodies and codes (401/403/429).
  let auth;
  try { auth = await authenticate(req); }
  catch (e: any) {
    console.error("[mcp] authenticate threw:", e?.message ?? e);
    return NextResponse.json({ ok: false, error: "internal_error", message: "ระบบยังไม่พร้อมให้บริการ" }, { status: 500, headers: { ...CORS, ...NO_STORE } });
  }
  if (!auth.ok) return unauthorized(auth.fail.response, req);

  const raw = await req.text();
  const out = await handleHttpBody(raw, {
    tools: PUBLIC_TOOLS,
    call: (name, args) => callTool(req, name, args),
  });

  const headers = { ...CORS, ...NO_STORE, "mcp-protocol-version": PROTOCOL_VERSIONS[0] };
  if (out.body === null) return new Response(null, { status: out.status, headers });
  return NextResponse.json(out.body, { status: out.status, headers });
}

/** No server→client stream in the stateless profile; the spec says answer 405. */
export async function GET() {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed", message: "MCP endpoint นี้รับเฉพาะ POST (Streamable HTTP, stateless) — ไม่มี SSE stream" },
    { status: 405, headers: { ...CORS, ...NO_STORE, allow: "POST, OPTIONS" } },
  );
}

/** Session teardown — there is no session, so there is nothing to tear down. */
export async function DELETE() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS, "access-control-max-age": "86400" } });
}
