import { withApi, requireScope, assertCustomerInScope, visibleCustomerIds, type ApiContext } from "@/lib/api/auth";
import { apiError, apiOk, DISCLAIMER } from "@/lib/api/respond";
import { resolveIntent, findIntent, intentCatalogue } from "@/lib/api/resolver";
import {
  getCustomer, searchCustomers, getLabRounds, getLabRoundsDetailed, buildCompare, getOverview,
  getMeasurements, getSupplements, getNotes, ageFrom,
} from "@/lib/api/data";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Scope } from "@/lib/api/scopes";
import { getProfileNames, getReadings, latestDate, shiftDate, todayBangkok, toPoints } from "@/lib/api/cgm-data";
import { computeMetrics, TARGETS } from "@/lib/api/cgm-metrics";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/query — a sentence in, data out.
 *
 * Deliberately NOT an LLM (docs/SPEC-External-API.md §5). The resolver is rules, so
 * the same sentence always produces the same lookup, and every number in the reply
 * came straight out of Postgres.
 *
 * The one place this refuses to guess is identity. Near-identical customer names do
 * occur in this database, and answering the wrong one means handing over the wrong
 * person's health record. So a name that resolves to more than one customer returns
 * the candidates and stops, rather than picking the closest match.
 */
export async function POST(req: Request) {
  return withApi(req, async (ctx) => {
    let body: any;
    try { body = await req.json(); } catch { return apiError("bad_request", "body ต้องเป็น JSON"); }

    const q = typeof body?.q === "string" ? body.q : "";
    const forcedIntent = typeof body?.intent === "string" ? body.intent : null;
    const givenCustomerId = typeof body?.customer_id === "string" ? body.customer_id : null;

    if (!q.trim() && !forcedIntent) {
      return apiError("bad_request", 'ต้องส่ง "q" (คำสั่ง) หรือ "intent" อย่างน้อยหนึ่งอย่าง', {
        intents: intentCatalogue(),
      });
    }

    ctx.q = q;
    const r = resolveIntent(q, forcedIntent);

    if (!r.intent) {
      return apiError("unknown_intent", "ไม่เข้าใจคำสั่งนี้ — เลือก intent จากรายการแล้วส่งมาใหม่", {
        q, alternatives: r.alternatives, intents: intentCatalogue(),
      });
    }

    const def = findIntent(r.intent)!;
    ctx.intent = r.intent;

    const scopeErr = requireScope(ctx, def.scope as Scope);
    if (scopeErr) return scopeErr;

    // ── resolve WHO, if the intent needs one ────────────────────────────────
    let customerId: string | null = givenCustomerId;
    if (def.needsCustomer && !customerId) {
      if (!r.nameQuery) {
        return apiError("bad_request", "ไม่รู้ว่าถามถึงลูกค้าคนไหน — ใส่ customer_id หรือระบุชื่อในคำสั่ง", {
          intent: r.intent,
        });
      }
      const visible = await visibleCustomerIds(ctx);
      const matches = await searchCustomers(r.nameQuery, visible, 10);

      if (matches.length === 0) {
        return apiError("not_found", `ไม่พบลูกค้าที่ชื่อใกล้เคียง "${r.nameQuery}"`, { searched_for: r.nameQuery });
      }
      // An exact full-name match beats a substring one. Without this, any customer
      // whose name *contains* another customer's name makes the shorter name
      // permanently unanswerable. Two identical names still disambiguate.
      const exact = matches.filter((c) => c.name.trim().toLowerCase() === r.nameQuery!.trim().toLowerCase());
      if (exact.length === 1) {
        customerId = exact[0].id;
      } else if (matches.length > 1) {
        return apiError("needs_disambiguation", "พบลูกค้าที่ชื่อใกล้เคียงมากกว่า 1 คน — ระบุ customer_id ให้ชัด", {
          searched_for: r.nameQuery,
          candidates: matches.map((c) => ({
            id: c.id, name: c.name, birth_date: c.birth_date, age: ageFrom(c.birth_date),
          })),
          next_step: "เรียกซ้ำโดยใส่ customer_id ที่ต้องการ",
        });
      } else {
        customerId = matches[0].id;
      }
    }

    if (customerId) {
      const outOfScope = await assertCustomerInScope(ctx, customerId);
      if (outOfScope) return outOfScope;
      ctx.customerId = customerId;
    }

    const customer = customerId ? await getCustomer(customerId) : null;
    const envelope = (data: unknown, rowCount: number, clinical = true) =>
      apiOk(data, {
        clinical,
        meta: { token: ctx.token.name, row_count: rowCount },
        extra: {
          intent: r.intent,
          confidence: r.confidence,
          understood_as: def.describe(r.params, customer?.name),
          params: { ...r.params, customer_id: customerId ?? undefined },
          alternatives: r.alternatives,
        },
      });

    switch (r.intent) {
      case "customer.find": {
        const visible = await visibleCustomerIds(ctx);
        const list = await searchCustomers(r.params.q || r.nameQuery || "", visible, 20);
        return envelope(list.map((c) => ({ ...c, age: ageFrom(c.birth_date) })), list.length, false);
      }

      case "customer.profile": {
        const rounds = await getLabRounds(customerId!, 1);
        return envelope({
          customer: { ...customer, age: ageFrom(customer?.birth_date ?? null) },
          latest_lab_date: rounds[0]?.recorded_at ?? null,
          lab_value_count: rounds[0]?.values.length ?? 0,
        }, 1, false);
      }

      case "labs.latest": {
        const rounds = await getLabRounds(customerId!, 1);
        if (!rounds.length) return envelope({ customer, rounds: [], message: "ยังไม่มีผลแล็บในระบบ" }, 0);
        return envelope({ customer, round: rounds[0] }, rounds[0].values.length);
      }

      case "labs.compare": {
        const { rounds, skipped, total_available } =
          await getLabRoundsDetailed(customerId!, r.params.rounds ?? 3, { minValues: 2 });
        if (rounds.length === 0) return envelope({ customer, rounds: [], message: "ยังไม่มีผลแล็บในระบบ" }, 0);
        const cmp = buildCompare(rounds);
        return envelope({
          customer, ...cmp, skipped_rounds: skipped, total_visits_on_record: total_available,
          ...(skipped.length ? { skipped_note: "รอบที่มีค่าเดียว (มักเป็นค่าที่วัดเองที่บ้าน) ไม่ถูกนับเป็นรอบเทียบ" } : {}),
        }, cmp.metrics.length);
      }

      case "labs.metric": {
        const key = r.params.metric;
        if (!key) return apiError("bad_request", "ไม่รู้ว่าถามถึงค่าตัวไหน — ระบุชื่อค่า เช่น HbA1c, LDL");
        const admin = createAdminClient();
        const { data } = await admin.from("customer_lab_values")
          .select("metric_key, metric_label_th, value, value_num, unit, status, ref_text, recorded_at")
          .eq("customer_id", customerId!).eq("metric_key", key)
          .order("recorded_at", { ascending: true });
        return envelope({ customer, metric: key, series: data ?? [] }, (data ?? []).length);
      }

      case "labs.abnormal": {
        const ov = await getOverview(customerId!);
        return envelope({
          customer, latest_visit: ov.latest_visit, abnormal: ov.abnormal,
          never_tested: ov.never_tested, caveats: ov.caveats,
        }, ov.abnormal.length);
      }

      case "overview.longevity": {
        const ov = await getOverview(customerId!);
        return envelope({ customer: { ...customer, age: ageFrom(customer?.birth_date ?? null) }, ...ov },
          Object.keys(ov.latest_by_category).length);
      }

      case "measurements.list": {
        const rows = await getMeasurements(customerId!, 12);
        return envelope({ customer, measurements: rows }, rows.length);
      }

      case "cgm.metrics": {
        const p = await getProfileNames(customerId!);
        const profiles = p?.profiles ?? [];
        const end = (await latestDate(profiles)) ?? todayBangkok();
        const from = shiftDate(end, -13);
        const rows = await getReadings(profiles, from, end);
        const m = computeMetrics(toPoints(rows));
        if (profiles.length === 0) m.caveats.unshift("ลูกค้ารายนี้ยังไม่มีข้อมูล CGM — ใช้คำสั่ง importCgmFile ก่อน");
        return envelope({ customer, profiles, window: { from, to: end }, metrics: m, targets: TARGETS }, rows.length);
      }

      case "cgm.import": {
        // /query carries text, not files. Point the caller at the real endpoint and
        // say which shape works from where they are calling.
        return apiError("bad_request",
          "การนำเข้าไฟล์ CGM ต้องเรียก importCgmFile โดยตรง ไม่ผ่านคำสั่งภาษาคน — ChatGPT/Gemini: แกะไฟล์ .xlsx ด้วย code interpreter ให้ได้ [[เวลา, ค่าน้ำตาล], …] แล้วส่ง JSON {rows:[…]} · ระบบอื่น: ส่ง multipart file=",
          { use_operation: "importCgmFile", customer_id: customerId,
            json_shape: { rows: [["2026-09-11 19:08", 83], ["2026-09-11 19:03", 77]] },
            note: "เวลาในไฟล์ถือเป็นเวลาไทย · ไม่ต้องส่ง profile_name ถ้าลูกค้ามีโปรไฟล์อยู่แล้ว" });
      }

      case "supplements.list": {
        const s = await getSupplements(customerId!);
        return envelope({ customer, ...s }, s.schedule.length + s.safety.length);
      }

      case "notes.list": {
        const rows = await getNotes(customerId!, 20);
        return envelope({ customer, notes: rows }, rows.length);
      }

      case "notes.add": {
        const text = (r.params.body || "").trim();
        if (!text) {
          return apiError("bad_request", 'ไม่พบเนื้อความโน้ต — เขียนต่อท้ายด้วย "ว่า …" หรือส่ง intent + body มาตรง ๆ');
        }
        const admin = createAdminClient();
        const { data, error } = await admin.from("coach_notes")
          .insert({ customer_id: customerId!, body: text, pinned: false })
          .select("id, body, pinned, created_at").single();
        if (error) return apiError("internal_error", "บันทึกโน้ตไม่สำเร็จ");
        return envelope({ customer, note: data, created: true }, 1, false);
      }

      case "links.invite": {
        const base = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
        if (!base) return apiError("internal_error", "ระบบยังไม่ได้ตั้งค่า NEXT_PUBLIC_SITE_URL");
        return envelope({
          message: "สร้างลิงก์เชิญได้ที่หน้าเว็บ (ต้องผูกกับผู้เชิญที่เป็นคนจริง)",
          invite_page: `${base}/v2/invite`,
          note: "API ไม่ออก invite token ให้โดยตรง เพราะลิงก์เชิญผูกสายงาน (upline) ของผู้สร้าง จึงต้องรู้ว่าใครเป็นคนเชิญ",
        }, 1, false);
      }
    }

    return apiError("unknown_intent", "intent นี้ยังไม่รองรับ", { intent: r.intent });
  });
}

export async function GET() {
  return apiError("method_not_allowed", "ใช้ POST พร้อม body { q, customer_id?, intent? }", {
    disclaimer: DISCLAIMER,
  });
}
