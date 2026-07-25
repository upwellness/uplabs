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
  // 404 = the model id is gone (Google retires versions — e.g. gemini-2.5-flash on 9 ก.ค. 2026).
  // Nothing the user can do in-app; say so plainly instead of dumping Google's JSON.
  if (status === 404) {
    return "โมเดล AI ที่ระบบตั้งไว้ถูกปลดระวางแล้ว — ทีมงานต้องอัปเดตค่า GEMINI_MODEL เป็นรุ่นปัจจุบัน (ดู ai.google.dev/gemini-api/docs/models) · ไม่เกี่ยวกับคีย์ของคุณ";
  }
  // 400 = bad key ONLY when Google actually says so. `INVALID_ARGUMENT` on its own is
  // Google's generic "malformed request" (a rejected generationConfig field, for
  // instance) — treating it as a key problem sent ต้น chasing new keys for a bug in
  // our own request body.
  if (status === 400 && /api[_ ]?key|API_KEY_INVALID/i.test(bodyText)) {
    return GEMINI_KEY_SENTINEL;
  }
  // Anything else: say it's on our side, and keep Google's reason for the log/screenshot.
  const reason = (() => {
    try {
      return JSON.parse(bodyText)?.error?.message ?? bodyText;
    } catch {
      return bodyText;
    }
  })();
  return `เรียก AI ไม่สำเร็จ (${status}) — ไม่ใช่ปัญหาคีย์ของคุณ · รายละเอียด: ${String(reason).slice(0, 180)}`;
}
