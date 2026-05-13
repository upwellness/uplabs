import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { classify, findMetric } from "@/lib/records/catalog";

/** List all records for customer (newest first, with value count) */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    const supa = createClient();
    const { data, error } = await supa.from("customer_records")
      .select("*, customer_lab_values(count)")
      .eq("customer_id", params.id)
      .order("recorded_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ records: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

/** Create new record + values (single transaction-ish: insert record then values) */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json();
    const { recorded_at, source, source_id, document_type, notes, raw_text, values } = body;
    if (!recorded_at) return NextResponse.json({ error: "recorded_at required" }, { status: 400 });

    const supa = createClient();
    const { data: record, error: recErr } = await supa.from("customer_records")
      .insert({
        customer_id:   params.id,
        recorded_at,
        source:        source ?? null,
        source_id:     source_id ?? null,
        document_type: document_type ?? "lab",
        notes:         notes ?? null,
        raw_text:      raw_text ?? null,
        created_by:    session.user.id,
      })
      .select()
      .single();
    if (recErr) throw recErr;

    if (Array.isArray(values) && values.length > 0) {
      const insertRows = values.map((v: any) => {
        const meta = findMetric(v.metric_key);
        const valueNum = typeof v.value === "number" ? v.value : Number(v.value);
        const isNum = !Number.isNaN(valueNum) && v.value != null && String(v.value).trim() !== "";
        const refLow  = v.ref_low  ?? meta?.ref_low  ?? null;
        const refHigh = v.ref_high ?? meta?.ref_high ?? null;
        const status = v.status ?? (isNum
          ? classify(valueNum, { ref_low: refLow ?? undefined, ref_high: refHigh ?? undefined })
          : "unknown");
        return {
          record_id:       record.id,
          customer_id:     params.id,
          category:        v.category ?? meta?.category ?? "other",
          metric_key:      v.metric_key,
          metric_label_th: v.metric_label_th ?? meta?.th ?? v.metric_key,
          metric_label_en: v.metric_label_en ?? meta?.en ?? "",
          value:           v.value != null ? String(v.value) : null,
          value_num:       isNum ? valueNum : null,
          unit:            v.unit  ?? meta?.unit ?? "",
          ref_low:         refLow,
          ref_high:        refHigh,
          ref_text:        v.ref_text ?? meta?.ref_text ?? null,
          status,
          recorded_at,
        };
      });
      const { error: valErr } = await supa.from("customer_lab_values").insert(insertRows);
      if (valErr) throw valErr;
    }

    return NextResponse.json({ record });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
