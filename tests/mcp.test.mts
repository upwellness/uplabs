/**
 * MCP server core — tool derivation from the OpenAPI spec, argument→HTTP mapping,
 * and the JSON-RPC handling — all without Next or a database.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSpec } from "../lib/api/openapi-spec.ts";
import { SCOPES } from "../lib/api/scopes.ts";
import { INTENT_NAMES } from "../lib/api/resolver.ts";
import { toolsFromSpec, buildInvocation, publicTool, ROUTE_KEYS, TOOL_NAME_RE } from "../lib/mcp/tools.ts";
import { handleMessage, handleHttpBody, negotiateVersion, PROTOCOL_VERSIONS, RPC, type ToolResult } from "../lib/mcp/protocol.ts";

const spec = buildSpec("https://example.test", { scopes: SCOPES, intentNames: INTENT_NAMES });
const tools = toolsFromSpec(spec);
const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

test("every OpenAPI operation becomes exactly one MCP tool, and every route key is used", () => {
  const ops = Object.values<any>(spec.paths).flatMap((p) => Object.values<any>(p)).length;
  assert.equal(tools.length, ops);
  for (const t of tools) {
    assert.match(t.name, TOOL_NAME_RE);
    assert.equal(t.inputSchema.type, "object");
    assert.equal(t.inputSchema.additionalProperties, false);
    assert.ok(t.description.length > 0, t.name);
  }
  const used = new Set(tools.map((t) => t.route));
  for (const k of ROUTE_KEYS) assert.ok(used.has(k), `ROUTE_KEYS has "${k}" but no operation maps to it`);
});

test("path params are required, query and body are merged into one flat object", () => {
  const t = byName.getLabs;
  assert.deepEqual(t.pathParams, ["id"]);
  assert.deepEqual([...t.queryParams].sort(), ["metric", "rounds"]);
  assert.deepEqual(t.inputSchema.required, ["id"]);

  const n = byName.addNote;
  assert.deepEqual([...n.bodyProps].sort(), ["body", "pinned"]);
  assert.deepEqual(n.inputSchema.required, ["id", "body"]);

  const q = byName.askUpLabs;
  assert.deepEqual(q.pathParams, []);
  assert.deepEqual(q.inputSchema.required, ["q"]);
});

test("annotations: GET is read-only, POST is not idempotent, nothing is destructive", () => {
  assert.equal(byName.getCgmMetrics.annotations.readOnlyHint, true);
  assert.equal(byName.importCgmFile.annotations.readOnlyHint, false);
  assert.equal(byName.importCgmFile.annotations.idempotentHint, false);
  assert.equal(byName.updateCustomer.annotations.idempotentHint, true);
  assert.ok(tools.every((t) => t.annotations.destructiveHint === false));
});

test("publicTool strips routing detail so clients never see internal paths", () => {
  const p = publicTool(byName.getOverview) as any;
  assert.equal(p.route, undefined); assert.equal(p.path, undefined); assert.equal(p.method, undefined);
  assert.deepEqual(Object.keys(p).sort(), ["annotations", "description", "inputSchema", "name", "title"]);
});

test("buildInvocation: GET with path + query, no body", () => {
  const inv = buildInvocation(byName.getLabs, { id: "abc-123", rounds: 5, metric: "ldl" }, "https://x.test/api/v1");
  assert.ok(!("error" in inv));
  assert.equal(inv.method, "GET");
  assert.equal(inv.url, "https://x.test/api/v1/customers/abc-123/labs?rounds=5&metric=ldl");
  assert.deepEqual(inv.params, { id: "abc-123" });
  assert.equal(inv.body, null);
});

test("buildInvocation: POST puts body props in body, path params in path, nothing leaks across", () => {
  const inv = buildInvocation(byName.importCgmFile, { id: "c1", rows: [["2026-09-11 19:08", 83]], profile_name: "x" }, "https://x.test/api/v1/");
  assert.ok(!("error" in inv));
  assert.equal(inv.url, "https://x.test/api/v1/customers/c1/cgm/import");
  assert.deepEqual(inv.body, { rows: [["2026-09-11 19:08", 83]], profile_name: "x" });
  assert.equal("id" in inv.body!, false);
});

test("buildInvocation: missing path param and unknown args are refused, not guessed", () => {
  assert.match((buildInvocation(byName.getCustomer, {}, "https://x.test/api/v1") as any).error, /"id"/);
  assert.match((buildInvocation(byName.getCustomer, { id: 42 } as any, "https://x.test/api/v1") as any).error, /"id"/);
  assert.match((buildInvocation(byName.getMeta, { foo: 1 }, "https://x.test/api/v1") as any).error, /foo/);
  // empty query values are simply omitted
  const inv = buildInvocation(byName.getCgmMetrics, { id: "c1", from: "", days: undefined }, "https://x.test/api/v1");
  assert.equal((inv as any).url, "https://x.test/api/v1/customers/c1/cgm/metrics");
});

test("toolsFromSpec refuses a spec whose flattening would be ambiguous", () => {
  const bad = { paths: { "/customers/{id}": { patch: {
    operationId: "updateCustomer", parameters: [{ name: "id", in: "path", schema: { type: "string" } }],
    requestBody: { content: { "application/json": { schema: { type: "object", properties: { id: { type: "string" } } } } } },
  } } } };
  assert.throws(() => toolsFromSpec(bad), /"id" appears twice/);
  const dup = { paths: { "/meta": { get: { operationId: "getMeta" } }, "/customers": { get: { operationId: "getMeta" } } } };
  assert.throws(() => toolsFromSpec(dup), /duplicate/);
  const unrouted = { paths: { "/nowhere": { get: { operationId: "getNowhere" } } } };
  assert.throws(() => toolsFromSpec(unrouted), /ROUTE_KEYS/);
});

/* ── protocol ──────────────────────────────────────────────────────────────── */

