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

import { useEffect, useState } from "react";
import { IdentityBar } from "./_360/IdentityBar";
import { VitalDashboard } from "./_360/VitalDashboard";
import { ActivityTimeline } from "./_360/ActivityTimeline";
import { InsightsPanel } from "./_360/InsightsPanel";
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
}

export function Customer360({ customerId }: { customerId: string }) {
  const [data, setData] = useState<Customer360Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"body" | "labs" | "allergy" | "trends">("labs");

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
      <div className="mx-auto max-w-content px-6 py-10 space-y-4">
        <div className="h-24 animate-pulse rounded-3xl bg-surface" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-40 animate-pulse rounded-3xl bg-surface" />
            <div className="h-60 animate-pulse rounded-3xl bg-surface" />
          </div>
          <div className="h-60 animate-pulse rounded-3xl bg-surface" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Zone 1 · Identity Bar (sticky) */}
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

        {/* Zone 5 · Detail Tabs */}
        <section className="rounded-3xl border border-ink-10 bg-white p-6">
          <div className="mb-4 flex flex-wrap gap-2 border-b border-ink-10 pb-3">
            <TabButton active={tab === "labs"} onClick={() => setTab("labs")}>📊 Labs Latest</TabButton>
            <TabButton active={tab === "trends"} onClick={() => setTab("trends")}>📈 Lab Trends</TabButton>
            <TabButton active={tab === "allergy"} onClick={() => setTab("allergy")}>🧪 Allergy</TabButton>
          </div>

          {tab === "labs" && <LatestLabsCard customerId={customerId} />}
          {tab === "trends" && <LabTrendCharts customerId={customerId} />}
          {tab === "allergy" && <AllergyPanel customerId={customerId} />}
        </section>

      </div>
    </>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition ${
        active
          ? "bg-ink text-white"
          : "bg-surface text-ink-60 hover:bg-ink-10"
      }`}>
      {children}
    </button>
  );
}
