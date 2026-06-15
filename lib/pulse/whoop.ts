/**
 * WHOOP integration — CSV import (all 4 exports) + OAuth 2.0.
 *
 * WHOOP "my_whoop_data.zip" export contains 4 CSVs — we capture EVERY field:
 *   physiological_cycles.csv → parseCycles  → whoop_daily
 *   sleeps.csv               → parseSleeps  → whoop_sleeps
 *   workouts.csv             → parseWorkouts→ whoop_workouts
 *   journal_entries.csv      → parseJournal → whoop_journal
 *
 * OAuth setup (one-time):
 *   1. developer.whoop.com → create app
 *   2. Redirect URI = {SITE}/api/pulse/whoop/oauth/callback
 *   3. Scopes: read:recovery read:cycles read:sleep read:workout read:profile offline
 *   4. Env: WHOOP_CLIENT_ID · WHOOP_CLIENT_SECRET · NEXT_PUBLIC_SITE_URL
 */

/* ───────────────────────── CSV PRIMITIVES ───────────────────────── */

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
const num = (v?: string): number | null => {
  if (v == null) return null;
  const s = v.trim(); if (!s) return null;
  const n = Number(s); return Number.isFinite(n) ? n : null;
};
const int = (v?: string): number | null => { const n = num(v); return n == null ? null : Math.round(n); };
const ts = (v?: string): string | null => {
  if (!v) return null;
  const s = v.trim(); if (!s) return null;
  // "2026-06-14 22:19:38" → ISO; leave timezone offset handling to DB
  return s.replace(" ", "T");
};
const dateOf = (v?: string): string | null => {
  if (!v) return null;
  const d = v.trim().split(" ")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
};
const yes = (v?: string): boolean | null => {
  if (v == null) return null;
  const s = v.trim().toLowerCase();
  if (s === "true" || s === "yes" || s === "1") return true;
  if (s === "false" || s === "no" || s === "0") return false;
  return null;
};

/** Build a header→index resolver (case-insensitive contains match). */
function headerIndex(headerLine: string) {
  const header = splitCsvLine(headerLine).map((h) => h.trim().toLowerCase());
  return (needle: string) => header.findIndex((h) => h.includes(needle));
}

/* ───────────────────────── TYPES ───────────────────────── */

export interface WhoopDaily {
  cycle_date: string;
  cycle_start: string | null; cycle_end: string | null; timezone: string | null;
  recovery: number | null; rhr: number | null; hrv: number | null; spo2: number | null; skin_temp: number | null;
  strain: number | null; energy_burned: number | null; max_hr: number | null; avg_hr: number | null;
  sleep_onset: string | null; wake_onset: string | null;
  sleep_perf: number | null; resp_rate: number | null;
  asleep_min: number | null; in_bed_min: number | null; light_min: number | null; deep_min: number | null;
  rem_min: number | null; awake_min: number | null; sleep_need_min: number | null;
  sleep_debt: number | null; sleep_eff: number | null; sleep_consistency: number | null;
}
export interface WhoopSleep {
  cycle_start: string | null; cycle_end: string | null; timezone: string | null;
  sleep_onset: string; wake_onset: string | null; is_nap: boolean;
  sleep_perf: number | null; resp_rate: number | null;
  asleep_min: number | null; in_bed_min: number | null; light_min: number | null; deep_min: number | null;
  rem_min: number | null; awake_min: number | null; sleep_need_min: number | null;
  sleep_debt: number | null; sleep_eff: number | null; sleep_consistency: number | null;
}
export interface WhoopWorkout {
  cycle_start: string | null; timezone: string | null;
  workout_start: string; workout_end: string | null; duration_min: number | null;
  activity_name: string | null; activity_strain: number | null; energy_burned: number | null;
  max_hr: number | null; avg_hr: number | null;
  hr_zone1_pct: number | null; hr_zone2_pct: number | null; hr_zone3_pct: number | null;
  hr_zone4_pct: number | null; hr_zone5_pct: number | null; gps_enabled: boolean | null;
}
export interface WhoopJournal {
  cycle_start: string | null; cycle_date: string | null; timezone: string | null;
  question_text: string; answered_yes: boolean | null; notes: string | null;
}

export interface WhoopParsed {
  daily: WhoopDaily[];
  sleeps: WhoopSleep[];
  workouts: WhoopWorkout[];
  journal: WhoopJournal[];
}

/* ───────────────────────── PARSERS ───────────────────────── */

function rows(text: string): { lines: string[] } {
  return { lines: text.split(/\r?\n/).filter((l) => l.trim().length > 0) };
}

