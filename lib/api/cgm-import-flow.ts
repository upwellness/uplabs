/**
 * The CGM import decision + write, shared by the External API route and the customer
 * portal. Given a cell grid (from an .xlsx/.csv or JSON rows) and the customer, pick the
 * profile, parse, insert, and describe what happened.
 */
import * as XLSX from "xlsx";
import { parseCgmGrid, summariseRows, normaliseProfileName } from "./cgm-import";
import { getProfileNames, ensureProfile, insertReadings } from "./cgm-data";

export type ImportOutcome =
  | { ok: false; status: 400 | 404 | 500; error: string; extra?: Record<string, unknown> }
  | { ok: true; result: Record<string, unknown> };

/** .xlsx / .csv bytes → cell grid (first sheet). */
export function gridFromFile(buf: Buffer): unknown[][] | null {
  try {
    const wb = XLSX.read(buf, { type: "buffer", cellDates: false, raw: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return null;
    return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, blankrows: false }) as unknown[][];
  } catch { return null; }
}

export async function importCgmForCustomer(customerId: string, grid: unknown[][], requested: string | null, filename: string | null): Promise<ImportOutcome> {
  const cust = await getProfileNames(customerId);
  if (!cust) return { ok: false, status: 404, error: "ไม่พบลูกค้ารายนี้" };

  let profile: string;
  if (requested) {
    if (cust.profiles.length > 0 && !cust.profiles.includes(requested)) {
      return { ok: false, status: 400, error: `ลูกค้ารายนี้มีโปรไฟล์ CGM อยู่แล้ว (${cust.profiles.join(", ")}) — ต้องใช้ชื่อเดิม ไม่สร้างชื่อใหม่ซ้อน`, extra: { existing_profiles: cust.profiles } };
    }
    profile = requested;
  } else {
    profile = cust.profiles[0] ?? normaliseProfileName(cust.name) ?? customerId.slice(0, 8);
  }

  const parsed = parseCgmGrid(grid, profile);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error!, extra: { parsed_rows: parsed.rows.length, rejected: parsed.rejected.slice(0, 20), header_row: parsed.header_row } };

  await ensureProfile(customerId, profile);
  const out = await insertReadings(parsed.rows);
  if ("error" in out) return { ok: false, status: 500, error: "บันทึกค่า CGM ไม่สำเร็จ" };

  const summary = summariseRows(parsed.rows);
  return { ok: true, result: {
    customer: { id: customerId, name: cust.name }, profile_name: profile, profile_created: !cust.profiles.includes(profile), file: filename,
    unit_in_file: parsed.unit, parsed: summary, inserted: out.inserted, skipped_existing: out.skipped_existing,
    duplicates_in_file: parsed.duplicates_in_file, rejected_count: parsed.rejected.length, rejected: parsed.rejected.slice(0, 20),
    next: `GET /api/v1/customers/${customerId}/cgm/metrics?from=${summary.first?.slice(0, 10)}&to=${summary.last?.slice(0, 10)}`,
    message: out.inserted === 0 ? "ทุกค่าในไฟล์มีอยู่ในระบบแล้ว ไม่มีอะไรใหม่" : `บันทึกใหม่ ${out.inserted.toLocaleString()} ค่า (ข้ามที่มีอยู่แล้ว ${out.skipped_existing.toLocaleString()})`,
  } };
}
