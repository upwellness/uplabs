/**
 * Health Age — PhenoAge (Levine 2018)
 * ────────────────────────────────────
 * Blood-based biological-age estimate from 9 markers + chronological age.
 * ★ Coefficients are VERIFIED (see 08_Prototypes/Levin2018/README.md test cases) —
 *   do not "tidy" the magic numbers. Source: Liu et al., PLOS Medicine 2018.
 *
 * Positioning: "อายุสุขภาพ" = a trend/motivation tool, NOT a diagnosis. Always
 * ship with the disclaimer; sensitive to acute inflammation (CRP/WBC spikes).
 */

import type { StatusLevel } from "./medical-status";
import { classifyBodyAge } from "./medical-status";

export type AlbuminUnit = "g/dL" | "g/L";
export type CreatinineUnit = "mg/dL" | "umol/L";
export type GlucoseUnit = "mg/dL" | "mmol/L";
export type CrpUnit = "mg/L" | "mg/dL";

/** Raw clinical inputs with explicit units (mirrors the calculator form). */
export interface PhenoInput {
  age: number;                 // years
  albumin: number;             albuminUnit: AlbuminUnit;
  creatinine: number;          creatinineUnit: CreatinineUnit;
  glucose: number;             glucoseUnit: GlucoseUnit;      // fasting
  crp: number;                 crpUnit: CrpUnit;              // hs-CRP
  lymphocytePct: number;       // %
  mcv: number;                 // fL
  rdw: number;                 // %
  alp: number;                 // U/L
  wbc: number;                 // 10^3/µL
}

export interface PhenoResult {
  phenoAge: number;            // years (rounded to 1 dp)
  age: number;                 // chrono age echoed back
  delta: number;              // phenoAge - age (negative = younger than actual)
  mortalityPct: number;        // 10-year all-cause mortality risk, %
  level: StatusLevel;          // colour band (younger→optimal … older→danger)
  acuteFlag: boolean;          // CRP > 3 mg/L or WBC > 11 → result may be inflated
}

const ALB_KEYS = ["albumin", "creatinine", "glucose", "crp", "lymphocytePct", "mcv", "rdw", "alp", "wbc"] as const;

/** Convert raw inputs → the formula's canonical units. */
function toFormulaUnits(inp: PhenoInput) {
  const albumin_gL = inp.albuminUnit === "g/L" ? inp.albumin : inp.albumin * 10;
  const creat_umol = inp.creatinineUnit === "umol/L" ? inp.creatinine : inp.creatinine * 88.4;
  const glucose_mmol = inp.glucoseUnit === "mmol/L" ? inp.glucose : inp.glucose / 18.0182;
  const crp_mgL = inp.crpUnit === "mg/dL" ? inp.crp * 10 : inp.crp; // hs-CRP in mg/L
  const crp_mgdL = crp_mgL / 10;
  return { albumin_gL, creat_umol, glucose_mmol, crp_mgL, crp_mgdL };
}

export function computePhenoAge(inp: PhenoInput): PhenoResult {
  const { albumin_gL, creat_umol, glucose_mmol, crp_mgL, crp_mgdL } = toFormulaUnits(inp);
  const lnCRP = Math.log(Math.max(crp_mgdL, 0.01));

  const xb =
    -19.9067 -
    0.0336 * albumin_gL +
    0.0095 * creat_umol +
    0.1953 * glucose_mmol +
    0.0954 * lnCRP -
    0.0120 * inp.lymphocytePct +
    0.0268 * inp.mcv +
    0.3306 * inp.rdw +
    0.00188 * inp.alp +
    0.0554 * inp.wbc +
    0.0804 * inp.age;

  const gamma = 0.0076927;
  const mort = 1 - Math.exp(-Math.exp(xb) * (Math.exp(120 * gamma) - 1) / gamma);
  const phenoRaw = 141.50225 + Math.log(-0.00553 * Math.log(1 - mort)) / 0.090165;

  const phenoAge = Math.round(phenoRaw * 10) / 10;
  const delta = Math.round((phenoAge - inp.age) * 10) / 10;
  return {
    phenoAge,
    age: inp.age,
    delta,
    mortalityPct: Math.round(mort * 1000) / 10,
    // Reuse the body-age band so "อายุสุขภาพ" shares the BCA colour language.
    level: classifyBodyAge(phenoAge, inp.age),
    acuteFlag: crp_mgL > 3 || inp.wbc > 11,
  };
}