const calls: { name: string; args: unknown }[] = [];
const deps = {
  tools: tools.map(publicTool),
  call: async (name: string, args: any): Promise<ToolResult> => {
    calls.push({ name, args });
    if (name === "getMeta") throw new Error("boom");
    return { content: [{ type: "text", text: JSON.stringify({ ok: true, echo: args }) }], structuredContent: { ok: true, echo: args } };
  },
};

test("initialize negotiates version and advertises only tools", async () => {
  const r = (await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "0" } } }, deps))!;
  assert.equal(r.id, 1);
  const res = r.result as any;
  assert.equal(res.protocolVersion, "2025-03-26");
  assert.deepEqual(Object.keys(res.capabilities), ["tools"]);
  assert.equal(res.serverInfo.name, "uplabs");
  assert.ok(res.instructions.includes("getMeta"));
  // unknown / future version → our newest
  assert.equal(negotiateVersion("2099-01-01"), PROTOCOL_VERSIONS[0]);
  assert.equal(negotiateVersion(undefined), PROTOCOL_VERSIONS[0]);
});

test("notifications get no reply; a request with id 0 still gets one", async () => {
  assert.equal(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, deps), null);
  const r = await handleMessage({ jsonrpc: "2.0", id: 0, method: "ping" }, deps);
  assert.deepEqual(r, { jsonrpc: "2.0", id: 0, result: {} });
});

test("tools/list returns the public tool list", async () => {
  const r = (await handleMessage({ jsonrpc: "2.0", id: "a", method: "tools/list" }, deps))!;
  const list = (r.result as any).tools;
  assert.equal(list.length, tools.length);
  assert.ok(list.some((t: any) => t.name === "getCgmMetrics"));
  assert.equal(list[0].route, undefined);
});

test("tools/call: routes to the executor; unknown tool and bad arguments are -32602; a throw is -32603", async () => {
  calls.length = 0;
  const r = (await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "getLabs", arguments: { id: "c1", rounds: 3 } } }, deps))!;
  assert.deepEqual(calls, [{ name: "getLabs", args: { id: "c1", rounds: 3 } }]);
  assert.equal((r.result as any).structuredContent.ok, true);

  const unk = (await handleMessage({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "deleteEverything" } }, deps))!;
  assert.equal(unk.error?.code, RPC.INVALID_PARAMS);
  const noname = (await handleMessage({ jsonrpc: "2.0", id: 4, method: "tools/call", params: {} }, deps))!;
  assert.equal(noname.error?.code, RPC.INVALID_PARAMS);
  const badargs = (await handleMessage({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "getLabs", arguments: [1] } }, deps))!;
  assert.equal(badargs.error?.code, RPC.INVALID_PARAMS);
  const thrown = (await handleMessage({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "getMeta" } }, deps))!;
  assert.equal(thrown.error?.code, RPC.INTERNAL_ERROR);
  assert.equal(thrown.error?.data && (thrown.error.data as any).detail, "boom");
});

test("unsupported methods and malformed messages use the standard JSON-RPC codes", async () => {
  const r = (await handleMessage({ jsonrpc: "2.0", id: 7, method: "resources/list" }, deps))!;
  assert.equal(r.error?.code, RPC.METHOD_NOT_FOUND);
  const bad = (await handleMessage({ id: 8, method: "ping" }, deps))!;   // no jsonrpc field
  assert.equal(bad.error?.code, RPC.INVALID_REQUEST);
  assert.equal(bad.id, 8);
});

test("HTTP body: parse error → 400, notification-only → 202, batch → array, single → object", async () => {
  const p = await handleHttpBody("{nope", deps);
  assert.equal(p.status, 400); assert.equal((p.body as any).error.code, RPC.PARSE_ERROR);

  const n = await handleHttpBody(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }), deps);
  assert.equal(n.status, 202); assert.equal(n.body, null);

  const b = await handleHttpBody(JSON.stringify([
    { jsonrpc: "2.0", id: 1, method: "ping" },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ]), deps);
  assert.equal(b.status, 200);
  assert.ok(Array.isArray(b.body));
  assert.deepEqual((b.body as any[]).map((r) => r.id), [1, 2]);

  const s = await handleHttpBody(JSON.stringify({ jsonrpc: "2.0", id: 9, method: "ping" }), deps);
  assert.equal(s.status, 200); assert.equal(Array.isArray(s.body), false);

  const e = await handleHttpBody("[]", deps);
  assert.equal(e.status, 400);
});