export function parseCycles(text: string): WhoopDaily[] {
  const { lines } = rows(text);
  if (lines.length < 2) return [];
  const idx = headerIndex(lines[0]);
  const c = {
    start: idx("cycle start time"), end: idx("cycle end time"), tz: idx("cycle timezone"),
    rec: idx("recovery score"), rhr: idx("resting heart rate"), hrv: idx("heart rate variability"),
    skin: idx("skin temp"), spo2: idx("blood oxygen"), strain: idx("day strain"), energy: idx("energy burned"),
    maxhr: idx("max hr"), avghr: idx("average hr"), sOnset: idx("sleep onset"), wOnset: idx("wake onset"),
    perf: idx("sleep performance"), resp: idx("respiratory rate"), asleep: idx("asleep duration"),
    inbed: idx("in bed duration"), light: idx("light sleep duration"), deep: idx("deep (sws) duration"),
    rem: idx("rem duration"), awake: idx("awake duration"), need: idx("sleep need"), debt: idx("sleep debt"),
    eff: idx("sleep efficiency"), cons: idx("sleep consistency"),
  };
  if (c.start < 0) throw new Error("physiological_cycles.csv: missing 'Cycle start time'");
  const at = (a: string[], i: number) => (i >= 0 ? a[i] : undefined);
  const out: WhoopDaily[] = [];
  for (let i = 1; i < lines.length; i++) {
    const a = splitCsvLine(lines[i]);
    const d = dateOf(at(a, c.start)); if (!d) continue;
    out.push({
      cycle_date: d, cycle_start: ts(at(a, c.start)), cycle_end: ts(at(a, c.end)), timezone: at(a, c.tz)?.trim() || null,
      recovery: num(at(a, c.rec)), rhr: num(at(a, c.rhr)), hrv: num(at(a, c.hrv)), spo2: num(at(a, c.spo2)),
      skin_temp: num(at(a, c.skin)), strain: num(at(a, c.strain)), energy_burned: num(at(a, c.energy)),
      max_hr: num(at(a, c.maxhr)), avg_hr: num(at(a, c.avghr)), sleep_onset: ts(at(a, c.sOnset)), wake_onset: ts(at(a, c.wOnset)),
      sleep_perf: num(at(a, c.perf)), resp_rate: num(at(a, c.resp)), asleep_min: int(at(a, c.asleep)),
      in_bed_min: int(at(a, c.inbed)), light_min: int(at(a, c.light)), deep_min: int(at(a, c.deep)),
      rem_min: int(at(a, c.rem)), awake_min: int(at(a, c.awake)), sleep_need_min: int(at(a, c.need)),
      sleep_debt: num(at(a, c.debt)), sleep_eff: num(at(a, c.eff)), sleep_consistency: num(at(a, c.cons)),
    });
  }
  // Dedup by date → keep the row with most sleep (main night, not nap)
  const byDate = new Map<string, WhoopDaily>();
  for (const r of out) {
    const ex = byDate.get(r.cycle_date);
    if (!ex || (r.asleep_min ?? 0) > (ex.asleep_min ?? 0)) byDate.set(r.cycle_date, r);
  }
  return [...byDate.values()].sort((a, b) => a.cycle_date.localeCompare(b.cycle_date));
}

export function parseSleeps(text: string): WhoopSleep[] {
  const { lines } = rows(text);
  if (lines.length < 2) return [];
  const idx = headerIndex(lines[0]);
  const c = {
    start: idx("cycle start time"), end: idx("cycle end time"), tz: idx("cycle timezone"),
    sOnset: idx("sleep onset"), wOnset: idx("wake onset"), perf: idx("sleep performance"), resp: idx("respiratory rate"),
    asleep: idx("asleep duration"), inbed: idx("in bed duration"), light: idx("light sleep duration"),
    deep: idx("deep (sws) duration"), rem: idx("rem duration"), awake: idx("awake duration"), need: idx("sleep need"),
    debt: idx("sleep debt"), eff: idx("sleep efficiency"), cons: idx("sleep consistency"), nap: idx("nap"),
  };
  if (c.sOnset < 0) throw new Error("sleeps.csv: missing 'Sleep onset'");
  const at = (a: string[], i: number) => (i >= 0 ? a[i] : undefined);
  const out: WhoopSleep[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const a = splitCsvLine(lines[i]);
    const onset = ts(at(a, c.sOnset)); if (!onset || seen.has(onset)) continue;
    seen.add(onset);
    out.push({
      cycle_start: ts(at(a, c.start)), cycle_end: ts(at(a, c.end)), timezone: at(a, c.tz)?.trim() || null,
      sleep_onset: onset, wake_onset: ts(at(a, c.wOnset)), is_nap: yes(at(a, c.nap)) ?? false,
      sleep_perf: num(at(a, c.perf)), resp_rate: num(at(a, c.resp)), asleep_min: int(at(a, c.asleep)),
      in_bed_min: int(at(a, c.inbed)), light_min: int(at(a, c.light)), deep_min: int(at(a, c.deep)),
      rem_min: int(at(a, c.rem)), awake_min: int(at(a, c.awake)), sleep_need_min: int(at(a, c.need)),
      sleep_debt: num(at(a, c.debt)), sleep_eff: num(at(a, c.eff)), sleep_consistency: num(at(a, c.cons)),
    });
  }
  return out;
}

