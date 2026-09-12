import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk, apiError } from "@/lib/api/respond";
import { normaliseProfileName, MAX_ROWS } from "@/lib/api/cgm-import";
import { gridFromFile, importCgmForCustomer } from "@/lib/api/cgm-import-flow";
import { recomputeQuietly } from "@/lib/health-design/load";

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
 * Profile rule and the write itself live in lib/api/cgm-import-flow.ts (shared with the
 * customer portal). Re-uploading the same file is safe: existing rows are skipped.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "cgm:write");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    let grid: unknown[][] | null = null;
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
      grid = gridFromFile(Buffer.from(await file.arrayBuffer()));
      if (!grid) return apiError("bad_request", "เปิดไฟล์ไม่ได้ — ต้องเป็น .xlsx หรือ .csv ที่มีชีต");
    } else {
      let body: any;
      try { body = await req.json(); } catch { return apiError("bad_request", "ส่ง multipart (file=…) หรือ JSON {rows:[[time,glucose],…]}"); }
      if (!Array.isArray(body?.rows)) return apiError("bad_request", '"rows" ต้องเป็น array ของ [time, glucose]');
      if (body.rows.length > MAX_ROWS) return apiError("bad_request", `rows เกิน ${MAX_ROWS.toLocaleString()}`);
      requested = normaliseProfileName(body?.profile_name);
      grid = [["Time", "Glucose mg/dL"], ...body.rows];
    }

    const out = await importCgmForCustomer(params.id, grid, requested, filename);
    if (!out.ok) return apiError(out.status === 404 ? "not_found" : out.status === 500 ? "internal_error" : "bad_request", out.error, out.extra);
    if ((out.result.inserted as number) > 0) await recomputeQuietly(params.id, "cgm_import");
    return apiOk(out.result, { meta: { token: ctx.token.name, row_count: out.result.inserted as number } });
  });
}
