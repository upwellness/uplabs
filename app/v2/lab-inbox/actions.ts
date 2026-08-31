"use server";

/**
 * Server actions for the lab review inbox.
 *
 * Approving is the moment AI-read numbers become part of a person's medical history,
 * so this file is deliberately strict: the reviewer's edited values are what gets
 * written (not the submission), the write is all-or-nothing, and the submission keeps
 * a record of who approved it and when.
 */
import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageCustomer } from "@/lib/customers/access";
import { normaliseSubmission, summarise, type NormalisedValue } from "@/lib/api/lab-import";

export interface PendingRow {
  id: string;
  customer_id: string;
  customer_name: string;
  recorded_at: string | null;
  source: string | null;
  notes: string | null;
  values: NormalisedValue[];
  raw_text: string | null;
  source_file_url: string | null;
  submitted_via: string | null;
  submitted_at: string;
  token_name: string | null;
  summary: string;
  warning_count: number;
}

async function requireReach(customerId: string) {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  const uid = session.user.id;
  const isAdmin = session.profile.role === "admin";

  const admin = createAdminClient();
  const { data: c } = await admin.from("customers").select("coach_id").eq("id", customerId).maybeSingle();
  if (!c) throw new Error("ไม่พบลูกค้ารายนี้");
  if (!isAdmin && (c as any).coach_id !== uid && !(await canManageCustomer(uid, customerId))) {
    throw new Error("ลูกค้ารายนี้ไม่ได้อยู่ในความดูแลของคุณ");
  }
  return { session, uid };
}

/** Everything waiting for this user, newest first. */
export async function listPending(): Promise<PendingRow[]> {
  const session = await getSession();
  if (!session) return [];
  const uid = session.user.id;
  const isAdmin = session.profile.role === "admin";
  const admin = createAdminClient();

  const { data: subs } = await admin
    .from("pending_lab_imports")
    .select("*")
    .eq("status", "pending")
    .order("submitted_at", { ascending: false })
    .limit(200);

  const rows = (subs ?? []) as any[];
  if (rows.length === 0) return [];

  const customerIds = [...new Set(rows.map((r) => r.customer_id))];
  const { data: customers } = await admin
    .from("customers").select("id, name, coach_id").in("id", customerIds);
  const custMap = new Map((customers ?? []).map((c: any) => [c.id, c]));

  // Narrow to what this user may act on. Done here rather than trusting RLS alone,
  // because the admin client bypasses it.
  let allowed: Set<string>;
  if (isAdmin) {
    allowed = new Set(customerIds);
  } else {
    allowed = new Set<string>();
    for (const id of customerIds) {
      const c = custMap.get(id);
      if (c && (c.coach_id === uid || (await canManageCustomer(uid, id)))) allowed.add(id);
    }
  }

  const tokenIds = [...new Set(rows.map((r) => r.token_id).filter(Boolean))];
  const tokenMap = new Map<string, string>();
  if (tokenIds.length) {
    const { data: toks } = await admin.from("api_tokens").select("id, name").in("id", tokenIds);
    for (const t of toks ?? []) tokenMap.set((t as any).id, (t as any).name);
  }

  return rows
    .filter((r) => allowed.has(r.customer_id))
    .map((r) => {
      const values = (Array.isArray(r.values) ? r.values : []) as NormalisedValue[];
      return {
        id: r.id,
        customer_id: r.customer_id,
        customer_name: custMap.get(r.customer_id)?.name ?? "—",
        recorded_at: r.recorded_at,
        source: r.source,
        notes: r.notes,
        values,
        raw_text: r.raw_text,
        source_file_url: r.source_file_url,
        submitted_via: r.submitted_via,
        submitted_at: r.submitted_at,
        token_name: r.token_id ? tokenMap.get(r.token_id) ?? null : null,
        summary: summarise(values),
        warning_count: values.reduce((n, v) => n + (v.warnings?.length ?? 0), 0),
      };
    });
}

