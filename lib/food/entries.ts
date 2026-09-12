/**
 * Food log — the decisions, with no I/O (SPEC-Health-Design.md §3.2).
 *
 * Three ways a meal reaches the log: a photo taken now, a typed description, or an
 * old photo logged after the fact. All three end in the same row shape, and two
 * rules hold for all of them:
 *   • every macro number came from an estimate (AI or the person) and a human
 *     confirmed it before it was stored — `confirmed` is not optional;
 *   • the time a meal was eaten is never guessed silently. A photo's EXIF time is a
 *     *suggestion* the person accepts; a bare date means "time unknown" and is stored
 *     at local noon with `time_known: false`.
 *
 * Runs in Node (API, tests) and in the browser (EXIF read before upload).
 */

export const BANGKOK_OFFSET_MIN = 7 * 60;
export type FoodSource = "photo" | "text" | "photo_backfill" | "api";
export type EstimatedBy = "gemini" | "client_ai" | "manual";
export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

/* ── time ───────────────────────────────────────────────────────────────────── */

export interface EatenAt { iso: string; time_known: boolean; date_bkk: string }

const pad = (n: number) => String(n).padStart(2, "0");
const bkkToIso = (y: number, mo: number, d: number, h: number, mi: number, s = 0) =>
  new Date(Date.UTC(y, mo - 1, d, h, mi, s) - BANGKOK_OFFSET_MIN * 60_000).toISOString();
const validYmd = (y: number, mo: number, d: number) => mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100;

/** Bangkok calendar date of an instant. */
export const bangkokDate = (iso: string): string => new Date(Date.parse(iso) + BANGKOK_OFFSET_MIN * 60_000).toISOString().slice(0, 10);

/**
 * Accepts: ISO 8601 with zone · "YYYY-MM-DD HH:MM[:SS]" / "YYYY-MM-DDTHH:MM" (Bangkok
 * wall-clock) · EXIF "YYYY:MM:DD HH:MM:SS" (Bangkok) · "YYYY-MM-DD" (time unknown → 12:00).
 * Refuses anything else and anything in the future beyond `now` + 5 min.
 */
export function parseEatenAt(input: unknown, nowIso: string): EatenAt | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  const now = Date.parse(nowIso);
  let iso: string | null = null, time_known = true;

  let m = s.match(/^(\d{4})[-:](\d{2})[-:](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const [y, mo, d, h, mi, sec] = m.slice(1).map((x) => (x === undefined ? 0 : Number(x)));
    if (!validYmd(y, mo, d) || h > 23 || mi > 59) return null;
    iso = bkkToIso(y, mo, d, h, mi, sec);
  } else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    const [y, mo, d] = m.slice(1).map(Number);
    if (!validYmd(y, mo, d)) return null;
    iso = bkkToIso(y, mo, d, 12, 0); time_known = false;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const t = Date.parse(s); if (Number.isNaN(t)) return null; iso = new Date(t).toISOString();
  } else return null;

  if (Date.parse(iso) > now + 5 * 60_000) return null;
  return { iso, time_known, date_bkk: bangkokDate(iso) };
}

/* ── EXIF ───────────────────────────────────────────────────────────────────── */

/**
 * Read DateTimeOriginal (0x9003) — falling back to DateTimeDigitized (0x9004) and
 * DateTime (0x0132) — from a JPEG's APP1 EXIF segment. Returns the raw
 * "YYYY:MM:DD HH:MM:SS" string, or null when the file has no usable EXIF (PNG, WebP,
 * screenshots, images passed through chat apps that strip metadata).
 *
 * Deliberately small: no dependency, no thumbnails, no GPS.
 */
export function exifDateTime(bytes: Uint8Array): string | null {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null; // not JPEG
  let p = 2;
  while (p + 4 <= bytes.length && bytes[p] === 0xff) {
    const marker = bytes[p + 1];
    if (marker === 0xda || marker === 0xd9) break; // start of scan / end — no more headers
    const len = (bytes[p + 2] << 8) | bytes[p + 3];
    if (len < 2) return null;
    if (marker === 0xe1 && bytes[p + 4] === 0x45 && bytes[p + 5] === 0x78 && bytes[p + 6] === 0x69 && bytes[p + 7] === 0x66) {
      return readTiff(bytes.subarray(p + 10, p + 2 + len));
    }
    p += 2 + len;
  }
  return null;
}

