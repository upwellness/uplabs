import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk } from "@/lib/api/respond";
import { getReadings, toPoints } from "@/lib/api/cgm-data";
import { computeMetrics, TARGETS } from "@/lib/api/cgm-metrics";
import { resolveWindow, loadProfiles } from "../_shared";

export const dynamic = "force-dynamic";

/**
 * GET …/cgm/metrics — TIR / TAR / TBR / CV / GMI and a per-day table for a window.
 *
 * The numbers are computed here, on the server, from the rows in the table — never
 * trusted from a device summary screen. `reliable:false` means the window is shorter
 * than the 14-day / 70% rule and the caller should present the figures as a trend,
 * not a verdict.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withApi(req, async (ctx) => {
    const err = requireScope(ctx, "cgm:read");
    if (err) return err;
    const scoped = await assertCustomerInScope(ctx, params.id);
    if (scoped) return scoped;
    ctx.customerId = params.id;

    const p = await loadProfiles(params.id);
    if (!p.ok) return p.error;
    const w = await resolveWindow(req, p.profiles);
    if (!w.ok) return w.error;

    const rows = await getReadings(p.profiles, w.from, w.to);
    const m = computeMetrics(toPoints(rows));
    if (p.profiles.length === 0) m.caveats.unshift("ลูกค้ารายนี้ยังไม่มีโปรไฟล์ CGM — นำเข้าไฟล์ผ่าน POST …/cgm/import ก่อน");

    return apiOk(
      { customer: { id: params.id, name: p.name }, profiles: p.profiles, window: { from: w.from, to: w.to }, metrics: m, targets: TARGETS },
      { clinical: true, meta: { token: ctx.token.name, row_count: rows.length } },
    );
  });
}
