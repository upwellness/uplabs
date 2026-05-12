"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { CustomerPicker } from "../bca/_components/CustomerPicker";
import type { Customer } from "@/lib/types";

interface PulseReading {
  recorded_at: string;
  metric_type: string;
  value: number;
  unit: string;
}

interface ConnectionInfo {
  id: string;
  provider: string;
  status: string;
  connected_at: string;
  last_sync_at: string | null;
  expires_at: string;
}

interface PulseData {
  customer: Customer;
  connection: ConnectionInfo | null;
  readings: PulseReading[];
  latest_invite: { token: string; expires_at: string; used_at: string | null } | null;
}

export default function PulsePage() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [data,     setData]     = useState<PulseData | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const loadCustomer = useCallback(async (c: Customer) => {
    setCustomer(c);
    setData(null);
    setInviteUrl(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/pulse/customers/${c.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "load failed");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createInvite = async () => {
    if (!customer) return;
    setError(null);
    try {
      const res = await fetch("/api/pulse/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customer.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "invite failed");
      setInviteUrl(json.url);
      // refresh status
      loadCustomer(customer);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    alert("คัดลอกลิงก์แล้ว");
  };

  // Group readings by metric for compact display
  const grouped = data?.readings ? groupReadings(data.readings) : null;

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-10">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-ink-40 hover:text-ink transition-colors text-sm">← Hub</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-rose">
              UP Pulse · Beta
            </span>
          </div>
          <CustomerPicker current={customer} onChange={loadCustomer} />
        </div>
      </header>

      <div className="mx-auto max-w-content px-10 py-10">

        {!customer && (
          <section className="flex flex-col items-center justify-center py-40 text-center">
            <div className="mb-4 text-5xl">📱</div>
            <h2 className="font-head text-2xl font-extrabold text-ink">เลือกลูกค้าเพื่อเริ่มต้น</h2>
            <p className="mt-3 font-thai text-sm text-ink-60">เริ่มจากเชื่อมต่อ Google Fit ของลูกค้า</p>
          </section>
        )}

        {customer && (
          <section className="rounded-3xl border border-ink-10 bg-white p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-40">Customer</div>
                <h1 className="mt-2 font-head text-[32px] font-extrabold tracking-tight text-ink">{customer.name}</h1>
                <div className="mt-2 flex items-center gap-5 font-thai text-sm text-ink-60">
                  <span>{customer.gender === "male" ? "ชาย" : "หญิง"}</span>
                  <span className="h-1 w-1 rounded-full bg-ink-20" />
                  <span>{customer.birth_year ? `${new Date().getFullYear() - customer.birth_year} ปี` : "—"}</span>
                </div>
                {error && <p className="mt-2 text-xs text-status-warning">{error}</p>}
              </div>
            </div>

            {/* Connection status */}
            {loading ? (
              <div className="mt-6 h-24 animate-pulse rounded-2xl bg-surface" />
            ) : data?.connection ? (
              <ConnectedCard conn={data.connection} />
            ) : (
              <NotConnectedCard
                onCreate={createInvite}
                inviteUrl={inviteUrl}
                onCopy={copyInvite}
                pendingInvite={data?.latest_invite ?? null}
                siteUrl={typeof window !== "undefined" ? window.location.origin : ""}
              />
            )}

            {/* Readings preview */}
            {grouped && (
              <div className="mt-8">
                <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-40">
                  Recent Readings (7 days)
                </div>
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
                  {grouped.map((g) => (
                    <ReadingCard key={g.metric_type} {...g} />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <footer className="mt-12 pb-8 text-center font-mono text-[11px] text-ink-40">
          UPLABS UP Pulse · v0 Beta · Google Fit integration · pharmacist review queue coming next
        </footer>
      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────── */

function ConnectedCard({ conn }: { conn: ConnectionInfo }) {
  return (
    <div className="mt-6 rounded-2xl border border-status-bg-optimal bg-status-bg-optimal/30 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 font-head text-base font-bold text-status-optimal">
            ✓ Connected · {conn.provider === "google_fit" ? "Google Fit" : conn.provider}
          </div>
          <div className="mt-2 grid gap-1 font-mono text-[11px] text-ink-60">
            <div>Connected: {new Date(conn.connected_at).toLocaleString("th-TH")}</div>
            <div>Last sync: {conn.last_sync_at ? new Date(conn.last_sync_at).toLocaleString("th-TH") : "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotConnectedCard({ onCreate, inviteUrl, onCopy, pendingInvite, siteUrl }: {
  onCreate: () => void;
  inviteUrl: string | null;
  onCopy: () => void;
  pendingInvite: { token: string; expires_at: string; used_at: string | null } | null;
  siteUrl: string;
}) {
  // Show pending invite URL if no fresh one was created this session
  const effectiveUrl = inviteUrl
    ?? (pendingInvite && !pendingInvite.used_at && new Date(pendingInvite.expires_at).getTime() > Date.now()
        ? `${siteUrl}/connect/${pendingInvite.token}`
        : null);

  const effectiveExpires = inviteUrl
    ? null
    : pendingInvite?.expires_at ?? null;

  const handleCopy = async () => {
    if (!effectiveUrl) return;
    await navigator.clipboard.writeText(effectiveUrl);
    alert("คัดลอกลิงก์แล้ว");
  };

  return (
    <div className="mt-6 rounded-2xl border border-ink-10 bg-surface p-5">
      <div className="font-head text-base font-bold text-ink">📱 ยังไม่ได้เชื่อมต่อ Google Fit</div>
      <p className="mt-1.5 font-thai text-[13px] text-ink-60">
        สร้างลิงก์เชิญ → ส่งให้ลูกค้าทาง LINE → ลูกค้าเปิด → เชื่อม Google Fit เอง
      </p>

      {!effectiveUrl ? (
        <Button variant="rose" className="mt-4" onClick={onCreate}>
          + สร้างลิงก์เชื่อมต่อ
        </Button>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="rounded-xl bg-ink p-3 font-mono text-[11px] text-white break-all">
            {effectiveUrl}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="rose"   size="sm" onClick={handleCopy}>📋 คัดลอก</Button>
            <Button variant="outline" size="sm" onClick={() => {
              if (typeof window !== "undefined") {
                window.open(`https://line.me/R/share?text=${encodeURIComponent(`คุณค่ะ ลิงก์เชื่อมต่อ Google Fit สำหรับ UP Pulse → ${effectiveUrl} (ใช้ได้ 7 วัน)`)}`);
              }
            }}>💬 ส่ง LINE</Button>
            <Button variant="ghost"  size="sm" onClick={onCreate}>♻️ สร้างใหม่</Button>
          </div>
          {effectiveExpires && (
            <p className="font-thai text-[11px] text-ink-60">
              ลิงก์หมดอายุ {new Date(effectiveExpires).toLocaleString("th-TH")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Group readings by metric_type ── */
function groupReadings(readings: PulseReading[]) {
  const map = new Map<string, { values: number[]; unit: string }>();
  for (const r of readings) {
    const g = map.get(r.metric_type) ?? { values: [], unit: r.unit };
    g.values.push(r.value);
    map.set(r.metric_type, g);
  }

  const LABELS: Record<string, string> = {
    hr_bpm:        "Heart Rate",
    rhr:           "Resting HR",
    hrv_rmssd:     "HRV",
    sleep_minutes: "Sleep",
    steps:         "Steps",
    spo2:          "SpO2",
  };

  return Array.from(map.entries()).map(([metric_type, g]) => ({
    metric_type,
    label: LABELS[metric_type] ?? metric_type,
    avg:   +(g.values.reduce((a, b) => a + b, 0) / g.values.length).toFixed(1),
    min:   Math.min(...g.values),
    max:   Math.max(...g.values),
    count: g.values.length,
    unit:  g.unit,
  }));
}

function ReadingCard({ label, avg, min, max, count, unit }: {
  label: string; avg: number; min: number; max: number; count: number; unit: string;
}) {
  return (
    <div className="rounded-2xl border border-ink-10 bg-white px-5 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-40">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <div className="font-head text-[24px] font-extrabold leading-none tracking-tight text-ink">{avg}</div>
        <div className="text-xs text-ink-40">{unit}</div>
      </div>
      <div className="mt-1 font-mono text-[10px] text-ink-40">
        min {min} · max {max} · n={count}
      </div>
    </div>
  );
}
