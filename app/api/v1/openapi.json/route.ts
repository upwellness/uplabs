import { NextResponse } from "next/server";
import { buildSpec, geminiFlavor } from "@/lib/api/openapi-spec";
import { SCOPES } from "@/lib/api/scopes";
import { INTENT_NAMES } from "@/lib/api/resolver";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/openapi.json — the schema ChatGPT Actions (or n8n) imports.
 *
 * Public on purpose: it is a description of the interface, not of anyone's data, and
 * every path behind it still demands a token. Making the schema itself token-gated
 * would break the one-click import that is the whole point of publishing it.
 *
 * Descriptions here are written for a model to read. They say when to reach for each
 * path, because that is what the caller's LLM uses to route a question.
 */
export async function GET(req: Request) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, "");
  const spec = buildSpec(base, { scopes: SCOPES, intentNames: INTENT_NAMES });
  // ?flavor=gemini — Gemini's function-calling schema accepts only a subset of
  // OpenAPI (type, nullable, required, format, description, properties, items, enum).
  // Feeding it our full spec risks a rejected tool definition, so this strips the
  // unsupported keys and folds what they said into the description instead — the
  // model still learns the default and the ceiling, just as prose it can read.
  const flavor = new URL(req.url).searchParams.get("flavor");
  const body = flavor === "gemini" ? geminiFlavor(spec) : spec;

  return NextResponse.json(body, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
