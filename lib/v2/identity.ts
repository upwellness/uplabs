/**
 * UP Labs v2 · Identity helpers (SPEC §4 — MANDATORY rules, single source)
 * ───────────────────────────────────────────────────────────────────────
 * Age, birth-date (ค.ศ. / Gregorian), gender, height — formatted identically
 * on the Customer Profile 360 and the BCA page. Pure functions, no side effects.
 *
 * Rules (SPEC §4):
 *   - Age is computed from `birth_date` (day-accurate). Fallback to `birth_year`
 *     (current year − birth_year), then to a server-precomputed `chrono_age`.
 *   - Birth date always shows in ค.ศ. (Gregorian), e.g. "7 Nov 1982". พ.ศ. is
 *     optional secondary only.
 *   - Any null field renders as "—" and nothing breaks.
 */

const EN_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const DASH = "—";

export interface IdentityInput {
  name?: string | null;
  nickname?: string | null;
  gender?: string | null;
  birth_date?: string | null; // ISO YYYY-MM-DD (Gregorian)
  birth_year?: number | null;
  chrono_age?: number | null; // server-computed (from birth_year) — last-resort fallback
  height?: number | null;     // cm
}

/** Parse an ISO date string safely. Returns null on anything invalid. */
function parseISO(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  // Accept full ISO or plain YYYY-MM-DD
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Day-accurate age from a full birth_date. Returns null if unparseable.
 */
export function ageFromBirthDate(birth_date: string | null | undefined, at: Date = new Date()): number | null {
  const b = parseISO(birth_date);
  if (!b) return null;
  let age = at.getFullYear() - b.getFullYear();
  const md = at.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && at.getDate() < b.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

/**
 * Resolve age per SPEC §4 precedence: birth_date → birth_year → chrono_age.
 */
export function resolveAge(c: IdentityInput, at: Date = new Date()): number | null {
  const fromDate = ageFromBirthDate(c.birth_date, at);
  if (fromDate != null) return fromDate;
  if (c.birth_year != null) {
    const a = at.getFullYear() - c.birth_year;
    if (a >= 0 && a < 130) return a;
  }
  if (c.chrono_age != null) return c.chrono_age;
  return null;
}

/** "43 ปี" or "—" */
export function ageLabel(c: IdentityInput, at: Date = new Date()): string {
  const a = resolveAge(c, at);
  return a != null ? `${a} ปี` : DASH;
}

/**
 * Birth date in ค.ศ. (Gregorian): "7 Nov 1982". Returns "—" if missing.
 * If only birth_year exists, show the year alone ("ค.ศ. 1982").
 */
export function birthDateLabel(c: IdentityInput): string {
  const b = parseISO(c.birth_date);
  if (b) return `${b.getDate()} ${EN_MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  if (c.birth_year != null) return `ค.ศ. ${c.birth_year}`;
  return DASH;
}

/** Optional พ.ศ. secondary line. Empty string if no usable date. */
export function birthDateBuddhist(c: IdentityInput): string {
  const b = parseISO(c.birth_date);
  if (b) return `พ.ศ. ${b.getFullYear() + 543}`;
  if (c.birth_year != null) return `พ.ศ. ${c.birth_year + 543}`;
  return "";
}

export type GenderKey = "male" | "female" | "other";

export function genderKey(g?: string | null): GenderKey | null {
  if (g === "male" || g === "female" || g === "other") return g;
  return null;
}

/** "ชาย ♂" / "หญิง ♀" / "อื่นๆ" / "—" */
export function genderLabel(g?: string | null): string {
  const k = genderKey(g);
  if (k === "male") return "ชาย";
  if (k === "female") return "หญิง";
  if (k === "other") return "อื่นๆ";
  return DASH;
}

export function genderGlyph(g?: string | null): string {
  const k = genderKey(g);
  if (k === "male") return "♂";
  if (k === "female") return "♀";
  return "○";
}

/** "165 ซม." or "—" */
export function heightLabel(height?: number | null): string {
  return height != null ? `${height} ซม.` : DASH;
}

/** "ชื่อเต็ม (ชื่อเล่น)" — nickname only appended when present. */
export function displayName(c: IdentityInput): string {
  const base = c.name?.trim() || "ลูกค้า";
  return c.nickname?.trim() ? `${base} (${c.nickname.trim()})` : base;
}

/** 1–2 char initials, stripping common Thai honorific prefixes. */
export function initials(name?: string | null): string {
  if (!name) return "?";
  const stripped = name.replace(/^(คุณ|นาย|นาง|นางสาว|น\.ส\.|ด\.ช\.|ด\.ญ\.)\s?/, "").trim();
  return (stripped || name).slice(0, 2).toUpperCase();
}
