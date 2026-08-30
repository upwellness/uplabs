/**
 * Data shaping for the External API.
 *
 * These functions return the *answer*, not raw rows. `buildCompare` does the
 * round-alignment and the deltas here rather than making every caller redo them —
 * an LLM asked to subtract two numbers will usually get it right, and "usually" is
 * not good enough when the number is somebody's LDL.
 *
 * Two honesty rules baked into the shapes:
 *   1. A metric not drawn in a round is `null`, never 0 and never carried forward
 *      from the previous round. Carrying a value forward invents a measurement.
 *   2. `/overview` separates "tested and normal" from "never tested", and ships
 *      `caveats` describing what the data cannot tell you. Without that, a caller
 *      summarising the payload will report silence as good news.
 */
import { createAdminClient } from "@/lib/supabase/admin";

export interface CustomerLite {
  id: string;
  name: string;
  gender: string | null;
  birth_date: string | null;
  height: string | null;
  coach_id: string | null;
  /** Set = retired profile. Excluded from search; still readable by id. */
  disabled_at?: string | null;
}

const CUSTOMER_COLS = "id, name, gender, birth_date, height, coach_id, disabled_at";

export async function getCustomer(id: string): Promise<CustomerLite | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("customers").select(CUSTOMER_COLS).eq("id", id).maybeSingle();
  return (data as CustomerLite) ?? null;
}

/**
 * Name search, already narrowed to what the token may see.
 *
 * Retired profiles are excluded. This matters more here than in the web UI: an
 * assistant resolving "เทียบแล็บของ X" against a retired duplicate would answer
 * confidently from the wrong record, and nobody would see the profile to notice.
 */
export async function searchCustomers(
  q: string,
  visible: { all: true } | { all: false; ids: string[] },
  limit = 20,
  includeDisabled = false,
): Promise<CustomerLite[]> {
  const admin = createAdminClient();
  let query = admin.from("customers").select(CUSTOMER_COLS).order("name");
  if (!includeDisabled) query = query.is("disabled_at", null);
  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);
  if (!visible.all) {
    if (visible.ids.length === 0) return [];
    query = query.in("id", visible.ids);
  }
  const { data } = await query.limit(Math.min(100, Math.max(1, limit)));
  return (data ?? []) as CustomerLite[];
}

/* ── labs ─────────────────────────────────────────────────────────────────── */

export type { LabValue, LabRound, CompareMetric } from "./compare";
export { buildCompare, ageFrom, selectRounds } from "./compare";
import type { LabRound, LabValue } from "./compare";
import { selectRounds } from "./compare";

export interface RoundQuery {
  /**
   * Ignore visits with fewer than this many values. Defaults to 1 (keep everything).
   *
   * `/labs/compare` passes 2, and that is not cosmetic. Home-device readings land in
   * the same table as hospital panels — a glucometer entry is one row on its own
   * date. Counting those as "rounds" meant a request for the last 3 rounds returned
   * two fingersticks and one blood draw, and the actual clinic-to-clinic comparison
   * the caller wanted fell off the end. Caught testing against production data.
   *
   * Nothing is hidden: whatever gets skipped comes back in `skipped`.
   */
  minValues?: number;
}

export interface RoundResult {
  rounds: LabRound[];
  /** Visits left out by `minValues`, so the caller can see they exist. */
  skipped: { recorded_at: string; value_count: number; source: string | null }[];
  /** Distinct visit dates on record, however many were returned. */
  total_available: number;
}

