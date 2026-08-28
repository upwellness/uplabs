import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk, apiError } from "@/lib/api/respond";
import { getCustomer, getLabRounds } from "@/lib/api/data";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** GET …/labs?rounds=3&metric=hba1c */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "labs:read");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    const url = new URL(req.url);
    const metric = url.searchParams.get("metric");
    const rounds = Number(url.searchParams.get("rounds") ?? 3);
    const customer = await getCustomer(params.id);

    if (metric) {
      const { data } = await createAdminClient().from("customer_lab_values")
        .select("metric_key, metric_label_th, value, value_num, unit, status, ref_text, recorded_at")
        .eq("customer_id", params.id).eq("metric_key", metric)
        .order("recorded_at", { ascending: true });
      return apiOk({ customer, metric, series: data ?? [] },
        { clinical: true, meta: { token: ctx.token.name, row_count: (data ?? []).length } });
    }

    const list = await getLabRounds(params.id, rounds);
    return apiOk({ customer, rounds: list },
      { clinical: true, meta: { token: ctx.token.name, row_count: list.reduce((n, r) => n + r.values.length, 0) } });
  });
}

/**
 * POST …/labs — one visit plus its values, written together.
 * `customer_lab_values.record_id` is NOT NULL, so the record row must exist first;
 * if the values fail we delete the record rather than leave an empty visit behind.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "labs:write");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    let body: any;
    try { body = await req.json(); } catch { return apiError("bad_request", "body ต้องเป็น JSON"); }

    const recordedAt = typeof body?.recorded_at === "string" ? body.recorded_at : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recordedAt)) {
      return apiError("bad_request", 'ต้องมี "recorded_at" รูปแบบ YYYY-MM-DD (ปี ค.ศ.)');
    }
    const values = Array.isArray(body?.values) ? body.values : [];
    if (values.length === 0) return apiError("bad_request", 'ต้องมี "values" อย่างน้อย 1 รายการ');

    for (const v of values) {
      if (!v || typeof v.metric_key !== "string" || v.value === undefined) {
        return apiError("bad_request", "แต่ละค่าต้องมี metric_key และ value");
      }
    }

    const admin = createAdminClient();
    const { data: rec, error: recErr } = await admin.from("customer_records").insert({
      customer_id: params.id,
      recorded_at: recordedAt,
      document_type: "lab",
      source: body?.source ?? "External API",
      notes: body?.notes ?? null,
      raw_text: body?.raw_text ?? null,
    }).select("id").single();
    if (recErr || !rec) return apiError("bad_request", "สร้างใบตรวจไม่สำเร็จ");

    const rows = values.map((v: any) => ({
      record_id: (rec as any).id,
      customer_id: params.id,
      category: v.category ?? "other",
      metric_key: v.metric_key,
      metric_label_th: v.metric_label_th ?? null,
      value: String(v.value),
      value_num: v.value_num ?? (Number.isFinite(Number(v.value)) ? Number(v.value) : null),
      unit: v.unit ?? null,
      ref_low: v.ref_low ?? null,
      ref_high: v.ref_high ?? null,
      ref_text: v.ref_text ?? null,
      status: v.status ?? "normal",
      recorded_at: recordedAt,
    }));

    const { error: valErr } = await admin.from("customer_lab_values").insert(rows);
    if (valErr) {
      await admin.from("customer_records").delete().eq("id", (rec as any).id);
      return apiError("bad_request", "บันทึกค่าแล็บไม่สำเร็จ — ยกเลิกใบตรวจที่เพิ่งสร้างแล้ว");
    }

    return apiOk({ record_id: (rec as any).id, recorded_at: recordedAt, inserted: rows.length },
      { meta: { token: ctx.token.name, row_count: rows.length } });
  });
}