function readTiff(t: Uint8Array): string | null {
  if (t.length < 8) return null;
  const le = t[0] === 0x49 && t[1] === 0x49;
  if (!le && !(t[0] === 0x4d && t[1] === 0x4d)) return null;
  const u16 = (o: number) => (le ? t[o] | (t[o + 1] << 8) : (t[o] << 8) | t[o + 1]);
  const u32 = (o: number) => (le ? (t[o] | (t[o + 1] << 8) | (t[o + 2] << 16) | (t[o + 3] << 24)) >>> 0 : ((t[o] << 24) | (t[o + 1] << 16) | (t[o + 2] << 8) | t[o + 3]) >>> 0);
  if (u16(2) !== 0x2a) return null;
  const found: Record<number, string> = {};
  const ascii = (off: number, n: number) => {
    if (off + n > t.length) return null;
    let s = ""; for (let i = 0; i < n; i++) { const c = t[off + i]; if (c === 0) break; s += String.fromCharCode(c); }
    return s;
  };
  const walk = (ifd: number, depth: number) => {
    if (depth > 2 || ifd + 2 > t.length) return;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12; if (e + 12 > t.length) return;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      if ((tag === 0x9003 || tag === 0x9004 || tag === 0x0132) && type === 2 && count >= 19) {
        const s = ascii(u32(e + 8), Math.min(count, 20)); if (s && /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) found[tag] = s;
      }
      if (tag === 0x8769 && type === 4) walk(u32(e + 8), depth + 1); // ExifIFD pointer
    }
  };
  walk(u32(4), 0);
  return found[0x9003] ?? found[0x9004] ?? found[0x0132] ?? null;
}

/* ── entry validation ───────────────────────────────────────────────────────── */

export interface FoodEntryInput {
  eaten_at: EatenAt;
  meal_type: MealType | null;
  description: string;
  items: string[];
  calories: number | null; carb_g: number | null; protein_g: number | null; fat_g: number | null; fiber_g: number | null;
  glucose_impact_score: number | null; health_score: number | null;
  notes: string | null;
  source: FoodSource;
  estimated_by: EstimatedBy;
}

const num = (v: unknown, max: number): number | null | false => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > max) return false;
  return Math.round(n * 10) / 10;
};

/**
 * One typed/AI-estimated entry → storable row, or a Thai error. `confirmed` must be
 * literally true: the caller (a person in the app, or an AI that showed the numbers
 * to the person) is asserting the estimate was seen and accepted.
 */
