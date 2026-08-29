/**
 * The Gemini schema flavor.
 *
 * Gemini's function-calling schema accepts only a subset of OpenAPI. Handing it a
 * spec containing `default` or `maximum` risks a rejected tool definition, which
 * shows up as "Gemini just won't call the API" with nothing useful in the error.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SUPPORTED = new Set([
  "type", "nullable", "required", "format", "description", "properties", "items", "enum",
]);

/** Same transform the route applies — kept in the test so the rule is pinned. */
function geminiFlavor(node: any): any {
  if (Array.isArray(node)) return node.map(geminiFlavor);
  if (!node || typeof node !== "object") return node;
  const isSchema = "type" in node || "properties" in node;
  if (!isSchema) {
    const out: any = {};
    for (const [k, v] of Object.entries(node)) out[k] = geminiFlavor(v);
    return out;
  }
  const out: any = {}; const notes: string[] = [];
  for (const [k, v] of Object.entries(node)) {
    if (SUPPORTED.has(k)) { out[k] = geminiFlavor(v); continue; }
    if (k === "default") notes.push(`ค่าเริ่มต้น ${v}`);
    else if (k === "maximum") notes.push(`สูงสุด ${v}`);
    else if (k === "minimum") notes.push(`ต่ำสุด ${v}`);
  }
  if (notes.length) out.description = [out.description, `(${notes.join(" · ")})`].filter(Boolean).join(" ");
  return out;
}

function unsupportedKeys(node: any, path = "$", found: string[] = []): string[] {
  if (Array.isArray(node)) { node.forEach((n, i) => unsupportedKeys(n, `${path}[${i}]`, found)); return found; }
  if (!node || typeof node !== "object") return found;
  if ("type" in node || "properties" in node) {
    for (const k of Object.keys(node)) if (!SUPPORTED.has(k)) found.push(`${path}.${k}`);
  }
  for (const [k, v] of Object.entries(node)) unsupportedKeys(v, `${path}.${k}`, found);
  return found;
}

test("the flavor removes every key Gemini rejects", () => {
  const spec = {
    type: "object",
    description: "จำนวนรอบ",
    default: 3,
    maximum: 20,
    properties: { nested: { type: "integer", default: 5, minimum: 1 } },
  };
  assert.ok(unsupportedKeys(spec).length > 0, "fixture must actually contain bad keys");
  assert.deepEqual(unsupportedKeys(geminiFlavor(spec)), [], "nothing unsupported may survive");
});

test("what the removed keys said is preserved in the description, not lost", () => {
  const out = geminiFlavor({ type: "integer", description: "จำนวนรอบ", default: 3, maximum: 20 });
  assert.match(out.description, /จำนวนรอบ/);
  assert.match(out.description, /ค่าเริ่มต้น 3/);
  assert.match(out.description, /สูงสุด 20/);
});

test("a schema with no description still gets the note", () => {
  const out = geminiFlavor({ type: "integer", default: 7 });
  assert.match(out.description, /ค่าเริ่มต้น 7/);
});

test("supported keys pass through untouched", () => {
  const src = { type: "string", enum: ["a", "b"], format: "date", nullable: true, description: "d" };
  assert.deepEqual(geminiFlavor(src), src);
});

test("non-schema wrappers keep their own keys", () => {
  // `paths`, `info`, `servers` etc. are not schemas and must not be filtered
  const doc = { info: { title: "x", version: "1" }, paths: { "/a": { get: { operationId: "getA" } } } };
  assert.deepEqual(geminiFlavor(doc), doc);
});
