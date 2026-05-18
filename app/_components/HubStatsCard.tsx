import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Hub live pulse stats — cached 60s per (coachId, date).
 * Cache key includes Bangkok date so the "today" buckets auto-invalidate at midnight.
 */

function bangkokNow(): Date {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}

function bangkokTodayKey(): string {
  return bangkokNow().toISOString().slice(0, 10);
}

const getHubStats = unstable_cache(
  async (coachId: string | null, _todayKey: string) => {
    const admin = createAdminClient();
    const isAdmin = coachId === null;

    const sinceMidnight = (() => {
      const d = bangkokNow();
      d.setUTCHours(0, 0, 0, 0);
      return new Date(d.getTime() - 7 * 60 * 60 * 1000).toISOString();
    })();

    const [
      { count: customerCount },
      { count: measurementCount },
      { count: measurementsToday },
      { count: leadsToday },
    ] = await Promise.all([
      isAdmin
        ? admin.from("customers").select("*", { count: "exact", head: true })
        : admin.from("customers").select("*", { count: "exact", head: true }).eq("coach_id", coachId),
      isAdmin
        ? admin.from("measurements").select("*", { count: "exact", head: true })
        : admin.from("measurements").select("*, customers!inner(coach_id)", { count: "exact", head: true }).eq("customers.coach_id", coachId),
      isAdmin
        ? admin.from("measurements").select("*", { count: "exact", head: true }).gte("recorded_at", sinceMidnight)
        : admin.from("measurements").select("*, customers!inner(coach_id)", { count: "exact", head: true }).eq("customers.coach_id", coachId).gte("recorded_at", sinceMidnight),
      isAdmin
        ? admin.from("healthcheck_leads").select("*", { count: "exact", head: true }).gte("created_at", sinceMidnight)
        : admin.from("healthcheck_leads").select("*", { count: "exact", head: true }).eq("coach_id", coachId).gte("created_at", sinceMidnight),
    ]);

    return {
      customerCount: customerCount ?? 0,
      measurementCount: measurementCount ?? 0,
      measurementsToday: measurementsToday ?? 0,
      leadsToday: leadsToday ?? 0,
    };
  },
  ["hub-stats"],
  { revalidate: 60, tags: ["dashboard"] },
);

export async function HubStatsCard({ coachId, role }: { coachId: string | null; role: string }) {
  const stats = await getHubStats(coachId, bangkokTodayKey());
  return (
    <div className="relative">
      <div className="absolute -inset-3 bg-gradient-to-br from-rose-pale/40 via-amber-pale/30 to-wellness-pale/40 blur-2xl" />
      <div className="relative rounded-3xl border border-white/60 bg-white/60 p-7 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(140,76,76,0.18)]">
        <div className="flex items-center justify-between mb-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-40 font-bold">Pulse · วันนี้</div>
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-rose">
            <span className="relative h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-rose" />
              <span className="absolute inset-0 rounded-full bg-rose animate-ping opacity-70" />
            </span>
            live
          </span>
        </div>
        <div className="grid grid-cols-2 gap-5">
          <BigStat label="ลูกค้าทั้งหมด" value={stats.customerCount}      accent="rose"     />
          <BigStat label="BCA Records"   value={stats.measurementCount}   accent="wellness" />
          <BigStat label="BCA วันนี้"     value={stats.measurementsToday}  accent="amber"    highlight />
          <BigStat label="Leads วันนี้"   value={stats.leadsToday}         accent="science"  highlight />
        </div>
        <div className="mt-5 border-t border-ink-10 pt-4 flex items-center justify-between text-[11px] text-ink-40">
          <span className="font-thai">บทบาทของคุณ</span>
          <span className="font-mono font-bold text-ink">{role.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

export function HubStatsSkeleton() {
  return (
    <div className="relative">
      <div className="absolute -inset-3 bg-gradient-to-br from-rose-pale/40 via-amber-pale/30 to-wellness-pale/40 blur-2xl" />
      <div className="relative rounded-3xl border border-white/60 bg-white/60 p-7 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(140,76,76,0.18)]">
        <div className="flex items-center justify-between mb-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-40 font-bold">Pulse · วันนี้</div>
          <span className="text-[10px] font-mono text-ink-30">loading…</span>
        </div>
        <div className="grid grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => {
            const highlight = i >= 2;
            return (
              <div key={i} className={`relative ${highlight ? "rounded-2xl bg-white/80 ring-1 ring-ink-5 px-4 py-3" : "px-1 py-1"}`}>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-10" />
                  <span className="h-2 w-16 rounded bg-ink-5 animate-pulse" />
                </div>
                <div className={`mt-1.5 rounded bg-ink-5 animate-pulse ${highlight ? "h-9 w-20" : "h-7 w-16"}`} />
              </div>
            );
          })}
        </div>
        <div className="mt-5 border-t border-ink-10 pt-4 flex items-center justify-between text-[11px]">
          <span className="font-thai text-ink-40">บทบาทของคุณ</span>
          <span className="h-3 w-12 rounded bg-ink-5 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function BigStat({ label, value, accent, highlight }: {
  label: string; value: number; accent: "rose" | "wellness" | "amber" | "science"; highlight?: boolean;
}) {
  const accentDot = {
    rose: "bg-rose",
    wellness: "bg-wellness",
    amber: "bg-amber",
    science: "bg-science",
  } as const;
  return (
    <div className={`relative rounded-2xl ${highlight ? "bg-white/80 ring-1 ring-ink-5 px-4 py-3" : "px-1 py-1"}`}>
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${accentDot[accent]}`} />
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-40 font-bold">{label}</span>
      </div>
      <div className={`mt-1.5 font-head font-extrabold leading-none tracking-tight ${highlight ? "text-[34px] text-ink" : "text-[28px] text-ink-80"}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
