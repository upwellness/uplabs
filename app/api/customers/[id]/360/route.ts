import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer, isDownlineCustomer } from "@/lib/customers/access";
import { healthScore } from "@/lib/customers/health-score";
import { phenoPrefillFromLabs, estimatePhenoAge, PHENO_MARKER_TH } from "@/lib/bio-age";
import { classifyStatus } from "@/lib/customers/status-classifier";
import { generateInsights } from "@/lib/customers/insight-rules";
import { deriveChronoAge } from "@/lib/bca-derive";

/**
 * Customer 360 aggregated endpoint
 * ─────────────────────────────────
 * One call returns everything needed for the landing view:
 *   - customer info
 *   - latest BCA + history
 *   - latest lab values + history
 *   - allergy summary
 *   - activity timeline (90 days)
 *   - computed: health score · status · insights
 */

const daysSince = (d: string | null | undefined): number | null => {
  if (!d) return null;
  const ms = Date.now() - new Date(d).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const admin = createAdminClient();

    // Verify customer access
    const { data: customer } = await admin
      .from("customers")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (!customer) return NextResponse.json({ error: "not found" }, { status: 404 });

    const isAdmin = session.profile.role === "admin";
    if (
      !isAdmin &&
      customer.coach_id !== session.user.id &&
      !(await isAssignedToCustomer(session.user.id, params.id)) &&
      !(await isDownlineCustomer(session.user.id, params.id)) // upline read-only visibility
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Parallel fetch
    const [
      { data: bcaLatest },
      { data: bcaHistory },
      { count: bcaCount },
      { data: labLatest },
      { data: labHistory },
      { data: phenoRows },
      { data: latestRecord },
      { data: allergyTests },
      { data: supplementSafety },
      { count: pulseCount },
      { data: latestPulse },
      { data: latestIntake },
      { data: assessmentsList },
    ] = await Promise.all([
      admin.from("measurements").select("*").eq("customer_id", params.id).order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("measurements").select("recorded_at, weight, fat_pct, muscle_pct, visceral, body_age").eq("customer_id", params.id).order("recorded_at", { ascending: false }).limit(12),
      admin.from("measurements").select("*", { count: "exact", head: true }).eq("customer_id", params.id),
      admin.from("customer_lab_values")
        .select("metric_key, value, value_num, unit, status, recorded_at")
        .eq("customer_id", params.id)
        .in("metric_key", ["hba1c", "fbs", "ldl", "hdl", "triglyceride", "alt", "ast"])
        .order("recorded_at", { ascending: false })
        .limit(50),
      admin.from("customer_lab_values").select("metric_key, value_num, recorded_at").eq("customer_id", params.id).order("recorded_at", { ascending: true }).limit(200),
      // PhenoAge (Health Age) markers — newest-first so phenoPrefillFromLabs takes the latest per marker
      admin.from("customer_lab_values")
        .select("metric_key, value_num, unit, recorded_at")
        .eq("customer_id", params.id)
        .in("metric_key", ["albumin", "creatinine", "fbs", "hs_crp", "crp", "hscrp", "lymphocytes", "lymphocyte", "mcv", "rdw", "alp", "wbc"])
        .order("recorded_at", { ascending: false })
        .limit(80),
      admin.from("customer_records").select("recorded_at, source, document_type, notes, source_id").eq("customer_id", params.id).order("recorded_at", { ascending: false }).limit(10),
      admin.from("customer_allergy_tests").select("id, test_type, test_lab, tested_at, panel_size").eq("customer_id", params.id).order("tested_at", { ascending: false }).limit(1),
      admin.from("customer_supplement_safety").select("status, product_th, product_key, conflicting_ingredients").eq("customer_id", params.id),
      admin.from("pulse_assessments").select("*", { count: "exact", head: true }).eq("customer_id", params.id),
      admin.from("pulse_assessments").select("id, status, blocked, share_token, sent_at, created_at, ai_output").eq("customer_id", params.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("pulse_intakes").select("submitted_at, goal, budget_range").eq("customer_id", params.id).not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("pulse_assessments").select("id, status, blocked, share_token, sent_at, created_at, ai_output").eq("customer_id", params.id).order("created_at", { ascending: false }).limit(10),
    ]);

    // ─── Derive latest values per lab metric ───
    const latestByMetric = new Map<string, { value_num: number | null; recorded_at: string }>();
    for (const row of labLatest ?? []) {
      if (!latestByMetric.has(row.metric_key)) {
        latestByMetric.set(row.metric_key, { value_num: row.value_num, recorded_at: row.recorded_at });
      }
    }

    const labVals = {
      hba1c:        latestByMetric.get("hba1c")?.value_num ?? null,
      fbs:          latestByMetric.get("fbs")?.value_num ?? null,
      ldl:          latestByMetric.get("ldl")?.value_num ?? null,
      hdl:          latestByMetric.get("hdl")?.value_num ?? null,
      triglyceride: latestByMetric.get("triglyceride")?.value_num ?? null,
      alt:          latestByMetric.get("alt")?.value_num ?? null,
      ast:          latestByMetric.get("ast")?.value_num ?? null,
    };

    // ─── Recency days ───
    const bcaLapseDays = daysSince(bcaLatest?.recorded_at);
    const labLapseDays = daysSince(latestRecord?.[0]?.recorded_at);
    // Order proxy: most recent record + pulse activity (we don't have orders table yet)
    const lastEventTimes = [bcaLatest?.recorded_at, latestRecord?.[0]?.recorded_at, latestIntake?.submitted_at, latestPulse?.created_at].filter(Boolean) as string[];
    const lastTouch = lastEventTimes.length > 0 ? lastEventTimes.sort().pop() : null;
    const orderLapseDays = daysSince(lastTouch);

    // ─── Allergy conflict count ───
    const allergyConflicts = (supplementSafety ?? []).filter(s => s.status === "avoid").length;

    // ─── Lab trend history (last 3 per metric · sorted asc) ───
    const trendByMetric = new Map<string, number[]>();
    for (const row of labHistory ?? []) {
      if (row.value_num == null) continue;
      const arr = trendByMetric.get(row.metric_key) ?? [];
      arr.push(row.value_num);
      trendByMetric.set(row.metric_key, arr);
    }
    const last3 = (arr: number[] | undefined) => arr ? arr.slice(-3) : [];

    // ─── Health Score ───
    // Day-accurate age from birth_date (falls back to birth_year inside deriveChronoAge);
    // this keeps body-age classification aligned with the identity age shown in the UI.
    const chronoAge =
      deriveChronoAge(customer.birth_date ?? customer.birth_year, new Date().toISOString())
      ?? (customer.birth_year ? new Date().getFullYear() - customer.birth_year : null);
    const score = healthScore({
      bca: bcaLatest ? {
        visceral:   bcaLatest.visceral,
        fat_pct:    bcaLatest.fat_pct,
        body_age:   bcaLatest.body_age,
        chrono_age: chronoAge,
        gender:     customer.gender,
      } : undefined,
      lab: labVals,
      recency: { bca_days: bcaLapseDays, lab_days: labLapseDays, order_days: orderLapseDays },
    });

    // ─── Health Age (PhenoAge · Levine 2018) — big score #2 · hybrid mode C ───
    // Needs age + glucose real; missing secondary markers are imputed with a healthy
    // reference and the result is flagged ≈ ประมาณการ. Too many gaps → "ตรวจเพิ่ม".
    const phenoPrefill = phenoPrefillFromLabs(phenoRows ?? [], chronoAge);
    const est = estimatePhenoAge(phenoPrefill.input, customer.gender);
    // ★ Big-score gate (Ton's call): show a number ONLY when the discriminating markers
    // CRP + RDW are REAL. Imputing them makes an obese/unhealthy-but-clean-CBC person look
    // young; requiring them keeps the headline honest and nudges the customer to test.
    const keyReal = est.computable && !est.imputed.includes("crp") && !est.imputed.includes("rdw");
    let bioAge: any;
    if (est.computable && est.result && keyReal) {
      bioAge = { computable: true, complete: est.confidence === "full", confidence: est.confidence,
        chronoAge, phenoAge: est.result.phenoAge, delta: est.result.delta, level: est.result.level,
        mortalityPct: est.result.mortalityPct, acuteFlag: est.result.acuteFlag,
        imputedCount: est.imputed.length, imputedLabels: est.imputedLabels, crpImputed: est.crpImputed,
        missing: [] as string[] };
    } else {
      const needKey = est.computable && !keyReal; // has age+glucose but is missing CRP/RDW
      bioAge = { computable: false, complete: false, chronoAge,
        reason: needKey ? "ต้องมีผล CRP + RDW จริงก่อน (ตัวชี้วัดหลัก เดาแทนไม่ได้)" : est.reason,
        presentCount: phenoPrefill.present.length,
        missing: phenoPrefill.missing.map((m) => PHENO_MARKER_TH[m] ?? m) };
    }

    // ─── Score delta vs previous BCA (if exists) ───
    let scoreDelta: number | null = null;
    let scoreDeltaReason: string | null = null;
    if (bcaHistory && bcaHistory.length >= 2) {
      const prev = bcaHistory[1]; // [0]=latest, [1]=previous
      const prevScore = healthScore({
        bca: { visceral: prev.visceral, fat_pct: prev.fat_pct, body_age: prev.body_age, chrono_age: chronoAge, gender: customer.gender },
        lab: labVals,  // lab unchanged · best proxy
        recency: { bca_days: bcaLapseDays, lab_days: labLapseDays, order_days: orderLapseDays },
      });
      if (score.total != null && prevScore.total != null) {
        scoreDelta = score.total - prevScore.total;
        // Determine main driver of change
        if (bcaLatest && prev) {
          const visceralChange = (bcaLatest.visceral ?? 0) - (prev.visceral ?? 0);
          const weightChange   = (bcaLatest.weight ?? 0)   - (prev.weight ?? 0);
          const fatChange      = (bcaLatest.fat_pct ?? 0)  - (prev.fat_pct ?? 0);
          if (Math.abs(visceralChange) >= 1) {
            scoreDeltaReason = `Visceral ${visceralChange < 0 ? "ลด" : "เพิ่ม"} ${Math.abs(visceralChange)} ระดับ`;
          } else if (Math.abs(weightChange) >= 1) {
            scoreDeltaReason = `น้ำหนัก ${weightChange < 0 ? "ลด" : "เพิ่ม"} ${Math.abs(weightChange).toFixed(1)} kg`;
          } else if (Math.abs(fatChange) >= 0.5) {
            scoreDeltaReason = `Fat% ${fatChange < 0 ? "ลด" : "เพิ่ม"} ${Math.abs(fatChange).toFixed(1)}%`;
          } else {
            scoreDeltaReason = "การเปลี่ยนแปลงเล็กน้อย";
          }
        }
      }
    }

    // ─── Insights ───
    const weightHistory = (bcaHistory ?? []).map(b => b.weight).filter((w): w is number => w != null).reverse().slice(-3);
    const visceralHistory = (bcaHistory ?? []).map(b => b.visceral).filter((v): v is number => v != null).reverse().slice(-3);

    const insights = generateInsights({
      ...labVals,
      visceral: bcaLatest?.visceral ?? null,
      bcaLapseDays,
      labLapseDays,
      orderLapseDays,
      hba1cHistory: last3(trendByMetric.get("hba1c")),
      ldlHistory:   last3(trendByMetric.get("ldl")),
      visceralHistory,
      weightHistory,
      hasAllergyConflict: allergyConflicts > 0,
      allergyConflictCount: allergyConflicts,
      inActiveProgram: false,  // TODO: derive from program table when exists
      customerId: params.id,
    });

    // ─── Status badge ───
    const status = classifyStatus({
      hasCriticalAlert: insights.hasCriticalAlert,
      inActiveProgram: false,
      orderLapseDays,
      bcaLapseDays,
      daysSinceCreated: daysSince(customer.created_at),
      recordCount: bcaCount ?? 0,
      healthScoreTotal: score.total,
    });

    // ─── Activity Timeline (last 90 days · combined) ───
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const timeline: Array<{ type: string; icon: string; date: string; title: string; href?: string }> = [];

    for (const m of bcaHistory ?? []) {
      if (new Date(m.recorded_at).getTime() < cutoff) continue;
      timeline.push({
        type: "bca",
        icon: "📊",
        date: m.recorded_at,
        title: `BCA · ${m.weight ?? "?"} kg · Fat ${m.fat_pct ?? "?"}% · Visceral ${m.visceral ?? "?"}`,
        href: `/bca`,
      });
    }
    for (const r of latestRecord ?? []) {
      if (new Date(r.recorded_at).getTime() < cutoff) continue;
      timeline.push({
        type: "record",
        icon: "🧾",
        date: r.recorded_at,
        title: `${r.source ?? "Lab"} · ${r.document_type ?? "lab"}`,
      });
    }
    if (allergyTests?.[0] && new Date(allergyTests[0].tested_at).getTime() >= cutoff) {
      timeline.push({
        type: "allergy",
        icon: "🧪",
        date: allergyTests[0].tested_at,
        title: `${allergyTests[0].test_type} · ${allergyTests[0].test_lab ?? ""} · ${allergyTests[0].panel_size ?? "?"} foods`,
      });
    }
    if (latestPulse && new Date(latestPulse.created_at).getTime() >= cutoff) {
      timeline.push({
        type: "pulse",
        icon: "📱",
        date: latestPulse.created_at,
        title: `Pulse Assessment · ${latestPulse.sent_at ? "Sent" : "Draft"}`,
      });
    }

    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // ─── PDPA Audit Log · fire-and-forget ───
    // Log every 360 view · do not block response on logging failure
    admin.from("customer_view_log").insert({
      customer_id: params.id,
      viewer_id:   session.user.id,
      source:      "360",
    }).then(() => {}, () => { /* swallow log errors */ });

    return NextResponse.json({
      customer: { ...customer, chrono_age: chronoAge },
      score: { ...score, delta: scoreDelta, deltaReason: scoreDeltaReason },
      bioAge,
      status,
      insights,
      labVals,
      bcaLatest,
      bcaHistory: bcaHistory ?? [],   // additive: v2 Body-tab trends (v1 ignores this field)
      bcaCount: bcaCount ?? 0,
      pulseCount: pulseCount ?? 0,
      allergyTests: allergyTests ?? [],
      timeline,
      meta: { bcaLapseDays, labLapseDays, orderLapseDays, lastTouch,
        hasMedMap: Array.isArray(latestRecord) && latestRecord.some((r: any) => r.document_type === "med_map"),
        hasLabReport: Array.isArray(latestRecord) && latestRecord.some((r: any) => r.document_type === "lab_report"),
        labReportToken: (Array.isArray(latestRecord) ? latestRecord.find((r: any) => r.document_type === "lab_report")?.source_id : null) ?? null },
      // Tab data
      cgmProfiles: customer.cgm_profile_names ?? [],
      pulseAssessments: assessmentsList ?? [],
      pulseIntake: latestIntake ?? null,
    });
  } catch (err: any) {
    console.error("[360] error", err);
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
