import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session";
import { healthScore } from "@/lib/customers/health-score";
import { classifyStatus } from "@/lib/customers/status-classifier";
import { generateInsights } from "@/lib/customers/insight-rules";

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
    if (!isAdmin && customer.coach_id !== session.user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Parallel fetch
    const [
      { data: bcaLatest },
      { data: bcaHistory },
      { count: bcaCount },
      { data: labLatest },
      { data: labHistory },
      { data: latestRecord },
      { data: allergyTests },
      { data: supplementSafety },
      { count: pulseCount },
      { data: latestPulse },
      { data: latestIntake },
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
      admin.from("customer_records").select("recorded_at, source, document_type, notes").eq("customer_id", params.id).order("recorded_at", { ascending: false }).limit(10),
      admin.from("customer_allergy_tests").select("id, test_type, test_lab, tested_at, panel_size").eq("customer_id", params.id).order("tested_at", { ascending: false }).limit(1),
      admin.from("customer_supplement_safety").select("status, product_th, product_key, conflicting_ingredients").eq("customer_id", params.id),
      admin.from("pulse_assessments").select("*", { count: "exact", head: true }).eq("customer_id", params.id),
      admin.from("pulse_assessments").select("id, status, blocked, share_token, sent_at, created_at, ai_output").eq("customer_id", params.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("pulse_intakes").select("submitted_at, goal, budget_range").eq("customer_id", params.id).not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
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
    const chronoAge = customer.birth_year ? new Date().getFullYear() - customer.birth_year : null;
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

    return NextResponse.json({
      customer: { ...customer, chrono_age: chronoAge },
      score,
      status,
      insights,
      labVals,
      bcaLatest,
      bcaCount: bcaCount ?? 0,
      pulseCount: pulseCount ?? 0,
      allergyTests: allergyTests ?? [],
      timeline,
      meta: { bcaLapseDays, labLapseDays, orderLapseDays, lastTouch },
    });
  } catch (err: any) {
    console.error("[360] error", err);
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
