import { apiError } from "@/lib/api/respond";
import { getProfileNames, latestDate, shiftDate, todayBangkok } from "@/lib/api/cgm-data";

type Fail = { ok: false; error: Response };

/**
 * Resolve the date window for a CGM read: explicit ?from&to, or ?days=N ending at the
 * last day that has data (not "today" — a sensor removed last week still has a valid
 * 14-day window that ended then).
 */
export async function resolveWindow(req: Request, profiles: string[]): Promise<Fail | { ok: true; from: string; to: string; days: number | null }> {
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from"), to = sp.get("to");
  const days = Math.min(90, Math.max(1, Number(sp.get("days") ?? 14) || 14));
  const valid = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (from || to) {
    if (!valid(from) || !valid(to)) return { ok: false, error: apiError("bad_request", "from/to ต้องเป็น YYYY-MM-DD ทั้งคู่") };
    if (from > to) return { ok: false, error: apiError("bad_request", "from ต้องไม่หลัง to") };
    return { ok: true, from, to, days: null };
  }
  const end = (await latestDate(profiles)) ?? todayBangkok();
  return { ok: true, from: shiftDate(end, -(days - 1)), to: end, days };
}

export async function loadProfiles(customerId: string): Promise<Fail | { ok: true; name: string; profiles: string[] }> {
  const p = await getProfileNames(customerId);
  if (!p) return { ok: false, error: apiError("not_found", "ไม่พบลูกค้ารายนี้") };
  return { ok: true, name: p.name, profiles: p.profiles };
}
