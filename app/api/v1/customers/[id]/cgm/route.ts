import { withApi, requireScope, assertCustomerInScope } from "@/lib/api/auth";
import { apiOk } from "@/lib/api/respond";
import { getReadings } from "@/lib/api/cgm-data";
import { resolveWindow, loadProfiles } from "./_shared";

export const dynamic = "force-dynamic";

/**
 * GET …/cgm — raw continuous-glucose readings for a date window.
 *
 * Default window is the last 14 days that HAVE data, capped at 90 days / 20,000 rows.
 * Callers wanting numbers rather than points should use …/cgm/metrics.
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
    return apiOk(
      {
        customer: { id: params.id, name: p.name },
        profiles: p.profiles,
        window: { from: w.from, to: w.to },
        readings: rows.map((r) => ({ time: r.original_time, ts: r.reading_timestamp, glucose: r.glucose, profile: r.profile_name })),
        caveats: p.profiles.length === 0
          ? ["ลูกค้ารายนี้ยังไม่มีโปรไฟล์ CGM — นำเข้าไฟล์ผ่าน POST …/cgm/import ก่อน"]
          : rows.length === 0 ? ["ไม่มีค่าในช่วงวันที่ขอ"] : [],
      },
      { clinical: true, meta: { token: ctx.token.name, row_count: rows.length } },
    );
  });
}
