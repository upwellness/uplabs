"use client";

/**
 * Customer 360 · Orchestrator
 * ────────────────────────────
 * Fetches /api/customers/[id]/360 → renders 5 zones
 *   Zone 1: IdentityBar (sticky top · status + action bar)
 *   Zone 2: VitalDashboard (Health Score + KPIs)
 *   Zone 3: InsightsPanel (right · alerts/trends/actions)
 *   Zone 4: ActivityTimeline (left · 90-day feed)
 *   Zone 5: DetailTabs (Phase 2 · reusing existing components below)
 */

import { useEffect, useRef, useState } from "react";
import { Activity, FlaskConical, TrendingUp, Sparkles, Wifi, Pill, Smartphone, NotebookPen, type LucideIcon } from "lucide-react";
import { IdentityBar } from "./_360/IdentityBar";
import { VitalDashboard } from "./_360/VitalDashboard";
import { ActivityTimeline } from "./_360/ActivityTimeline";
import { InsightsPanel } from "./_360/InsightsPanel";
import { BodyTab } from "./_360/tabs/BodyTab";
import { CgmTab } from "./_360/tabs/CgmTab";
import { PulseTab } from "./_360/tabs/PulseTab";
import { SupplementsTab } from "./_360/tabs/SupplementsTab";
import { NotesTab } from "./_360/tabs/NotesTab";
import { LatestLabsCard } from "./LatestLabsCard";
import { LabTrendCharts } from "./LabTrendCharts";
import { AllergyPanel } from "./AllergyPanel";

interface Customer360Data {
  customer: any;
  score: any;
  status: any;
  insights: any;
  labVals: any;
  bcaLatest: any;
  bcaCount: number;
  pulseCount: number;
  allergyTests: any[];
  timeline: any[];
  meta: any;
  cgmProfiles: string[];
  pulseAssessments: any[];
  pulseIntake: any;
}

type TabKey = "body" | "labs" | "trends" | "allergy" | "cgm" | "supplements" | "pulse" | "notes";

export function Customer360({ customerId }: { customerId: string }) {
  const [data, setData] = useState<Customer360Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("body");

  useEffect(() => {
    fetch(`/api/customers/${customerId}/360`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(e => setError(e.message ?? "load failed"));
  }, [customerId]);

  if (error) {
    return (
      <div className="mx-auto max-w-content px-6 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <div className="font-bold">โหลดข้อมูลไม่สำเร็จ</div>
          <div className="mt-1 font-mono text-xs">{error}</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <>
        <div className="aurora-bg" aria-hidden="true"><div className="aurora-orb-3" /></div>
        <div className="mx-auto max-w-content px-6 py-10 space-y-4">
          <div className="h-24 animate-pulse rounded-3xl liquid" />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-40 animate-pulse rounded-3xl liquid" />
              <div className="h-60 animate-pulse rounded-3xl liquid" />
            </div>
            <div className="h-60 animate-pulse rounded-3xl liquid" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Aurora background — fixed · z-index -1 · decorative only */}
      <div className="aurora-bg" aria-hidden="true"><div className="aurora-orb-3" /></div>

      {/* Zone 1 · Identity Bar (sticky · frosted glass) */}
      <IdentityBar customer={data.customer} status={data.status} meta={data.meta} />

      <div className="mx-auto max-w-content px-6 py-6 space-y-6">

        {/* Zones 2 + 3 + 4 · 3-column layout on desktop */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left+Center: Vital + Timeline (span 2) */}
          <div className="lg:col-span-2 space-y-4">
            <VitalDashboard
              score={data.score}
              labVals={data.labVals}
              bcaLatest={data.bcaLatest}
              chronoAge={data.customer.chrono_age}
            />
            <ActivityTimeline events={data.timeline} />
          </div>

          {/* Right: Insights (sticky on desktop) */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-[140px]">
              <InsightsPanel insights={data.insights} />
            </div>
          </div>
        </div>

        {/* Zone 5 · Detail Tabs · liquid glass shell · 8 tabs · ARIA tablist */}
        <DetailTabs
          tab={tab}
          setTab={setTab}
          customerId={customerId}
          data={data}
        />

      </div>
    </>
  );
}

/* ─── Detail Tabs · ARIA-compliant tablist + arrow-key nav ─── */

const TAB_DEFS: Array<{ key: TabKey; label: string; Icon: LucideIcon }> = [
  { key: "body",        label: "Body",         Icon: Activity },
  { key: "labs",        label: "Labs",         Icon: FlaskConical },
  { key: "trends",      label: "Trends",       Icon: TrendingUp },
  { key: "allergy",     label: "Allergy",      Icon: Sparkles },
  { key: "cgm",         label: "CGM",          Icon: Wifi },
  { key: "supplements", label: "Supplements",  Icon: Pill },
  { key: "pulse",       label: "Pulse",        Icon: Smartphone },
  { key: "notes",       label: "Notes",        Icon: NotebookPen },
];

function DetailTabs({
  tab, setTab, customerId, data,
}: {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  customerId: string;
  data: Customer360Data;
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % TAB_DEFS.length;
    if (e.key === "ArrowLeft")  next = (idx - 1 + TAB_DEFS.length) % TAB_DEFS.length;
    if (e.key === "Home")       next = 0;
    if (e.key === "End")        next = TAB_DEFS.length - 1;
    setTab(TAB_DEFS[next].key);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="liquid liquid-shine rounded-3xl p-6" aria-labelledby="detail-tabs-heading">
      <h2 id="detail-tabs-heading" className="sr-only">รายละเอียดเพิ่มเติม</h2>
      <div
        className="mb-4 flex flex-wrap gap-2 border-b border-ink/8 pb-3"
        role="tablist"
        aria-label="รายละเอียด customer · ใช้ปุ่มลูกศรซ้าย-ขวาเพื่อเปลี่ยน tab"
      >
        {TAB_DEFS.map((t, i) => {
          const active = tab === t.key;
          const Icon = t.Icon;
          return (
            <button
              key={t.key}
              ref={(el) => { tabRefs.current[i] = el; }}
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={active}
              aria-controls={`tabpanel-${t.key}`}
              tabIndex={active ? 0 : -1}
              type="button"
              onClick={() => setTab(t.key)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold tracking-wide transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 ${
                active
                  ? "bg-ink text-white shadow-md"
                  : "bg-white/60 text-ink-60 hover:bg-white/90 border border-ink/8"
              }`}
            >
              <Icon size={14} strokeWidth={2.25} aria-hidden="true" /> {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`tabpanel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
      >
        {tab === "body"        && <BodyTab customerId={customerId} />}
        {tab === "labs"        && <LatestLabsCard customerId={customerId} />}
        {tab === "trends"      && <LabTrendCharts customerId={customerId} />}
        {tab === "allergy"     && <AllergyPanel customerId={customerId} />}
        {tab === "cgm"         && <CgmTab customerId={customerId} profiles={data.cgmProfiles} />}
        {tab === "supplements" && <SupplementsTab customerId={customerId} />}
        {tab === "pulse"       && <PulseTab assessments={data.pulseAssessments} intake={data.pulseIntake} />}
        {tab === "notes"       && <NotesTab customerId={customerId} />}
      </div>
    </section>
  );
}
