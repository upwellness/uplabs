/**
 * Shared helpers for turning Gemini "bad API key" failures into friendly guidance
 * (go get a free key at AI Studio) instead of raw technical errors.
 * Used by every BYO-key AI feature: CheckForm · NutriScan · Plate Planner.
 */

/** Sentinel: key is wrong/expired/revoked/missing → user needs a NEW key. */
export const GEMINI_KEY_SENTINEL = "GEMINI_KEY_INVALID";

/**
 * Sentinel: key is VALID but has no permission (403) — the Generative Language API
 * isn't enabled on its Google Cloud project, or the key carries restrictions.
 * Getting yet another key from the same project will NOT fix it, so this must
 * never be shown as "คีย์ผิด".
 */
export const GEMINI_FORBIDDEN_SENTINEL = "GEMINI_KEY_FORBIDDEN";

/** Where users get a free key. */
export const AI_STUDIO_URL = "https://aistudio.google.com/apikey";
/** Where users enable the API for an existing project. */
export const ENABLE_API_URL = "https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview";

/** True when the failure is 403 = valid key without permission (API disabled / key restricted). */
export function isGeminiForbidden(msg?: string | null): boolean {
  const s = (msg || "").toLowerCase();
  return (
    s.includes("gemini_key_forbidden") ||
    s.includes("permission_denied") ||
    s.includes("service_disabled") ||
    s.includes("api_key_service_blocked") ||
    s.includes("has not been used in project") ||
    s.includes("requests from referer")
    // NOTE: never match a bare "forbidden" — our own RBAC returns that for
    // customer-access denials, which has nothing to do with the AI key.
  );
}

/** True when an error message is about the Gemini API key (any BYO-key feature). */
export function isGeminiKeyError(msg?: string | null): boolean {
  const s = (msg || "").toLowerCase();
  return (
    isGeminiForbidden(s) ||
    s.includes("gemini_key_invalid") ||
    s.includes("api key not valid") ||
    s.includes("api_key_invalid") ||
    s.includes("invalid_argument") ||
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
  // 403 = key exists but is not allowed (API not enabled on its project / key restricted).
  if (status === 403) return GEMINI_FORBIDDEN_SENTINEL;
  if (status === 400 && /api[_ ]?key|API_KEY_INVALID|INVALID_ARGUMENT/i.test(bodyText)) {
    return GEMINI_KEY_SENTINEL;
  }
  return `Gemini fetch failed: ${status} ${(bodyText || "").slice(0, 200)}`;
}