/* ── Lab-row extraction (prefill the calculator / auto-score on Customer 360) ── */

export interface LabRow { metric_key: string; value_num: number | null; unit: string | null }

/** The 9 PhenoAge markers keyed by the lib field they fill. */
export const PHENO_LAB_KEYS: Record<string, keyof PhenoInput | "crp" | "glucose"> = {
  albumin: "albumin",
  creatinine: "creatinine",
  fbs: "glucose",
  hs_crp: "crp", hscrp: "crp", crp: "crp",
  lymphocytes: "lymphocytePct", lymphocyte: "lymphocytePct",
  mcv: "mcv",
  rdw: "rdw",
  alp: "alp",
  wbc: "wbc",
};

/** Thai labels for the markers (missing-list + breakdown). */
export const PHENO_MARKER_TH: Record<string, string> = {
  albumin: "Albumin (อัลบูมิน)",
  creatinine: "Creatinine (ครีอะตินิน)",
  glucose: "Glucose (น้ำตาลอดอาหาร)",
  crp: "CRP (ค่าอักเสบ)",
  lymphocytePct: "Lymphocyte %",
  mcv: "MCV",
  rdw: "RDW",
  alp: "ALP",
  wbc: "WBC (เม็ดเลือดขาว)",
};

function sniffUnit(marker: string, raw: string | null): string {
  const u = (raw ?? "").toLowerCase().replace(/\s|µ|μ/g, (m) => (m === " " ? "" : "u"));
  if (marker === "albumin") return u.includes("g/l") && !u.includes("g/dl") ? "g/L" : "g/dL";
  if (marker === "creatinine") return u.includes("umol") ? "umol/L" : "mg/dL";
  if (marker === "glucose") return u.includes("mmol") ? "mmol/L" : "mg/dL";
  if (marker === "crp") return u.includes("mg/dl") ? "mg/dL" : "mg/L";
  return "";
}

export interface PhenoPrefill {
  input: Partial<PhenoInput> & Record<string, any>;
  present: string[];  // lib field names present
  missing: string[];  // lib field names missing (of the 9 markers)
  complete: boolean;  // all 9 markers present (age handled separately)
}

/**
 * Map a customer's latest lab rows → prefill for the calculator. Takes the most
 * recent row per marker. Age must be supplied by the caller (from DOB).
 */
export function phenoPrefillFromLabs(rows: LabRow[], age: number | null): PhenoPrefill {
  const latest = new Map<string, LabRow>(); // by lib field
  // rows should be passed newest-first; keep the first seen per marker
  for (const r of rows) {
    const field = PHENO_LAB_KEYS[r.metric_key?.toLowerCase?.() ?? r.metric_key];
    if (!field || r.value_num == null) continue;
    if (!latest.has(field)) latest.set(field, r);
  }
  const input: any = { age: age ?? undefined };
  for (const [field, r] of latest) {
    input[field] = r.value_num;
    const uKey = `${field === "glucose" ? "glucose" : field}Unit`;
    const sniffed = sniffUnit(field, r.unit);
    if (sniffed) input[uKey] = sniffed;
  }
  const present = ALB_KEYS.filter((k) => input[k] != null);
  const missing = ALB_KEYS.filter((k) => input[k] == null);
  return { input, present, missing, complete: missing.length === 0 };
}

/** Default calculator units when a lab row didn't specify one. */
export const PHENO_DEFAULT_UNITS = {
  albuminUnit: "g/dL" as AlbuminUnit,
  creatinineUnit: "mg/dL" as CreatinineUnit,
  glucoseUnit: "mg/dL" as GlucoseUnit,
  crpUnit: "mg/L" as CrpUnit,
};