export function validateEntry(body: unknown, nowIso: string, defaults: { source: FoodSource; estimated_by: EstimatedBy }): { ok: true; value: FoodEntryInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.confirmed !== true) return { ok: false, error: 'ต้องส่ง "confirmed": true — แปลว่าคนได้เห็นตัวเลขประมาณและยืนยันแล้ว ระบบไม่บันทึกค่าที่ AI เดาโดยไม่มีคนตรวจ' };
  const eaten = parseEatenAt(b.eaten_at, nowIso);
  if (!eaten) return { ok: false, error: 'ต้องระบุ "eaten_at" เป็นเวลาไทย เช่น "2026-09-12 12:30" หรือวันอย่างเดียว "2026-09-12" ถ้าไม่รู้เวลา · ห้ามเป็นอนาคต · ห้ามเดา — ถ้าไม่รู้ให้ถามคน' };
  const description = typeof b.description === "string" ? b.description.trim().slice(0, 300) : "";
  if (!description) return { ok: false, error: 'ต้องมี "description" (ชื่อ/รายละเอียดมื้อ)' };
  const meal = typeof b.meal_type === "string" && (MEAL_TYPES as readonly string[]).includes(b.meal_type) ? (b.meal_type as MealType) : null;
  const items = Array.isArray(b.items) ? b.items.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 100)).filter(Boolean).slice(0, 30) : [];
  const fields: [keyof FoodEntryInput, string, number][] = [
    ["calories", "calories", 5000], ["carb_g", "carb_g", 1000], ["protein_g", "protein_g", 500], ["fat_g", "fat_g", 500], ["fiber_g", "fiber_g", 200],
    ["glucose_impact_score", "glucose_impact_score", 10], ["health_score", "health_score", 10],
  ];
  const out: any = {
    eaten_at: eaten, meal_type: meal, description, items, notes: typeof b.notes === "string" ? b.notes.trim().slice(0, 500) || null : null,
    source: typeof b.source === "string" && ["photo", "text", "photo_backfill", "api"].includes(b.source) ? b.source : defaults.source,
    estimated_by: typeof b.estimated_by === "string" && ["gemini", "client_ai", "manual"].includes(b.estimated_by) ? b.estimated_by : defaults.estimated_by,
  };
  for (const [k, key, max] of fields) {
    const v = num(b[key], max);
    if (v === false) return { ok: false, error: `"${key}" ต้องเป็นตัวเลข 0–${max}` };
    out[k] = v;
  }
  if (out.calories === null && out.carb_g === null && out.protein_g === null && out.fat_g === null) {
    return { ok: false, error: "ต้องมีอย่างน้อย calories หรือมาโคร (carb_g/protein_g/fat_g) หนึ่งค่า" };
  }
  return { ok: true, value: out as FoodEntryInput };
}

/* ── daily summary ──────────────────────────────────────────────────────────── */

export interface FoodRow {
  eaten_at: string; calories: number | null; carb_g: number | null; protein_g: number | null; fat_g: number | null; fiber_g: number | null;
  glucose_impact_score: number | null; health_score: number | null;
}
export interface DaySummary { date: string; entries: number; calories: number; carb_g: number; protein_g: number; fat_g: number; fiber_g: number; cpf_pct: { carb: number; protein: number; fat: number } | null }
export interface FoodWindowSummary {
  window_days: number; days_logged: number; entries: number; coverage_pct: number;
  avg_calories: number | null; avg_protein_g: number | null; avg_carb_g: number | null; avg_fat_g: number | null;
  avg_health_score: number | null; avg_glucose_impact: number | null;
  days: DaySummary[];
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? r1(v.reduce((a, b) => a + b, 0) / v.length) : null; };

/** Group rows by Bangkok date and summarise the window. Averages are over LOGGED days only — say so wherever shown. */
export function summariseFood(rows: FoodRow[], windowDays: number): FoodWindowSummary {
  const by = new Map<string, FoodRow[]>();
  for (const r of rows) { const d = bangkokDate(r.eaten_at); (by.get(d) ?? by.set(d, []).get(d)!).push(r); }
  const days: DaySummary[] = [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, rs]) => {
    const sum = (k: keyof FoodRow) => r1(rs.reduce((a, r) => a + ((r[k] as number | null) ?? 0), 0));
    const c = sum("carb_g"), p = sum("protein_g"), f = sum("fat_g");
    const kcalFromMacros = c * 4 + p * 4 + f * 9;
    return {
      date, entries: rs.length, calories: sum("calories"), carb_g: c, protein_g: p, fat_g: f, fiber_g: sum("fiber_g"),
      cpf_pct: kcalFromMacros > 0 ? { carb: Math.round((c * 4 / kcalFromMacros) * 100), protein: Math.round((p * 4 / kcalFromMacros) * 100), fat: Math.round((f * 9 / kcalFromMacros) * 100) } : null,
    };
  });
  return {
    window_days: windowDays, days_logged: days.length, entries: rows.length,
    coverage_pct: windowDays ? Math.round((days.length / windowDays) * 100) : 0,
    avg_calories: avg(days.map((d) => d.calories)), avg_protein_g: avg(days.map((d) => d.protein_g)),
    avg_carb_g: avg(days.map((d) => d.carb_g)), avg_fat_g: avg(days.map((d) => d.fat_g)),
    avg_health_score: avg(rows.map((r) => r.health_score)), avg_glucose_impact: avg(rows.map((r) => r.glucose_impact_score)),
    days,
  };
}
