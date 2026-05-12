/**
 * Google Fit OAuth + data fetch helpers.
 *
 * Setup (one-time):
 *   1. Google Cloud Console → New project
 *   2. Enable "Fitness API"
 *   3. OAuth consent screen (External, scopes below)
 *   4. Create OAuth client (Web) → redirect URI = {SITE}/api/pulse/oauth/callback
 *   5. Env vars: GOOGLE_FIT_CLIENT_ID · GOOGLE_FIT_CLIENT_SECRET · NEXT_PUBLIC_SITE_URL
 */

export const GOOGLE_FIT_SCOPES = [
  "https://www.googleapis.com/auth/fitness.heart_rate.read",
  "https://www.googleapis.com/auth/fitness.sleep.read",
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.body.read",
];

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function redirectUri() {
  return `${siteUrl()}/api/pulse/oauth/callback`;
}

/** Build the Google authorization URL (kicks off OAuth). */
export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_FIT_CLIENT_ID!,
    redirect_uri:  redirectUri(),
    response_type: "code",
    scope:         GOOGLE_FIT_SCOPES.join(" "),
    access_type:   "offline",
    prompt:        "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

interface TokenResponse {
  access_token:  string;
  refresh_token?: string;
  expires_in:    number;
  scope:         string;
  token_type:    string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_FIT_CLIENT_ID!,
      client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET!,
      redirect_uri:  redirectUri(),
      grant_type:    "authorization_code",
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google token exchange failed: ${t}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_FIT_CLIENT_ID!,
      client_secret: process.env.GOOGLE_FIT_CLIENT_SECRET!,
      grant_type:    "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json();
}

/* ──────────────────────────────────────────────────────────────
 * Data fetch: aggregate over last N days for HR, steps, sleep.
 * Uses the dataset:aggregate endpoint (single call returns bucketed data).
 * ────────────────────────────────────────────────────────────── */

interface AggregateRow {
  recorded_at: string;     // ISO
  metric_type: string;
  value: number;
  unit: string;
}

export async function fetch7DaySummary(accessToken: string): Promise<AggregateRow[]> {
  const endMs   = Date.now();
  const startMs = endMs - 7 * 24 * 60 * 60 * 1000;
  const oneDay  = 86_400_000;

  const body = {
    aggregateBy: [
      { dataTypeName: "com.google.heart_rate.bpm" },
      { dataTypeName: "com.google.step_count.delta" },
      { dataTypeName: "com.google.sleep.segment" },
      { dataTypeName: "com.google.active_minutes" },
      { dataTypeName: "com.google.calories.expended" },
      { dataTypeName: "com.google.calories.bmr" },
      { dataTypeName: "com.google.heart_minutes" },
      { dataTypeName: "com.google.weight" },
      { dataTypeName: "com.google.body.fat.percentage" },
      { dataTypeName: "com.google.distance.delta" },
      { dataTypeName: "com.google.power.sample" },
    ],
    bucketByTime: { durationMillis: oneDay },
    startTimeMillis: startMs,
    endTimeMillis: endMs,
  };

  const res = await fetch(
    "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google Fit fetch failed: ${res.status} ${t}`);
  }
  const json = await res.json();

  const out: AggregateRow[] = [];
  // Google Fit returns "bucket" (singular) — not "buckets"
  const buckets = json.bucket ?? json.buckets ?? [];

  for (const bucket of buckets) {
    const ts = new Date(Number(bucket.startTimeMillis)).toISOString();

    for (const ds of bucket.dataset ?? []) {
      const type = (ds.dataSourceId ?? "") as string;

      for (const pt of ds.point ?? []) {
        // ── Heart rate — daily summary [avg, max, min] ──
        if (type.includes("heart_rate")) {
          const avg = pt.value?.[0]?.fpVal;
          const max = pt.value?.[1]?.fpVal;
          const min = pt.value?.[2]?.fpVal;
          if (avg) out.push({ recorded_at: ts, metric_type: "hr_bpm", value: +avg.toFixed(1), unit: "bpm" });
          if (min) out.push({ recorded_at: ts, metric_type: "rhr",    value: +min.toFixed(1), unit: "bpm" });
          if (max) out.push({ recorded_at: ts, metric_type: "hr_max", value: +max.toFixed(1), unit: "bpm" });
        }
        // ── Steps ──
        else if (type.includes("step_count")) {
          const total = pt.value?.[0]?.intVal ?? 0;
          if (total > 0) out.push({ recorded_at: ts, metric_type: "steps", value: total, unit: "count" });
        }
        // ── Sleep segments with stages ──
        else if (type.includes("sleep")) {
          const start = Number(pt.startTimeNanos) / 1e6;
          const end   = Number(pt.endTimeNanos) / 1e6;
          const mins  = Math.round((end - start) / 60_000);
          const stage = pt.value?.[0]?.intVal;
          // Stage codes (per Google Fit): 1=awake, 2=sleep, 3=oob, 4=light, 5=deep, 6=rem
          if (mins > 0) {
            const stageMap: Record<number, string> = {
              2: "sleep_total", 4: "sleep_light", 5: "sleep_deep", 6: "sleep_rem",
            };
            const metric = stageMap[stage as number] ?? "sleep_minutes";
            out.push({
              recorded_at: new Date(start).toISOString(),
              metric_type: metric,
              value: mins,
              unit: "minutes",
            });
          }
        }
        // ── Active minutes ──
        else if (type.includes("active_minutes")) {
          const m = pt.value?.[0]?.intVal ?? 0;
          if (m > 0) out.push({ recorded_at: ts, metric_type: "active_minutes", value: m, unit: "minutes" });
        }
        // ── Calories expended (kcal) ──
        else if (type.includes("calories.expended")) {
          const k = pt.value?.[0]?.fpVal ?? 0;
          if (k > 0) out.push({ recorded_at: ts, metric_type: "calories_expended", value: +k.toFixed(0), unit: "kcal" });
        }
        // ── BMR (kcal/day) ──
        else if (type.includes("calories.bmr")) {
          const k = pt.value?.[0]?.fpVal ?? 0;
          if (k > 0) out.push({ recorded_at: ts, metric_type: "bmr", value: +k.toFixed(0), unit: "kcal" });
        }
        // ── Heart minutes (intensity points) ──
        else if (type.includes("heart_minutes")) {
          const m = pt.value?.[0]?.fpVal ?? 0;
          if (m > 0) out.push({ recorded_at: ts, metric_type: "heart_minutes", value: +m.toFixed(1), unit: "minutes" });
        }
        // ── Weight (kg) ──
        else if (type.includes(":weight") || type.endsWith("weight")) {
          const w = pt.value?.[0]?.fpVal;
          if (w) out.push({ recorded_at: ts, metric_type: "weight", value: +w.toFixed(2), unit: "kg" });
        }
        // ── Body fat % ──
        else if (type.includes("body.fat")) {
          const f = pt.value?.[0]?.fpVal;
          if (f) out.push({ recorded_at: ts, metric_type: "body_fat_pct", value: +f.toFixed(1), unit: "%" });
        }
        // ── Distance (meters → km) ──
        else if (type.includes("distance")) {
          const d = pt.value?.[0]?.fpVal ?? 0;
          if (d > 0) out.push({ recorded_at: ts, metric_type: "distance_km", value: +(d / 1000).toFixed(2), unit: "km" });
        }
      }
    }
  }
  return out;
}
