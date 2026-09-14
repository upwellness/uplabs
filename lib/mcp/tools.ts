/**
 * MCP tools derived from the OpenAPI document — one source of truth for every AI client.
 *
 * ChatGPT reads /api/v1/openapi.json; MCP clients (Claude, Cursor, Gemini CLI, …) read
 * tools/list. If the two were maintained by hand they would drift within a month, so the
 * MCP tool list is *computed* from the same `buildSpec()` output: every operation becomes
 * one tool named by its operationId, with path params, query params and JSON body
 * properties flattened into a single input object. Same vocabulary in both worlds — a
 * ChatGPT user and a Claude user can compare notes on `getCgmMetrics`.
 *
 * Pure: no I/O, no Next. Tested in tests/mcp.test.mts.
 */

export interface McpToolSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
}

export interface McpToolDef {
  name: string;
  title?: string;
  description: string;
  inputSchema: McpToolSchema;
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
}

/** A tool plus the routing detail needed to turn its arguments back into an HTTP call. */
export interface McpTool extends McpToolDef {
  method: "GET" | "POST" | "PATCH";
  /** OpenAPI path template, e.g. "/customers/{id}/labs" */
  path: string;
  /** "GET /customers/{id}/labs" — key into the handler table in app/api/mcp/route.ts */
  route: RouteKey;
  pathParams: string[];
  queryParams: string[];
  bodyProps: string[];
}

/**
 * Every route the MCP server can dispatch to. Typed as a tuple so the handler table in
 * the route file is `Record<RouteKey, …>` and tsc refuses to build if an operation is
 * added to the spec without a handler being wired — and the test refuses the reverse.
 */
export const ROUTE_KEYS = [
  "GET /meta",
  "POST /query",
  "GET /customers",
  "POST /customers",
  "GET /customers/{id}",
  "PATCH /customers/{id}",
  "GET /customers/{id}/labs",
  "POST /customers/{id}/labs",
  "POST /customers/{id}/labs/submit",
  "GET /customers/{id}/labs/compare",
  "GET /customers/{id}/overview",
  "GET /customers/{id}/measurements",
  "POST /customers/{id}/measurements",
  "GET /customers/{id}/cgm",
  "GET /customers/{id}/cgm/metrics",
  "POST /customers/{id}/cgm/import",
  "GET /customers/{id}/assessment",
  "POST /customers/{id}/assessment",
  "GET /customers/{id}/food",
  "POST /customers/{id}/food",
  "POST /food/photo-date",
  "GET /customers/{id}/plan",
  "POST /customers/{id}/plan",
  "GET /customers/{id}/wearable",
  "POST /customers/{id}/portal-link",
  "GET /customers/{id}/supplements",
  "GET /customers/{id}/notes",
  "POST /customers/{id}/notes",
] as const;
export type RouteKey = (typeof ROUTE_KEYS)[number];

/** MCP tool names must match this (spec: "SHOULD be limited to [a-zA-Z0-9_-]"). */
export const TOOL_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;

const METHODS = ["get", "post", "patch"] as const;

/** Flatten the OpenAPI spec (output of buildSpec) into MCP tools. Throws on any ambiguity. */
export function toolsFromSpec(spec: any): McpTool[] {
  const out: McpTool[] = [];
  const seen = new Set<string>();

  for (const [path, item] of Object.entries<any>(spec.paths ?? {})) {
    for (const m of METHODS) {
      const op = item[m];
      if (!op) continue;
      const name: string = op.operationId;
      if (!TOOL_NAME_RE.test(name)) throw new Error(`operationId "${name}" is not a valid MCP tool name`);
      if (seen.has(name)) throw new Error(`duplicate operationId "${name}"`);
      seen.add(name);

      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      const pathParams: string[] = [], queryParams: string[] = [], bodyProps: string[] = [];
      const add = (key: string, schema: unknown, where: string) => {
        if (key in properties) throw new Error(`${name}: "${key}" appears twice (${where}) — cannot flatten into one input object`);
        properties[key] = schema;
      };

      for (const p of op.parameters ?? []) {
        const schema = { ...(p.schema ?? {}), ...(p.description ? { description: p.description } : {}) };
        add(p.name, schema, p.in);
        if (p.in === "path") { pathParams.push(p.name); required.push(p.name); }
        else if (p.in === "query") queryParams.push(p.name);
        else throw new Error(`${name}: unsupported parameter location "${p.in}"`);
      }

      const body = op.requestBody?.content?.["application/json"]?.schema;
      if (body) {
        if (body.type !== "object") throw new Error(`${name}: JSON body must be an object to flatten`);
        for (const [k, v] of Object.entries<any>(body.properties ?? {})) { add(k, v, "body"); bodyProps.push(k); }
        for (const r of body.required ?? []) required.push(r);
      }

      const method = m.toUpperCase() as McpTool["method"];
      const route = `${method} ${path}` as RouteKey;
      if (!(ROUTE_KEYS as readonly string[]).includes(route)) {
        throw new Error(`${name}: no handler route for "${route}" — add it to ROUTE_KEYS and the handler table`);
      }

      out.push({
        name,
        title: op.summary,
        description: [op.summary, op.description].filter(Boolean).join(" — "),
        inputSchema: { type: "object", properties, ...(required.length ? { required } : {}), additionalProperties: false },
        annotations: {
          readOnlyHint: method === "GET",
          destructiveHint: false,           // nothing in v1 deletes or overwrites history
          idempotentHint: method !== "POST",
          openWorldHint: false,
        },
        method, path, route, pathParams, queryParams, bodyProps,
      });
    }
  }
  return out;
}

/** What a client sees in tools/list — routing detail stripped. */
export function publicTool(t: McpTool): McpToolDef {
  const { name, title, description, inputSchema, annotations } = t;
  return { name, title, description, inputSchema, annotations };
}

export interface Invocation {
  method: McpTool["method"];
  /** Absolute URL, base + concrete path + query string */
  url: string;
  /** Concrete path params for the Next handler's `{ params }` */
  params: Record<string, string>;
  /** JSON body or null for GET */
  body: Record<string, unknown> | null;
}

/**
 * Turn tool arguments back into the HTTP request the route handler expects.
 * Returns a string error when a required path parameter is missing or not a string.
 */
export function buildInvocation(tool: McpTool, args: Record<string, unknown> | undefined, base: string): Invocation | { error: string } {
  const a = args ?? {};
  let path = tool.path;
  const params: Record<string, string> = {};
  for (const p of tool.pathParams) {
    const v = a[p];
    if (typeof v !== "string" || !v.trim()) return { error: `ต้องระบุ "${p}" เป็น string` };
    params[p] = v.trim();
    path = path.replace(`{${p}}`, encodeURIComponent(v.trim()));
  }

  const url = new URL(base.replace(/\/$/, "") + path);
  for (const q of tool.queryParams) {
    const v = a[q];
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(q, String(v));
  }

  let body: Record<string, unknown> | null = null;
  if (tool.method !== "GET") {
    body = {};
    for (const k of tool.bodyProps) if (a[k] !== undefined) body[k] = a[k];
  }

  const unknown = Object.keys(a).filter((k) => !tool.pathParams.includes(k) && !tool.queryParams.includes(k) && !tool.bodyProps.includes(k));
  if (unknown.length) return { error: `ไม่รู้จักพารามิเตอร์: ${unknown.join(", ")}` };

  return { method: tool.method, url: url.toString(), params, body };
}