export function parseWorkouts(text: string): WhoopWorkout[] {
  const { lines } = rows(text);
  if (lines.length < 2) return [];
  const idx = headerIndex(lines[0]);
  const c = {
    start: idx("cycle start time"), tz: idx("cycle timezone"), wStart: idx("workout start time"),
    wEnd: idx("workout end time"), dur: idx("duration (min)"), name: idx("activity name"),
    strain: idx("activity strain"), energy: idx("energy burned"), maxhr: idx("max hr"), avghr: idx("average hr"),
    z1: idx("hr zone 1"), z2: idx("hr zone 2"), z3: idx("hr zone 3"), z4: idx("hr zone 4"), z5: idx("hr zone 5"),
    gps: idx("gps enabled"),
  };
  if (c.wStart < 0) throw new Error("workouts.csv: missing 'Workout start time'");
  const at = (a: string[], i: number) => (i >= 0 ? a[i] : undefined);
  const out: WhoopWorkout[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const a = splitCsvLine(lines[i]);
    const ws = ts(at(a, c.wStart)); if (!ws || seen.has(ws)) continue;
    seen.add(ws);
    out.push({
      cycle_start: ts(at(a, c.start)), timezone: at(a, c.tz)?.trim() || null,
      workout_start: ws, workout_end: ts(at(a, c.wEnd)), duration_min: num(at(a, c.dur)),
      activity_name: at(a, c.name)?.trim() || null, activity_strain: num(at(a, c.strain)),
      energy_burned: num(at(a, c.energy)), max_hr: num(at(a, c.maxhr)), avg_hr: num(at(a, c.avghr)),
      hr_zone1_pct: num(at(a, c.z1)), hr_zone2_pct: num(at(a, c.z2)), hr_zone3_pct: num(at(a, c.z3)),
      hr_zone4_pct: num(at(a, c.z4)), hr_zone5_pct: num(at(a, c.z5)), gps_enabled: yes(at(a, c.gps)),
    });
  }
  return out;
}

export function parseJournal(text: string): WhoopJournal[] {
  const { lines } = rows(text);
  if (lines.length < 2) return [];
  const idx = headerIndex(lines[0]);
  const c = {
    start: idx("cycle start time"), tz: idx("cycle timezone"),
    q: idx("question text"), ans: idx("answered yes"), notes: idx("notes"),
  };
  if (c.q < 0) throw new Error("journal_entries.csv: missing 'Question text'");
  const at = (a: string[], i: number) => (i >= 0 ? a[i] : undefined);
  const out: WhoopJournal[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const a = splitCsvLine(lines[i]);
    const q = at(a, c.q)?.trim(); const cs = ts(at(a, c.start));
    if (!q || !cs) continue;
    const key = cs + "|" + q; if (seen.has(key)) continue; seen.add(key);
    out.push({
      cycle_start: cs, cycle_date: dateOf(at(a, c.start)), timezone: at(a, c.tz)?.trim() || null,
      question_text: q, answered_yes: yes(at(a, c.ans)), notes: at(a, c.notes)?.trim() || null,
    });
  }
  return out;
}

/**
 * Auto-detect which WHOOP CSV this is by its header and parse accordingly.
 * Returns a partial WhoopParsed with only the detected file populated.
 */
export function parseWhoopCsvAuto(text: string): Partial<WhoopParsed> & { kind: string } {
  const first = (text.split(/\r?\n/)[0] ?? "").toLowerCase();
  if (first.includes("question text"))   return { kind: "journal",  journal: parseJournal(text) };
  if (first.includes("workout start"))   return { kind: "workouts", workouts: parseWorkouts(text) };
  if (first.includes("nap"))             return { kind: "sleeps",   sleeps: parseSleeps(text) };
  if (first.includes("recovery score") || first.includes("day strain"))
    return { kind: "cycles", daily: parseCycles(text) };
  throw new Error("Unrecognized WHOOP CSV header");
}

