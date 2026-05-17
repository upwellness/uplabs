/**
 * Thai date utilities — convert between พ.ศ. (Buddhist year + 543) and ค.ศ. (Gregorian).
 * Internal storage is always ค.ศ. (ISO YYYY-MM-DD); UI may display either.
 */

export type YearSystem = "be" | "ce"; // be = พ.ศ., ce = ค.ศ.

export const TH_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export const TH_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** Add 543 to a Gregorian year to get Buddhist year. */
export const ceToBe = (yearCE: number): number => yearCE + 543;

/** Subtract 543 to convert Buddhist year to Gregorian. */
export const beToCe = (yearBE: number): number => yearBE - 543;

/**
 * Detect if a 4-digit year is more likely พ.ศ. or ค.ศ.
 * Rule: years > 2200 = พ.ศ.; years 1900-2200 = ค.ศ.
 */
export const detectYearSystem = (year: number): YearSystem =>
  year > 2200 ? "be" : "ce";

/** Format ISO date (YYYY-MM-DD) → "15 พ.ค. 2510" or "15 พ.ค. 1967" depending on system. */
export function formatThaiDate(isoDate: string | null | undefined, system: YearSystem = "be"): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const month = TH_MONTHS_SHORT[d.getMonth()];
  const year = system === "be" ? ceToBe(d.getFullYear()) : d.getFullYear();
  return `${day} ${month} ${year}`;
}

/** Format ISO date showing BOTH year systems: "15 พ.ค. 2510 (1967)". */
export function formatBothYears(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const month = TH_MONTHS_SHORT[d.getMonth()];
  return `${day} ${month} ${ceToBe(d.getFullYear())} (${d.getFullYear()})`;
}

/** Build ISO date string (YYYY-MM-DD) from day/month/year + year system. */
export function buildIsoDate(
  day: number,
  month: number, // 1-12
  year: number,
  system: YearSystem = "be",
): string | null {
  if (!day || !month || !year) return null;
  const yearCE = system === "be" ? beToCe(year) : year;
  if (yearCE < 1900 || yearCE > 2100) return null;
  const m = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yearCE}-${m}-${dd}`;
}

/** Parse ISO date → {day, month, year} in chosen year system. */
export function parseIsoDate(
  isoDate: string | null | undefined,
  system: YearSystem = "be",
): { day: number | null; month: number | null; year: number | null } {
  if (!isoDate) return { day: null, month: null, year: null };
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return { day: null, month: null, year: null };
  const yearCE = d.getFullYear();
  return {
    day: d.getDate(),
    month: d.getMonth() + 1,
    year: system === "be" ? ceToBe(yearCE) : yearCE,
  };
}

/** Compute age in years from a date string (handles birthday not yet reached this year). */
export function computeAge(isoDate: string | null | undefined, atIso?: string): number | null {
  if (!isoDate) return null;
  const birth = new Date(isoDate);
  if (isNaN(birth.getTime())) return null;
  const ref = atIso ? new Date(atIso) : new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) age--;
  return age;
}
