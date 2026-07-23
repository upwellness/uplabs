/**
 * Shared helpers for turning Gemini "bad API key" failures into friendly guidance
 * (go get a free key at AI Studio) instead of raw technical errors.
 * Used by every BYO-key AI feature: CheckForm · NutriScan · Plate Planner.
 */

/** Sentinel thrown by server libs/routes for key problems (bad/expired/revoked/missing/restricted). */
export const GEMINI_KEY_SENTINEL = "GEMINI_KEY_INVALID";

/** Where users get a free key. */
export const AI_STUDIO_URL = "https://aistudio.google.com/apikey";

/** True when an error message is about the Gemini API key (any BYO-key feature). */
export function isGeminiKeyError(msg?: string | null): boolean {
  const s = (msg || "").toLowerCase();
  return (
    s.includes("gemini_key_invalid") ||
    s.includes("api key not valid") ||
    s.includes("api_key_invalid") ||
    s.includes("invalid_argument") ||
    s.includes("permission_denied") ||
    s.includes("api key expired") ||
    s.includes("กรุณาใส่ api key") ||
    s.includes("กรุณาใส่ apikey")
  );
}

/**
 * Server-side: given a failed Gemini fetch (HTTP status + body text), return the clean
 * sentinel for key/permission problems, else a compact generic message. Keeping the raw
 * Google JSON out of the UI.
 */
export function classifyGeminiFetchError(status: number, bodyText: string): string {
  if ((status === 400 && /api[_ ]?key|API_KEY_INVALID|INVALID_ARGUMENT/i.test(bodyText)) || status === 403) {
    return GEMINI_KEY_SENTINEL;
  }
  return `Gemini fetch failed: ${status} ${(bodyText || "").slice(0, 200)}`;
}