/** The most recent `rounds` visit dates, oldest → newest. */
export async function getLabRoundsDetailed(
  customerId: string, rounds = 3, opts: RoundQuery = {},
): Promise<RoundResult> {
  const admin = createAdminClient();
  const n = Math.min(20, Math.max(1, rounds));
  const minValues = Math.max(1, opts.minValues ?? 1);

  const { data: dates } = await admin
    .from("customer_lab_values")
    .select("recorded_at")
    .eq("customer_id", customerId)
    .order("recorded_at", { ascending: false });

  // count values per visit date so thin visits can be filtered
  const perDate = new Map<string, number>();
  for (const r of dates ?? []) {
    const d = (r as any).recorded_at as string;
    if (d) perDate.set(d, (perDate.get(d) ?? 0) + 1);
  }
  const sel = selectRounds(perDate, n, minValues);
  const skipped: RoundResult["skipped"] = sel.skipped.map((s) => ({ ...s, source: null }));
  if (sel.chosen.length === 0) return { rounds: [], skipped, total_available: perDate.size };
  const wanted = sel.chosen; // already oldest → newest

  const { data: values } = await admin
    .from("customer_lab_values")
    .select("metric_key, metric_label_th, value, value_num, unit, status, category, ref_text, recorded_at")
    .eq("customer_id", customerId)
    .in("recorded_at", wanted)
    .order("category");

  const { data: records } = await admin
    .from("customer_records")
    .select("recorded_at, source, notes")
    .eq("customer_id", customerId)
    .in("recorded_at", wanted);

  const built = wanted.map((d) => {
    const rec = (records ?? []).find((r: any) => r.recorded_at === d) as any;
    return {
      recorded_at: d,
      source: rec?.source ?? null,
      notes: rec?.notes ?? null,
      values: ((values ?? []) as LabValue[])
        .filter((v) => v.recorded_at === d)
        .map((v) => ({ ...v, value_num: v.value_num == null ? null : Number(v.value_num) })),
    };
  });

  // fill in the source for skipped visits so the caller can tell a home reading from
  // a clinic draw without a second request
  if (skipped.length) {
    const { data: skipRecs } = await admin
      .from("customer_records").select("recorded_at, source")
      .eq("customer_id", customerId).in("recorded_at", skipped.map((s) => s.recorded_at));
    for (const s of skipped) {
      s.source = ((skipRecs ?? []).find((r: any) => r.recorded_at === s.recorded_at) as any)?.source ?? null;
    }
  }

  return { rounds: built, skipped, total_available: perDate.size };
}

/** Convenience wrapper for callers that only want the rounds. */
export async function getLabRounds(customerId: string, rounds = 3, opts: RoundQuery = {}): Promise<LabRound[]> {
  return (await getLabRoundsDetailed(customerId, rounds, opts)).rounds;
}

/* ── overview ─────────────────────────────────────────────────────────────── */

/** Metrics a longevity review is expected to cover. Absence is itself a finding. */
const CORE_PANEL: { key: string; label: string; category: string }[] = [
  { key: "hba1c", label: "น้ำตาลสะสม", category: "glucose" },
  { key: "fbs", label: "น้ำตาลอดอาหาร", category: "glucose" },
  { key: "cholesterol", label: "คอเลสเตอรอลรวม", category: "lipid" },
  { key: "triglyceride", label: "ไตรกลีเซอไรด์", category: "lipid" },
  { key: "hdl", label: "HDL", category: "lipid" },
  { key: "ldl", label: "LDL", category: "lipid" },
  { key: "creatinine", label: "Creatinine", category: "kidney" },
  { key: "egfr", label: "eGFR", category: "kidney" },
  { key: "alt_sgpt", label: "ALT", category: "liver" },
  { key: "ast_sgot", label: "AST", category: "liver" },
  { key: "hemoglobin", label: "ฮีโมโกลบิน", category: "cbc" },
  { key: "hs_crp", label: "hs-CRP", category: "inflammation" },
];

/** The 9 markers PhenoAge needs (lib/bio-age.ts). */
const PHENOAGE = ["albumin", "creatinine", "fbs", "hs_crp", "lymphocyte", "mcv", "rdw", "alp", "wbc"];

