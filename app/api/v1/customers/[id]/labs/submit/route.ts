import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk, apiError } from "@/lib/api/respond";
import { getCustomer } from "@/lib/api/data";
import { normaliseSubmission, validateDrawDate, summarise } from "@/lib/api/lab-import";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST …/labs/submit — queue a lab result for human review.
 *
 * This is the endpoint an AI assistant that just read a lab slip should use. It does
 * NOT write to the patient record; it writes to `pending_lab_imports`, and a person
 * compares the values against the actual document before they become history.
 *
 * `POST …/labs` (scope labs:write) still writes directly, for automation that is
 * moving already-verified data — a hospital export, a migration. The two scopes exist
 * so a token can be trusted to *offer* values without being trusted to *record* them.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "labs:submit");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    let body: any;
    try { body = await req.json(); } catch { return apiError("bad_request", "body ต้องเป็น JSON"); }

    const date = validateDrawDate(body?.recorded_at);
    if (!date.ok) return apiError("bad_request", date.error!);

    const norm = normaliseSubmission(body?.values);
    if (!norm.ok) return apiError("bad_request", norm.error!);

    const admin = createAdminClient();
    const { data, error } = await admin.from("pending_lab_imports").insert({
      customer_id: params.id,
      recorded_at: date.value,
      source: typeof body?.source === "string" ? body.source.trim().slice(0, 200) : null,
      notes: typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : null,
      values: norm.values,
      // The verbatim read matters as much as the structured values: comparing it to
      // the real slip is how a reviewer catches a row read one line off.
      raw_text: typeof body?.raw_text === "string" ? body.raw_text.slice(0, 20000) : null,
      source_file_url: typeof body?.source_file_url === "string" ? body.source_file_url.slice(0, 1000) : null,
      submitted_via: typeof body?.submitted_via === "string" ? body.submitted_via.slice(0, 60) : null,
      token_id: ctx.token.id,
    }).select("id, submitted_at").single();

    if (error) return apiError("internal_error", "ส่งเข้าคิวไม่สำเร็จ");

    const customer = await getCustomer(params.id);
    return apiOk({
      queued: true,
      submission_id: (data as any).id,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      summary: summarise(norm.values!),
      warnings: norm.warnings,
      status: "pending",
      message:
        "ส่งเข้าคิวรอตรวจสอบแล้ว — ยังไม่ได้บันทึกลงประวัติลูกค้า · " +
        "ต้องให้คนเปิดดูเทียบกับใบจริงแล้วกดยืนยันก่อน จึงจะเข้าโปรไฟล์",
      review_url: `${(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "")}/v2/lab-inbox`,
    }, { meta: { token: ctx.token.name, row_count: norm.values!.length } });
  });
}
