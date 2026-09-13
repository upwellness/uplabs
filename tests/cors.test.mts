/** CORS allowlist for /api/v1 — only named origins get headers; the token stays the credential. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedOrigins, corsHeaders } from "../lib/api/cors.ts";

test("allowlist: defaults + env, trailing slash trimmed, localhost only in dev", () => {
  assert.deepEqual(allowedOrigins(undefined, false), ["https://upcgm.vercel.app"]);
  assert.deepEqual(allowedOrigins("https://a.example/, https://b.example", false), ["https://upcgm.vercel.app", "https://a.example", "https://b.example"]);
  assert.ok(allowedOrigins(undefined, true).includes("http://localhost:4321"));
});

test("corsHeaders: allowed origin echoed with Vary; unknown or missing origin → null", () => {
  const h = corsHeaders("https://upcgm.vercel.app", ["https://upcgm.vercel.app"])!;
  assert.equal(h["Access-Control-Allow-Origin"], "https://upcgm.vercel.app"); assert.equal(h.Vary, "Origin");
  assert.match(h["Access-Control-Allow-Headers"], /Authorization/);
  assert.equal(corsHeaders("https://evil.example", ["https://upcgm.vercel.app"]), null);
  assert.equal(corsHeaders(null, ["https://upcgm.vercel.app"]), null);
});
