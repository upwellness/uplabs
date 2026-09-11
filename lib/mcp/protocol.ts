/**
 * MCP (Model Context Protocol) server core — Streamable HTTP, stateless, JSON-RPC 2.0.
 *
 * Only the tools capability is offered. There is no session, no SSE stream and no
 * server-initiated message: every POST is answered with one JSON document, which is
 * the simplest transport shape the spec allows and the only one that fits a
 * serverless function that may be a different instance on the next call.
 *
 * Pure: the caller injects the tool list and the executor, so this file is tested
 * without Next or a database (tests/mcp.test.mts).
 *
 * Spec: https://modelcontextprotocol.io/specification/2025-06-18
 */
import type { McpToolDef } from "./tools";

/** Versions this server speaks. Newest first; the first entry is what we offer by default. */
export const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export const SERVER_INFO = { name: "uplabs", title: "UP Labs", version: "1.0.0" } as const;

export const INSTRUCTIONS =
  "UP Labs — ข้อมูลสุขภาพลูกค้าของโค้ช UP Wellness · เรียก getMeta ก่อนถ้าไม่แน่ใจสิทธิ์ · " +
  "ค้นชื่อด้วย searchCustomers แล้วใช้ id · ผลแล็บใช้ compareLabs/getOverview · " +
  "น้ำตาลต่อเนื่องใช้ getCgmMetrics (ดู reliable และ caveats ก่อนสรุป) · " +
  "ใบแล็บที่อ่านจากรูปให้ submitLabResult (เข้าคิวรอคนตรวจ) ไม่ใช่ addLabResult · " +
  "ข้อมูลใช้เพื่อการดูแลเชิงป้องกัน ไม่ใช่การวินิจฉัย · ค่าผิดปกติแนะนำพบแพทย์";

/* ── JSON-RPC types ─────────────────────────────────────────────────────────── */

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest { jsonrpc: "2.0"; id?: JsonRpcId; method: string; params?: any }
export interface JsonRpcResponse { jsonrpc: "2.0"; id: JsonRpcId; result?: unknown; error?: { code: number; message: string; data?: unknown } }

export const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

/** What tools/call hands back — text for every client, structured for the ones that read it. */
export interface ToolResult {
  content: { type: "text"; text: string }[];
  structuredContent?: unknown;
  isError?: boolean;
}

export interface McpDeps {
  tools: McpToolDef[];
  /** Execute one tool. Must not throw for user errors — return isError instead. */
  call: (name: string, args: Record<string, unknown> | undefined) => Promise<ToolResult>;
}

export interface McpHttpResult { status: number; body: unknown | null }

const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
const err = (id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse =>
  ({ jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } });

const isRequest = (m: any): m is JsonRpcRequest =>
  !!m && typeof m === "object" && m.jsonrpc === "2.0" && typeof m.method === "string";

/** Pick the protocol version to answer with: the client's if we speak it, else our newest. */
export function negotiateVersion(requested: unknown): string {
  return typeof requested === "string" && (PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested : PROTOCOL_VERSIONS[0];
}

/** Handle one JSON-RPC message. Returns null for notifications (nothing to send back). */
export async function handleMessage(msg: unknown, deps: McpDeps): Promise<JsonRpcResponse | null> {
  if (!isRequest(msg)) {
    const id = (msg as any)?.id ?? null;
    return err(id, RPC.INVALID_REQUEST, "ต้องเป็น JSON-RPC 2.0 ที่มี method");
  }
  const hasId = msg.id !== undefined && msg.id !== null;
  const id: JsonRpcId = hasId ? msg.id! : null;

  // notifications — acknowledged silently
  if (msg.method.startsWith("notifications/")) return null;
  if (!hasId) return null; // a request without an id cannot be answered; treat as notification

  switch (msg.method) {
    case "initialize":
      return ok(id, {
        protocolVersion: negotiateVersion(msg.params?.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });

    case "ping":
      return ok(id, {});

    case "tools/list":
      return ok(id, { tools: deps.tools });

    case "tools/call": {
      const name = msg.params?.name;
      if (typeof name !== "string") return err(id, RPC.INVALID_PARAMS, 'ต้องมี params.name');
      if (!deps.tools.some((t) => t.name === name)) return err(id, RPC.INVALID_PARAMS, `ไม่รู้จัก tool "${name}"`);
      const args = msg.params?.arguments;
      if (args !== undefined && (typeof args !== "object" || Array.isArray(args) || args === null)) {
        return err(id, RPC.INVALID_PARAMS, "params.arguments ต้องเป็น object");
      }
      try {
        return ok(id, await deps.call(name, args));
      } catch (e: any) {
        // A thrown error is a bug on our side, not a tool refusal — surface as JSON-RPC error.
        return err(id, RPC.INTERNAL_ERROR, "เกิดข้อผิดพลาดภายใน", { detail: String(e?.message ?? e).slice(0, 200) });
      }
    }

    // Capabilities we do not advertise — a compliant client never asks, a curious one gets the standard answer.
    default:
      return err(id, RPC.METHOD_NOT_FOUND, `ไม่รองรับ method "${msg.method}"`);
  }
}

/**
 * Handle the raw text of one HTTP POST body: a single message or a batch.
 *   • parse failure         → 400 + JSON-RPC parse error
 *   • only notifications    → 202, empty body
 *   • otherwise             → 200 + response (array iff the request was a batch)
 */
export async function handleHttpBody(raw: string, deps: McpDeps): Promise<McpHttpResult> {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { return { status: 400, body: err(null, RPC.PARSE_ERROR, "JSON ไม่ถูกต้อง") }; }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return { status: 400, body: err(null, RPC.INVALID_REQUEST, "batch ว่าง") };
    const replies = (await Promise.all(parsed.map((m) => handleMessage(m, deps)))).filter((r): r is JsonRpcResponse => r !== null);
    return replies.length ? { status: 200, body: replies } : { status: 202, body: null };
  }

  const reply = await handleMessage(parsed, deps);
  return reply ? { status: 200, body: reply } : { status: 202, body: null };
}