/**
 * Approve a submission — the values the REVIEWER confirmed, not the ones submitted.
 *
 * `editedValues` is what is on screen at the moment they press the button. Writing
 * the original submission instead would make every correction the reviewer just made
 * silently pointless, which is the worst possible failure for a review step.
 */
export async function approveSubmission(
  id: string,
  editedValues: unknown,
  meta: { recorded_at: string; source?: string | null; notes?: string | null },
): Promise<{ ok: true; recordId: string } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const { data: sub } = await admin
      .from("pending_lab_imports").select("*").eq("id", id).maybeSingle();
    if (!sub) return { ok: false, error: "ไม่พบรายการนี้" };
    if ((sub as any).status !== "pending") return { ok: false, error: "รายการนี้ถูกตรวจไปแล้ว" };

    const { uid } = await requireReach((sub as any).customer_id);

    const norm = normaliseSubmission(editedValues);
    if (!norm.ok) return { ok: false, error: norm.error! };

    const customerId = (sub as any).customer_id as string;

    const { data: rec, error: recErr } = await admin.from("customer_records").insert({
      customer_id: customerId,
      recorded_at: meta.recorded_at,
      document_type: "lab",
      source: meta.source ?? (sub as any).source ?? "นำเข้าผ่าน API",
      notes: meta.notes ?? (sub as any).notes ?? null,
      // Provenance travels with the record: months later, "where did this come from?"
      // has an answer without digging through the queue table.
      raw_text: [
        (sub as any).raw_text,
        `— นำเข้าผ่าน ${(sub as any).submitted_via || "API"} และผ่านการตรวจสอบโดยผู้ใช้เมื่อ ${new Date().toISOString()}`,
      ].filter(Boolean).join("\n\n"),
      created_by: uid,
    }).select("id").single();
    if (recErr || !rec) return { ok: false, error: "สร้างใบตรวจไม่สำเร็จ" };

    const recordId = (rec as any).id as string;
    const rows = norm.values!.map((v) => ({
      record_id: recordId,
      customer_id: customerId,
      category: v.category,
      metric_key: v.metric_key,
      metric_label_th: v.metric_label_th,
      value: v.value,
      value_num: v.value_num,
      unit: v.unit,
      ref_low: v.ref_low,
      ref_high: v.ref_high,
      ref_text: v.ref_text,
      status: v.status,
      recorded_at: meta.recorded_at,
    }));

    const { error: valErr } = await admin.from("customer_lab_values").insert(rows);
    if (valErr) {
      // all-or-nothing: an empty visit left behind reads as "we tested and found nothing"
      await admin.from("customer_records").delete().eq("id", recordId);
      return { ok: false, error: "บันทึกค่าแล็บไม่สำเร็จ — ยกเลิกใบตรวจที่เพิ่งสร้างแล้ว" };
    }

    await admin.from("pending_lab_imports").update({
      status: "approved", reviewed_by: uid, reviewed_at: new Date().toISOString(), record_id: recordId,
    }).eq("id", id);

    revalidateTag("dashboard");
    revalidatePath("/v2/lab-inbox");
    return { ok: true, recordId };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "ยืนยันไม่สำเร็จ" };
  }
}

export async function rejectSubmission(id: string, note: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { data: sub } = await admin
      .from("pending_lab_imports").select("customer_id, status").eq("id", id).maybeSingle();
    if (!sub) return { ok: false, error: "ไม่พบรายการนี้" };
    if ((sub as any).status !== "pending") return { ok: false, error: "รายการนี้ถูกตรวจไปแล้ว" };

    const { uid } = await requireReach((sub as any).customer_id);
    await admin.from("pending_lab_imports").update({
      status: "rejected", reviewed_by: uid, reviewed_at: new Date().toISOString(),
      review_note: (note ?? "").trim().slice(0, 500) || null,
    }).eq("id", id);

    revalidatePath("/v2/lab-inbox");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "ทำรายการไม่สำเร็จ" };
  }
}
