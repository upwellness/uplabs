/**
 * Google Health API (v4) — the replacement for Google Fit's REST API, which Google
 * switches off at the end of 2026 (no new Fit sign-ups since 1 May 2024).
 *
 * What it gives us: the Google-account cloud store fed by Fitbit devices and Pixel
 * Watch. What it does NOT give us: Health Connect data that lives on the phone
 * (Samsung Health, Garmin via Health Connect, …) — that needs an installed Android
 * app and is out of scope for a web platform; those users upload an export instead.
 *
 * Setup (Google Cloud Console, same project + OAuth client as Google Fit):
 *   1. APIs & Services → enable "Google Health API"
 *   2. OAuth consent screen → add the three scopes below (restricted scopes: ≤100
 *      users in Testing; refresh tokens expire after 7 days until the app is verified)
 *   3. Env: GOOGLE_FIT_CLIENT_ID · GOOGLE_FIT_CLIENT_SECRET (unchanged) · NEXT_PUBLIC_SITE_URL
 *
 * Docs: https://developers.google.com/health/setup · /health/endpoints · /health/data-types
 */
import { exchangeCode, refreshAccessToken, redirectUri } from "./google-fit";
import { parseDailyRollup, parseDataPoints, mergeSleepByDay, rollupBody, listFilter, type ReadingRow } from "./google-health-parse";

export { exchangeCode, refreshAccessToken };

export const GOOGLE_HEALTH_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",   // steps · active minutes
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",                  // sleep sessions
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly", // resting HR · HRV
];

const BASE = "https://health.googleapis.com/v4/users/me/dataTypes";

export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_FIT_CLIENT_ID!, redirect_uri: redirectUri(), response_type: "code",
    scope: GOOGLE_HEALTH_SCOPES.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function call(accessToken: string, path: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE}/${path}`, { ...init, headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", ...(init.headers ?? {}) }, cache: "no-store" });
  if (!res.ok) throw new Error(`Google Health ${path}: ${res.status} ${(await res.text()).replace(/\s+/g, " ").slice(0, 1200)}`);
  return res.json();
}

const BKK = 7 * 3_600_000;
const bkkDate = (ms: number) => new Date(ms + BKK).toISOString().slice(0, 10);

/**
 * Last N civil days of steps, active minutes, resting HR, HRV and sleep. Each data type
 * is fetched independently — a scope the user declined or a type their device lacks
 * must not take the others down with it.
 */
export async function fetchWindow(accessToken: string, days = 14): Promise<{ rows: ReadingRow[]; errors: string[] }> {
  const to = bkkDate(Date.now() + 864e5); const from = bkkDate(Date.now() - (days - 1) * 864e5);
  const rows: ReadingRow[] = []; const errors: string[] = [];
  const attempt = async (label: string, fn: () => Promise<ReadingRow[]>) => { try { rows.push(...(await fn())); } catch (e: any) { errors.push(`${label}: ${e?.message ?? e}`); } };

  await attempt("steps", async () => parseDailyRollup(await call(accessToken, "steps/dataPoints:dailyRollUp", { method: "POST", body: JSON.stringify(rollupBody(from, to)) }), "steps"));
  await attempt("active-minutes", async () => parseDailyRollup(await call(accessToken, "active-minutes/dataPoints:dailyRollUp", { method: "POST", body: JSON.stringify(rollupBody(from, to)) }), "active_minutes"));
  for (const kind of ["daily-resting-heart-rate", "daily-heart-rate-variability", "sleep"] as const) {
    await attempt(kind, async () => {
      const q = new URLSearchParams({ filter: listFilter(kind, from), pageSize: kind === "sleep" ? "25" : "400" });
      let out: ReadingRow[] = []; let token: string | undefined; let pages = 0;
      do {
        if (token) q.set("pageToken", token);
        const json: any = await call(accessToken, `${kind}/dataPoints?${q}`, { method: "GET" });
        const parsed = parseDataPoints(json, kind);
        const got = Array.isArray(json?.dataPoints) ? json.dataPoints.length : 0;
        if (got && !parsed.length) errors.push(`${kind}: ได้ ${got} จุดแต่อ่านค่าไม่ได้ — sample ${JSON.stringify(json.dataPoints[0]).slice(0, 400)}`);
        out = out.concat(parsed);
        token = json?.nextPageToken; pages++;
      } while (token && pages < 10);
      return out;
    });
  }
  return { rows: mergeSleepByDay(rows), errors };
}