export async function getOverview(customerId: string) {
  const admin = createAdminClient();

  const { data: all } = await admin
    .from("customer_lab_values")
    .select("metric_key, metric_label_th, value, value_num, unit, status, category, ref_text, recorded_at")
    .eq("customer_id", customerId)
    .order("recorded_at", { ascending: false });

  const values = (all ?? []) as LabValue[];
  const latestByKey = new Map<string, LabValue>();
  for (const v of values) if (!latestByKey.has(v.metric_key)) latestByKey.set(v.metric_key, v);

  const dates = [...new Set(values.map((v) => v.recorded_at))].sort();
  const latestDate = dates[dates.length - 1] ?? null;

  const abnormal = [...latestByKey.values()]
    .filter((v) => v.status && v.status !== "normal")
    .map((v) => ({
      metric_key: v.metric_key, label_th: v.metric_label_th, value: v.value,
      unit: v.unit, status: v.status, ref_text: v.ref_text, recorded_at: v.recorded_at,
    }));

  const neverTested = CORE_PANEL.filter((m) => !latestByKey.has(m.key))
    .map((m) => ({ metric_key: m.key, label_th: m.label, category: m.category }));

  const phenoMissing = PHENOAGE.filter((k) => !latestByKey.has(k));

  const { data: measurement } = await admin
    .from("measurements").select("*").eq("customer_id", customerId)
    .order("recorded_at", { ascending: false }).limit(1).maybeSingle();

  const { data: safety } = await admin
    .from("customer_supplement_safety").select("product_key, product_th, status, reason")
    .eq("customer_id", customerId);

  // Stale-data caveats: values carried from an older visit are still shown, but the
  // caller must be told, or it will summarise them as current.
  const caveats: string[] = [];
  if (latestDate) {
    const staleCats = new Set<string>();
    for (const v of latestByKey.values()) if (v.recorded_at !== latestDate && v.category) staleCats.add(v.category);
    if (staleCats.size) {
      caveats.push(`ค่าในหมวด ${[...staleCats].join(", ")} มาจากการตรวจครั้งก่อน ไม่ได้ตรวจซ้ำในรอบล่าสุด (${latestDate})`);
    }
  }
  if (neverTested.length) caveats.push(`ยังไม่เคยตรวจ: ${neverTested.map((m) => m.label_th).join(", ")}`);
  if (phenoMissing.length) caveats.push(`คำนวณอายุสุขภาพ (PhenoAge) ยังไม่ได้ — ขาด ${phenoMissing.join(", ")}`);
  if (!measurement) caveats.push("ยังไม่มีค่าองค์ประกอบร่างกาย (BCA) จึงประเมินสัดส่วนไขมัน/กล้ามเนื้อไม่ได้");
  caveats.push("รายงานนี้อ่านจากข้อมูลที่บันทึกไว้เท่านั้น — สิ่งที่ไม่ได้บันทึกไม่ได้แปลว่าปกติ");

  const byCategory: Record<string, any[]> = {};
  for (const v of latestByKey.values()) {
    const c = v.category ?? "other";
    (byCategory[c] ||= []).push({
      metric_key: v.metric_key, label_th: v.metric_label_th, value: v.value,
      unit: v.unit, status: v.status, ref_text: v.ref_text, recorded_at: v.recorded_at,
    });
  }

  return {
    latest_visit: latestDate,
    visit_count: dates.length,
    latest_by_category: byCategory,
    abnormal,
    never_tested: neverTested,
    health_age: { computable: phenoMissing.length === 0, missing_markers: phenoMissing },
    latest_measurement: measurement ?? null,
    supplement_safety: safety ?? [],
    caveats,
  };
}

/* ── misc reads ───────────────────────────────────────────────────────────── */

export async function getMeasurements(customerId: string, limit = 12) {
  const admin = createAdminClient();
  const { data } = await admin.from("measurements").select("*")
    .eq("customer_id", customerId).order("recorded_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  return data ?? [];
}

export async function getSupplements(customerId: string) {
  const admin = createAdminClient();
  const [{ data: schedule }, { data: safety }] = await Promise.all([
    admin.from("supplement_schedule").select("*").eq("customer_id", customerId),
    admin.from("customer_supplement_safety").select("*").eq("customer_id", customerId),
  ]);
  return { schedule: schedule ?? [], safety: safety ?? [] };
}

export async function getNotes(customerId: string, limit = 20) {
  const admin = createAdminClient();
  const { data } = await admin.from("coach_notes")
    .select("id, body, pinned, created_at").eq("customer_id", customerId)
    .order("pinned", { ascending: false }).order("created_at", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  return data ?? [];
}