/* ───────────────────────── OAUTH ───────────────────────── */

export const WHOOP_SCOPES = ["read:recovery","read:cycles","read:sleep","read:workout","read:profile","offline"];
const WHOOP_AUTH  = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_API   = "https://api.prod.whoop.com/developer";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const whoopRedirectUri = () => `${siteUrl()}/api/pulse/whoop/oauth/callback`;

export function whoopAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID ?? "", redirect_uri: whoopRedirectUri(),
    response_type: "code", scope: WHOOP_SCOPES.join(" "), state,
  });
  return `${WHOOP_AUTH}?${params}`;
}

interface WhoopToken { access_token: string; refresh_token?: string; expires_in: number; scope: string; token_type: string; }

export async function whoopExchangeCode(code: string): Promise<WhoopToken> {
  const res = await fetch(WHOOP_TOKEN, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code,
      client_id: process.env.WHOOP_CLIENT_ID ?? "", client_secret: process.env.WHOOP_CLIENT_SECRET ?? "",
      redirect_uri: whoopRedirectUri(),
    }),
  });
  if (!res.ok) throw new Error(`WHOOP token exchange failed: ${await res.text()}`);
  return res.json();
}

export async function whoopRefresh(refreshToken: string): Promise<WhoopToken> {
  const res = await fetch(WHOOP_TOKEN, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token", refresh_token: refreshToken,
      client_id: process.env.WHOOP_CLIENT_ID ?? "", client_secret: process.env.WHOOP_CLIENT_SECRET ?? "", scope: "offline",
    }),
  });
  if (!res.ok) throw new Error(`WHOOP token refresh failed: ${await res.text()}`);
  return res.json();
}

/**
 * Fetch recent recovery + cycle + sleep + workout from the WHOOP API,
 * folding into the same WhoopParsed shape as the CSV path.
 */
