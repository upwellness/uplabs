/**
 * One place that actually talks to generateContent.
 *
 * ⚠️ HISTORY (24 ก.ค. 2026): every text feature sent
 * `generationConfig.thinkingConfig.thinkingBudget = 0` to switch thinking off on
 * gemini-2.5-flash. After the move to the current flash model that field is no
 * longer the right knob (Gemini 3 uses `thinkingLevel`; "minimal" does not even
 * guarantee thinking is off), and the request came back 400 INVALID_ARGUMENT —
 * which the UI then mislabelled as "คีย์ผิด". Plate Planner kept working purely
 * because it never sent the field.
 *
 * So: send `thinkingLevel: "minimal"` (keeps latency down — these routes run
 * under Vercel time limits), and if the model rejects the thinking config at all,
 * retry once without it instead of failing the user's request.
 */

import { classifyGeminiFetchError } from "@/lib/gemini-error";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Keeps answers fast; override per-env if a model ever needs a different level. */
export const GEMINI_THINKING_LEVEL = process.env.GEMINI_THINKING_LEVEL ?? "minimal";

type GenBody = Record<string, any>;

function withThinking(body: GenBody): GenBody {
  const generationConfig = { ...(body.generationConfig ?? {}) };
  // never send both knobs — the API 400s on that
  delete generationConfig.thinkingConfig;
  if (GEMINI_THINKING_LEVEL) {
    generationConfig.thinkingConfig = { thinkingLevel: GEMINI_THINKING_LEVEL };
  }
  return { ...body, generationConfig };
}

function withoutThinking(body: GenBody): GenBody {
  const generationConfig = { ...(body.generationConfig ?? {}) };
  delete generationConfig.thinkingConfig;
  return { ...body, generationConfig };
}

async function post(model: string, apiKey: string, body: GenBody) {
  return fetch(`${ENDPOINT}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * POST generateContent and return the parsed JSON response.
 * Throws an Error whose message is either a sentinel (key problems) or a plain
 * Thai explanation — see `lib/gemini-error.ts`.
 */
export async function geminiGenerate(model: string, apiKey: string, body: GenBody): Promise<any> {
  if (!apiKey) throw new Error("กรุณาใส่ API Key");

  let res = await post(model, apiKey, withThinking(body));

  if (!res.ok) {
    const text = await res.text();
    // Model doesn't accept our thinking config → drop it and try once more.
    if (res.status === 400 && /thinking/i.test(text)) {
      res = await post(model, apiKey, withoutThinking(body));
      if (!res.ok) throw new Error(classifyGeminiFetchError(res.status, await res.text()));
    } else {
      throw new Error(classifyGeminiFetchError(res.status, text));
    }
  }

  return res.json();
}
