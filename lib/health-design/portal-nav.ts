/**
 * Portal navigation lives in the URL hash so the phone's back button closes a sheet
 * and a LINE nudge can deep-link to a tab (SPEC-Mobile-Portal.md §5.3).
 *
 *   #home · #health · #food · #plan · #me · #food/new
 *   #src/labs · #src/bca · #src/cgm · #src/wearable
 *   #health/<domain>                 → that domain row expanded (L1)
 *   #health/<domain>/<metric>        → metric sheet (L2)
 *   #health/<domain>/<metric>/ai     → explain sheet on top (L3)
 *   #health/<domain>/ai              → explain a whole domain
 *   #home/ai                         → explain the overview
 *
 * Pure; tested. Also home to the small formatting helpers every screen shares.
 */
import type { DomainKey, Level } from "./assess";

export type Tab = "home" | "health" | "food" | "plan" | "me";
export type Page = Tab | "food-new" | "src-labs" | "src-bca" | "src-cgm" | "src-wearable";
export interface NavState { page: Page; tab: Tab; domain: DomainKey | null; metric: string | null; ai: boolean }

const DOMAINS = new Set<string>(["metabolic", "body_comp", "cardio_lipid", "liver_kidney", "recovery", "nutrition", "health_age"]);
const SRC = new Set(["labs", "bca", "cgm", "wearable"]);

export function parseHash(hash: string): NavState {
  const parts = (hash ?? "").replace(/^#\/?/, "").split("/").filter(Boolean);
  const [p0, p1, p2, p3] = parts;
  const base: NavState = { page: "home", tab: "home", domain: null, metric: null, ai: false };
  if (!p0) return base;
  if (p0 === "src" && p1 && SRC.has(p1)) {
    const tab: Tab = "health";
    return { page: `src-${p1}` as Page, tab, domain: null, metric: p2 && p2 !== "ai" ? p2 : null, ai: p3 === "ai" || p2 === "ai" };
  }
  if (p0 === "food") return p1 === "new" ? { ...base, page: "food-new", tab: "food" } : { ...base, page: "food", tab: "food" };
  if (p0 === "plan") return { ...base, page: "plan", tab: "plan" };
  if (p0 === "me") return { ...base, page: "me", tab: "me" };
  if (p0 === "home") return { ...base, ai: p1 === "ai" };
  if (p0 === "health") {
    const domain = p1 && DOMAINS.has(p1) ? (p1 as DomainKey) : null;
    if (!domain) return { ...base, page: "health", tab: "health" };
    if (p2 === "ai") return { page: "health", tab: "health", domain, metric: null, ai: true };
    return { page: "health", tab: "health", domain, metric: p2 ?? null, ai: p3 === "ai" };
  }
  return base;
}

export function toHash(s: Partial<NavState> & { page: Page }): string {
  if (s.page.startsWith("src-")) return `#src/${s.page.slice(4)}${s.metric ? `/${s.metric}` : ""}${s.ai ? "/ai" : ""}`;
  if (s.page === "food-new") return "#food/new";
  if (s.page === "home") return s.ai ? "#home/ai" : "#home";
  if (s.page === "health") return `#health${s.domain ? `/${s.domain}` : ""}${s.domain && s.metric ? `/${s.metric}` : ""}${s.domain && s.ai ? "/ai" : ""}`;
  return `#${s.page}`;
}

/* ── formatting shared by the screens ───────────────────────────────────────── */

export const LEVEL_COLOR: Record<Level, string> = { good: "#3E7C59", watch: "#C9922B", attention: "#B4413C" };
export const NO_DATA_COLOR = "#B8C2BD";
export const levelColor = (l: Level | null | undefined) => (l ? LEVEL_COLOR[l] : NO_DATA_COLOR);

const CLINICAL = new Set<DomainKey>(["metabolic", "cardio_lipid", "liver_kidney"]);
/** Short chip text — same clinical/lifestyle split as the engine. */
export const levelShort = (domain: DomainKey | null, l: Level | null): string =>
  l == null ? "ยังไม่มีข้อมูล" : l === "good" ? "ดี" : l === "watch" ? "ควรติดตาม" : domain && !CLINICAL.has(domain) ? "ดูแลจริงจัง" : "ปรึกษาแพทย์";

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
/** "2026-09-08" or ISO → "8 ก.ย." (+ " 69" when a different year than `today`) */
export function fmtDateTh(iso: string | null | undefined, today?: string): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00+07:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  const bkk = new Date(d.getTime() + 7 * 3_600_000);
  const day = bkk.getUTCDate(), mon = TH_MONTH[bkk.getUTCMonth()], yr = bkk.getUTCFullYear();
  const sameYear = today ? Number(today.slice(0, 4)) === yr : true;
  return `${day} ${mon}${sameYear ? "" : ` ${String(yr + 543).slice(-2)}`}`;
}
export function fmtTimeTh(iso: string): string {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return "";
  const bkk = new Date(d.getTime() + 7 * 3_600_000);
  return `${String(bkk.getUTCHours()).padStart(2, "0")}:${String(bkk.getUTCMinutes()).padStart(2, "0")}`;
}
export const fmtNum = (v: number | string | null | undefined, digits = 1): string =>
  v == null ? "—" : typeof v === "string" ? v : Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: digits });

/** Days between two ISO dates (b − a), floored. */
export const daysBetween = (a: string, b: string) => Math.floor((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 864e5);

/* ── chart paths (SVG) ─────────────────────────────────────────────────────── */

/**
 * Monotone cubic interpolation (Fritsch–Carlson) — never overshoots between samples,
 * so the curve cannot invent a peak the data does not have (feedback_clinical_chart_smoothing).
 */
export function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x} ${pts[0].y}`;
  const dx: number[] = [], dy: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1].x - pts[i].x); dy.push(pts[i + 1].y - pts[i].y); m.push(dx[i] === 0 ? 0 : dy[i] / dx[i]); }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${r(pts[0].x)} ${r(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${r(pts[i].x + h)} ${r(pts[i].y + t[i] * h)} ${r(pts[i + 1].x - h)} ${r(pts[i + 1].y - t[i + 1] * h)} ${r(pts[i + 1].x)} ${r(pts[i + 1].y)}`;
  }
  return d;
}
const r = (v: number) => Math.round(v * 100) / 100;

/** Map values into a W×H box with padding; returns points + the y scale used. */
export function scaleSeries(vals: number[], W: number, H: number, pad = 4, yMin?: number, yMax?: number): { pts: { x: number; y: number }[]; lo: number; hi: number } {
  const lo = yMin ?? Math.min(...vals), hi0 = yMax ?? Math.max(...vals);
  const hi = hi0 === lo ? lo + 1 : hi0;
  const n = vals.length;
  const pts = vals.map((v, i) => ({ x: n === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (n - 1), y: pad + (1 - (v - lo) / (hi - lo)) * (H - 2 * pad) }));
  return { pts, lo, hi };
}
