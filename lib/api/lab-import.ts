/**
 * Normalising submitted lab values before a human reviews them.
 *
 * Everything here is pure — no database — because this is where a misread turns into
 * a stored number, and that decision deserves a test suite that runs in milliseconds.
 *
 * The guiding rule: **normalise, never invent.** If a submitted value is unusable we
 * say so and let the reviewer fix it; we do not guess a unit, infer a status the slip
 * did not print, or repair a date. A guess made here is invisible by the time it
 * reaches the patient record.
 */

export interface SubmittedValue {
  metric_key?: unknown;
  metric_label_th?: unknown;
  value?: unknown;
  value_num?: unknown;
  unit?: unknown;
  ref_low?: unknown;
  ref_high?: unknown;
  ref_text?: unknown;
  status?: unknown;
  category?: unknown;
}

export interface NormalisedValue {
  metric_key: string;
  metric_label_th: string | null;
  value: string;
  value_num: number | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string | null;
  status: LabStatus;
  category: string;
  /** Things the reviewer should look at before approving. Never blocks on its own. */
  warnings: string[];
}

export type LabStatus = "normal" | "low" | "high" | "borderline";
const STATUSES: LabStatus[] = ["normal", "low", "high", "borderline"];

export interface NormaliseResult {
  ok: boolean;
  error?: string;
  values?: NormalisedValue[];
  /** Collected across all values, so the review screen can lead with them. */
  warnings?: string[];
}

/** Categories already in use. An unknown one is kept but flagged, never rewritten. */
const KNOWN_CATEGORIES = [
  "cbc", "glucose", "lipid", "kidney", "liver", "uric", "thyroid",
  "imaging", "hepatitis", "cancer", "inflammation", "cardiac", "other",
];

/**
 * Units that get mixed up in ways that change the number by an order of magnitude.
 * We flag rather than convert — converting silently is how a wrong value gets a
 * confident-looking unit attached to it.
 */
const UNIT_CONFUSION: Record<string, { expect: string[]; note: string }> = {
  hba1c: { expect: ["%"], note: "HbA1c ปกติเป็น % — ถ้าใบเขียน mmol/mol เป็นคนละมาตรฐาน ต้องแปลงก่อน" },
  fbs: { expect: ["mg/dl"], note: "น้ำตาลมีทั้ง mg/dL และ mmol/L — ต่างกันประมาณ 18 เท่า" },
  cholesterol: { expect: ["mg/dl"], note: "ไขมันมีทั้ง mg/dL และ mmol/L — ต่างกันประมาณ 38 เท่า" },
  ldl: { expect: ["mg/dl"], note: "ไขมันมีทั้ง mg/dL และ mmol/L" },
  hdl: { expect: ["mg/dl"], note: "ไขมันมีทั้ง mg/dL และ mmol/L" },
  triglyceride: { expect: ["mg/dl"], note: "ไตรกลีเซอไรด์มีทั้ง mg/dL และ mmol/L" },
};

/** Values so far outside human range that a transcription slip is the likely cause. */
const SANITY: Record<string, { min: number; max: number; unit: string }> = {
  hba1c:        { min: 3,   max: 20,   unit: "%" },
  fbs:          { min: 20,  max: 800,  unit: "mg/dL" },
  cholesterol:  { min: 50,  max: 800,  unit: "mg/dL" },
  ldl:          { min: 10,  max: 600,  unit: "mg/dL" },
  hdl:          { min: 10,  max: 150,  unit: "mg/dL" },
  triglyceride: { min: 20,  max: 5000, unit: "mg/dL" },
  creatinine:   { min: 0.1, max: 20,   unit: "mg/dL" },
  hemoglobin:   { min: 3,   max: 25,   unit: "g/dL" },
};

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
};

/**
 * @param recordedAt the draw date, already validated by the caller
 */
