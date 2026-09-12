import * as XLSX from "xlsx";
import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk, apiError } from "@/lib/api/respond";
import { recomputeQuietly } from "@/lib/health-design/load";
import { parseCgmGrid, summariseRows, normaliseProfileName, MAX_ROWS } from "@/lib/api/cgm-import";
import { getProfileNames, ensureProfile, insertReadings } from "@/lib/api/cgm-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST …/cgm/import — load a CGM export (Ottai .xlsx/.csv) into the customer's history.
 *
 * Two request shapes:
 *   multipart/form-data   file=<xlsx|csv>  [profile_name=…]
 *   application/json      { rows: [[time, glucose], …], profile_name?: "…" }   (for callers that already parsed)
 *
 * Which profile the rows go to, in order:
 *   1. `profile_name` in the request — must already be one of the customer's profiles,
 *      OR the customer must have none yet (then it is created). A token cannot invent a
 *      second profile for a customer who already has one; that is how readings for two
 *      people ended up under one name in the past.
 *   2. the customer's first existing profile
 *   3. the customer's display name (new profile, created and attached)
 *
 * Re-uploading the same file is safe: rows already in the table are skipped, never
 * overwritten, and the response says how many were new.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "cgm:write");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    const cust = await getProfileNames(params.id);
    if (!cust) return apiError("not_found", "ไม่พบลูกค้ารายนี้");

    // ── read the payload into a cell grid ─────────────────────────────────────────
    let grid: unknown[][];
    let requested: string | null = null;
    let filename: string | null = null;
    const ctype = req.headers.get("content-type") ?? "";

    if (ctype.includes("multipart/form-data")) {
      let fd: FormData;
      try { fd = await req.formData(); } catch { return apiError("bad_request", "อ่าน multipart ไม่ได้"); }
      const file = fd.get("file");
      if (!(file instanceof File)) return apiError("bad_request", 'ต้องแนบไฟล์ในฟิลด์ "file"');
      if (file.size > MAX_BYTES) return apiError("bad_request", "ไฟล์เกิน 5 MB");
      filename = file.name;
      requested = normaliseProfileName(fd.get("profile_name"));
      const buf = Buffer.from(await file.arrayBuffer());
      let wb: XLSX.WorkBook;
      try { wb = XLSX.read(buf, { type: "buffer", cellDates: false, raw: true }); }
      catch { return apiError("bad_request", "เปิดไฟล์ไม่ได้ — ต้องเป็น .xlsx หรือ .csv"); }
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) return apiError("bad_request", "ไฟล์ไม่มีชีต");
      grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, blankrows: false }) as unknown[][];
    } else {
      let body: any;
      try { body = await req.json(); } catch { return apiError("bad_request", "ส่ง multipart (file=…) หรือ JSON {rows:[[time,glucose],…]}"); }
      if (!Array.isArray(body?.rows)) return apiError("bad_request", '"rows" ต้องเป็น array ของ [time, glucose]');
      if (body.rows.length > MAX_ROWS) return apiError("bad_request", `rows เกิน ${MAX_ROWS.toLocaleString()}`);
      requested = normaliseProfileName(body?.profile_name);
      grid = [["Time", "Glucose mg/dL"], ...body.rows];
    }

    // ── decide the profile name ───────────────────────────────────────────────────
    let profile: string;
    if (requested) {
      if (cust.profiles.length > 0 && !cust.profiles.includes(requested)) {
        return apiError("bad_request",
          `ลูกค้ารายนี้มีโปรไฟล์ CGM อยู่แล้ว (${cust.profiles.join(", ")}) — ต้องใช้ชื่อเดิม ไม่สร้างชื่อใหม่ซ้อน`,
          { existing_profiles: cust.profiles });
      }
      profile = requested;
    } else {
      profile = cust.profiles[0] ?? normaliseProfileName(cust.name) ?? params.id.slice(0, 8);
    }

    // ── parse (pure) ──────────────────────────────────────────────────────────────
    const parsed = parseCgmGrid(grid, profile);
    if (!parsed.ok) {
      return apiError("bad_request", parsed.error!, {
        parsed_rows: parsed.rows.length, rejected: parsed.rejected.slice(0, 20), header_row: parsed.header_row,
      });
    }

    // ── write ─────────────────────────────────────────────────────────────────────
    await ensureProfile(params.id, profile);
    const out = await insertReadings(parsed.rows);
    if ("error" in out) return apiError("internal_error", "บันทึกค่า CGM ไม่สำเร็จ");

    if (out.inserted > 0) await recomputeQuietly(params.id, "cgm_import");
    const summary = summariseRows(parsed.rows);
    return apiOk(
      {
        customer: { id: params.id, name: cust.name },
        profile_name: profile,
        profile_created: !cust.profiles.includes(profile),
        file: filename,
        unit_in_file: parsed.unit,
        parsed: summary,
        inserted: out.inserted,
        skipped_existing: out.skipped_existing,
        duplicates_in_file: parsed.duplicates_in_file,
        rejected_count: parsed.rejected.length,
        rejected: parsed.rejected.slice(0, 20),
        next: `GET /api/v1/customers/${params.id}/cgm/metrics?from=${summary.first?.slice(0, 10)}&to=${summary.last?.slice(0, 10)}`,
        message: out.inserted === 0
          ? "ทุกค่าในไฟล์มีอยู่ในระบบแล้ว ไม่มีอะไรใหม่"
          : `บันทึกใหม่ ${out.inserted.toLocaleString()} ค่า (ข้ามที่มีอยู่แล้ว ${out.skipped_existing.toLocaleString()})`,
      },
      { meta: { token: ctx.token.name, row_count: out.inserted } },
    );
  });
}