export async function whoopFetchRecent(accessToken: string, days = 30): Promise<WhoopParsed> {
  const start = new Date(Date.now() - days * 86_400_000).toISOString();
  const h = { Authorization: `Bearer ${accessToken}` };
  const dayOf = (iso: string) => (iso ? iso.split("T")[0] : "");
  const byDate = new Map<string, WhoopDaily>();
  const sleeps: WhoopSleep[] = [];
  const workouts: WhoopWorkout[] = [];

  const blank = (d: string): WhoopDaily => ({
    cycle_date: d, cycle_start: null, cycle_end: null, timezone: null,
    recovery: null, rhr: null, hrv: null, spo2: null, skin_temp: null, strain: null, energy_burned: null,
    max_hr: null, avg_hr: null, sleep_onset: null, wake_onset: null, sleep_perf: null, resp_rate: null,
    asleep_min: null, in_bed_min: null, light_min: null, deep_min: null, rem_min: null, awake_min: null,
    sleep_need_min: null, sleep_debt: null, sleep_eff: null, sleep_consistency: null,
  });
  const ensure = (d: string) => { if (!byDate.has(d)) byDate.set(d, blank(d)); return byDate.get(d)!; };

  try {
    const r = await fetch(`${WHOOP_API}/v1/recovery?start=${start}&limit=25`, { headers: h });
    if (r.ok) for (const rec of (await r.json()).records ?? []) {
      const d = dayOf(rec.created_at ?? rec.updated_at ?? ""); if (!d) continue;
      const s = rec.score ?? {}, row = ensure(d);
      if (s.recovery_score != null) row.recovery = s.recovery_score;
      if (s.hrv_rmssd_milli != null) row.hrv = +Number(s.hrv_rmssd_milli).toFixed(0);
      if (s.resting_heart_rate != null) row.rhr = s.resting_heart_rate;
      if (s.spo2_percentage != null) row.spo2 = +Number(s.spo2_percentage).toFixed(1);
      if (s.skin_temp_celsius != null) row.skin_temp = +Number(s.skin_temp_celsius).toFixed(1);
    }
  } catch { /* best effort */ }

  try {
    const r = await fetch(`${WHOOP_API}/v1/cycle?start=${start}&limit=25`, { headers: h });
    if (r.ok) for (const cyc of (await r.json()).records ?? []) {
      const d = dayOf(cyc.start ?? cyc.created_at ?? ""); if (!d) continue;
      const s = cyc.score ?? {}, row = ensure(d);
      if (s.strain != null) row.strain = +Number(s.strain).toFixed(1);
      if (s.kilojoule != null) row.energy_burned = +(Number(s.kilojoule) / 4.184).toFixed(0);
      if (s.average_heart_rate != null) row.avg_hr = s.average_heart_rate;
      if (s.max_heart_rate != null) row.max_hr = s.max_heart_rate;
      row.cycle_start = cyc.start ?? null; row.cycle_end = cyc.end ?? null; row.timezone = cyc.timezone_offset ?? null;
    }
  } catch { /* best effort */ }

  try {
    const r = await fetch(`${WHOOP_API}/v1/activity/sleep?start=${start}&limit=25`, { headers: h });
    if (r.ok) for (const sl of (await r.json()).records ?? []) {
      const d = dayOf(sl.start ?? sl.created_at ?? ""); if (!d) continue;
      const s = sl.score ?? {}, st = s.stage_summary ?? {}, row = ensure(d);
      const lm = st.total_light_sleep_time_milli != null ? Math.round(st.total_light_sleep_time_milli / 60000) : null;
      const dm = st.total_slow_wave_sleep_time_milli != null ? Math.round(st.total_slow_wave_sleep_time_milli / 60000) : null;
      const rm = st.total_rem_sleep_time_milli != null ? Math.round(st.total_rem_sleep_time_milli / 60000) : null;
      const am = st.total_awake_time_milli != null ? Math.round(st.total_awake_time_milli / 60000) : null;
      const ib = st.total_in_bed_time_milli != null ? Math.round(st.total_in_bed_time_milli / 60000) : null;
      const asleep = (lm ?? 0) + (dm ?? 0) + (rm ?? 0);
      if (s.sleep_performance_percentage != null) row.sleep_perf = +Number(s.sleep_performance_percentage).toFixed(0);
      if (s.respiratory_rate != null) row.resp_rate = +Number(s.respiratory_rate).toFixed(1);
      row.light_min = lm; row.deep_min = dm; row.rem_min = rm; row.awake_min = am; row.in_bed_min = ib;
      if (asleep > 0) row.asleep_min = asleep;
      row.sleep_onset = sl.start ?? null; row.wake_onset = sl.end ?? null;
      sleeps.push({
        cycle_start: sl.start ?? null, cycle_end: sl.end ?? null, timezone: sl.timezone_offset ?? null,
        sleep_onset: sl.start, wake_onset: sl.end ?? null, is_nap: !!sl.nap,
        sleep_perf: row.sleep_perf, resp_rate: row.resp_rate, asleep_min: asleep || null,
        in_bed_min: ib, light_min: lm, deep_min: dm, rem_min: rm, awake_min: am,
        sleep_need_min: null, sleep_debt: null, sleep_eff: s.sleep_efficiency_percentage ?? null, sleep_consistency: s.sleep_consistency_percentage ?? null,
      });
    }
  } catch { /* best effort */ }

  try {
    const r = await fetch(`${WHOOP_API}/v1/activity/workout?start=${start}&limit=25`, { headers: h });
    if (r.ok) for (const w of (await r.json()).records ?? []) {
      const s = w.score ?? {}, z = s.zone_duration ?? {};
      const durMin = w.start && w.end ? Math.round((Date.parse(w.end) - Date.parse(w.start)) / 60000) : null;
      const zoneTot = Object.values(z).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number;
      const pct = (ms: any) => (zoneTot > 0 && ms != null ? +(Number(ms) / zoneTot * 100).toFixed(0) : null);
      workouts.push({
        cycle_start: null, timezone: w.timezone_offset ?? null, workout_start: w.start, workout_end: w.end ?? null,
        duration_min: durMin, activity_name: w.sport_name ?? String(w.sport_id ?? "Activity"),
        activity_strain: s.strain != null ? +Number(s.strain).toFixed(1) : null,
        energy_burned: s.kilojoule != null ? +(Number(s.kilojoule) / 4.184).toFixed(0) : null,
        max_hr: s.max_heart_rate ?? null, avg_hr: s.average_heart_rate ?? null,
        hr_zone1_pct: pct(z.zone_zero_milli), hr_zone2_pct: pct(z.zone_one_milli), hr_zone3_pct: pct(z.zone_two_milli),
        hr_zone4_pct: pct(z.zone_three_milli), hr_zone5_pct: pct(z.zone_four_milli), gps_enabled: null,
      });
    }
  } catch { /* best effort */ }

  return {
    daily: [...byDate.values()].sort((a, b) => a.cycle_date.localeCompare(b.cycle_date)),
    sleeps, workouts, journal: [],
  };
}