export function normaliseSubmission(
  raw: unknown,
  today = new Date(),
): NormaliseResult {
  if (!Array.isArray(raw)) return { ok: false, error: 'ต้องส่ง "values" เป็น array' };
  if (raw.length === 0) return { ok: false, error: 'ต้องมี "values" อย่างน้อย 1 รายการ' };
  if (raw.length > 200) return { ok: false, error: "ส่งได้ไม่เกิน 200 ค่าต่อครั้ง" };

  const values: NormalisedValue[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const v = (raw[i] ?? {}) as SubmittedValue;
    const where = `รายการที่ ${i + 1}`;

    const key = str(v.metric_key)?.toLowerCase().replace(/[\s-]+/g, "_");
    if (!key) return { ok: false, error: `${where}: ต้องมี metric_key` };
    if (!/^[a-z0-9_]+$/.test(key)) {
      return { ok: false, error: `${where}: metric_key "${key}" ใช้ได้เฉพาะ a-z 0-9 _` };
    }

    const display = str(v.value);
    if (display === null) return { ok: false, error: `${where} (${key}): ต้องมี value` };

    const warnings: string[] = [];

    if (seen.has(key)) warnings.push(`${key} ส่งมาซ้ำมากกว่าหนึ่งครั้ง — ตรวจว่าอ่านแถวซ้ำหรือเปล่า`);
    seen.add(key);

    // Prefer an explicit value_num; otherwise parse the display value. A value that is
    // not a number at all (Negative, Not found) is legitimate — it just has no number.
    let n = num(v.value_num);
    if (n === null) n = num(display);

    if (n !== null && num(v.value_num) !== null && num(display) !== null && num(v.value_num) !== num(display)) {
      warnings.push(`${key}: value ("${display}") กับ value_num (${v.value_num}) ไม่ตรงกัน — ใช้ value_num`);
    }

    const unit = str(v.unit);
    const confusion = UNIT_CONFUSION[key];
    if (confusion && unit && !confusion.expect.includes(unit.toLowerCase())) {
      warnings.push(`${key}: หน่วยเป็น "${unit}" — ${confusion.note}`);
    }

    const sane = SANITY[key];
    if (sane && n !== null && (n < sane.min || n > sane.max)) {
      warnings.push(
        `${key} = ${n} อยู่นอกช่วงที่เป็นไปได้ (${sane.min}–${sane.max} ${sane.unit}) — น่าจะอ่านผิดหรือหน่วยคนละแบบ`,
      );
    }

    // A status the slip did not print is not ours to infer. Anything unrecognised
    // becomes "normal" and is flagged, so the reviewer sets it rather than us guessing
    // a customer is abnormal — or, worse, guessing they are fine.
    const rawStatus = str(v.status)?.toLowerCase();
    let status: LabStatus = "normal";
    if (rawStatus) {
      if ((STATUSES as string[]).includes(rawStatus)) status = rawStatus as LabStatus;
      else {
        warnings.push(`${key}: status "${rawStatus}" ไม่รู้จัก — ตั้งเป็น normal ไว้ก่อน ให้ตรวจเอง`);
      }
    } else {
      warnings.push(`${key}: ไม่ได้ระบุสถานะ (ปกติ/สูง/ต่ำ) — ตั้งเป็น normal ไว้ก่อน`);
    }

    const category = str(v.category)?.toLowerCase() ?? "other";
    if (!KNOWN_CATEGORIES.includes(category)) {
      warnings.push(`${key}: หมวด "${category}" ยังไม่เคยใช้ในระบบ — ตรวจว่าสะกดถูกไหม`);
    }

    values.push({
      metric_key: key,
      metric_label_th: str(v.metric_label_th),
      value: display,
      value_num: n,
      unit,
      ref_low: num(v.ref_low),
      ref_high: num(v.ref_high),
      ref_text: str(v.ref_text),
      status,
      category,
      warnings,
    });
  }

  return { ok: true, values, warnings: values.flatMap((v) => v.warnings) };
}

/**
 * Draw-date check for a submission. Separate from the profile birth-date rule because
 * the failure looks different: a lab dated in the future is usually a Buddhist year,
 * and one dated decades back is usually a typo in the year.
 */
export function validateDrawDate(input: unknown, today = new Date()): { ok: boolean; error?: string; value?: string } {
  const s = str(input);
  if (!s) return { ok: false, error: 'ต้องมี "recorded_at" (วันที่เจาะเลือด)' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false, error: "recorded_at ต้องเป็นรูปแบบ YYYY-MM-DD" };

  const d = new Date(s + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return { ok: false, error: "วันที่ไม่ถูกต้อง" };

  const year = Number(s.slice(0, 4));
  if (year > today.getFullYear()) {
    return { ok: false, error: `ปี ${year} เป็นอนาคต — ใบแล็บไทยพิมพ์ พ.ศ. · ค.ศ. คือ ${year - 543}` };
  }
  if (d.getTime() > today.getTime()) return { ok: false, error: "วันที่เจาะเลือดอยู่ในอนาคต" };
  if (year < 1990) return { ok: false, error: `ปี ${year} เก่าผิดปกติ — ตรวจอีกครั้ง` };

  return { ok: true, value: s };
}

/** One-line summary for the review inbox. */
export function summarise(values: NormalisedValue[]): string {
  const flagged = values.filter((v) => v.warnings.length).length;
  const abnormal = values.filter((v) => v.status !== "normal").length;
  const bits = [`${values.length} ค่า`];
  if (abnormal) bits.push(`ผิดปกติ ${abnormal}`);
  if (flagged) bits.push(`⚠️ ต้องดู ${flagged}`);
  return bits.join(" · ");
}
