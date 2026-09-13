/**
 * CORS for the External API (/api/v1) — lets a browser-side tool call it with a Bearer
 * token. The token is still the only credential; CORS only decides whether the browser
 * is allowed to read the answer. Allowlist = our own tools (UP CGM Analyser) plus
 * whatever `API_CORS_ORIGINS` names (comma-separated origins). Pure; tested.
 */
export const DEFAULT_CORS_ORIGINS = ["https://upcgm.vercel.app"];

export function allowedOrigins(env: string | undefined = process.env.API_CORS_ORIGINS, dev = process.env.NODE_ENV !== "production"): string[] {
  const extra = (env ?? "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
  const local = dev ? ["http://localhost:4321", "http://localhost:3000"] : [];
  return [...new Set([...DEFAULT_CORS_ORIGINS, ...extra, ...local])];
}

/** Headers to add when `origin` is allowed; null when it is not (no CORS headers → browser blocks). */
export function corsHeaders(origin: string | null, allow: string[] = allowedOrigins()): Record<string, string> | null {
  if (!origin || !allow.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}
