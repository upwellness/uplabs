"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { CustomerPicker } from "../bca/_components/CustomerPicker";
import { PulseCharts } from "./_components/PulseCharts";
import type { Customer } from "@/lib/types";

interface Reading { recorded_at: string; metric_type: string; value: number; unit: string; }
interface Connection { id: string; provider: string; status: string; connected_at: string; last_sync_at: string | null; expires_at: string; }
interface Invite     { token: string; expires_at: string; used_at: string | null; }
interface Intake     { id: string; token: string; submitted_at: string | null; expires_at: string; goal: string | null; budget_range: string | null; }
interface Assessment { id: string; status: string; blocked: boolean; block_reasons: string[]; share_token: string; sent_at: string | null; created_at: string; ai_output: any; }

interface PulseData {
  customer: Customer;
  connection: Connection | null;
  readings: Reading[];
  latest_invite: Invite | null;
  latest_intake: Intake | null;
  assessments: Assessment[];
}

export default function PulsePage() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [data,     setData]     = useState<PulseData | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [intakeUrl, setIntakeUrl] = useState<string | null>(null);
  const [syncing,  setSyncing]  = useState(false);
  const [assessing, setAssessing] = useState(false);

  const loadCustomer = useCallback(async (c: Customer) => {
    setCustomer(c);
    setData(null); setInviteUrl(null); setIntakeUrl(null);
    setError(null); setLoading(true);
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
    try {
      const res = await fetch("/api/pulse/invites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customer.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "invite failed");
      setInviteUrl(json.url);
      loadCustomer(customer);
    } catch (e: any) { setError(e.message); }
  };

  const createIntake = async () => {
    if (!customer) return;
    try {
      const res = await fetch("/api/pulse/intakes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customer.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "intake link failed");
      setIntakeUrl(json.url);
      loadCustomer(customer);
    } catch (e: any) { setError(e.message); }
  };

  const syncNow = async () => {
    if (!customer) return;
    setSyncing(true); setError(null);
    try {
      const res = await fetch(`/api/pulse/customers/${customer.id}/sync`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "sync failed");
      await loadCustomer(customer);
      if (json.count === 0) {
        alert("Sync สำเร็จ — แต่ Google Fit ไม่มี data ใน 7 วันที่ผ่านมา");
      } else {
        alert(`Sync สำเร็จ — ดึงข้อมูล ${json.count} reading จาก Google Fit`);
      }
    } catch (e: any) { setError(e.message); }
    finally { setSyncing(false); }
  };

  const runAssess = async () => {
    if (!customer) return;
    setAssessing(true); setError(null);
    try {
      const res = await fetch(`/api/pulse/customers/${customer.id}/assess`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "assess failed");
      await loadCustomer(customer);
      if (json.assessment?.blocked) {
        alert("AI วิเคราะห์เสร็จแล้ว — แต่ block เพราะ:\n" + (json.assessment.block_reasons ?? []).join("\n"));
      } else {
        alert("AI วิเคราะห์เสร็จแล้ว — ดู draft แล้วกด 'เผยแพร่' เพื่อส่งลูกค้า");
      }
    } catch (e: any) { setError(e.message); }
    finally { setAssessing(false); }
  };

  const publishAssessment = async (a: Assessment) => {
    if (!confirm("เผยแพร่รายงานนี้ให้ลูกค้า?")) return;
    try {
      const res = await fetch(`/api/pulse/assessments/${a.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "publish failed");
      loadCustomer(customer!);
    } catch (e: any) { alert(e.message); }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    alert("คัดลอกแล้ว");
  };

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-ink-10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-10">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-ink-40 hover:text-ink transition-colors text-sm">← Hub</Link>
            <div className="h-5 w-px bg-ink-10" />
            <Logo size="sm" />
            <span className="rounded-full bg-rose-ultra px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-rose">UP Pulse · Beta</span>
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
          <>
            {/* Patient header */}
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

              {/* Workflow steps */}
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {/* Step 1: Connect Google Fit */}
                <WorkflowCard
                  step="1"
                  title="เชื่อม Google Fit"
                  done={!!data?.connection}
                >
                  {loading ? <Skeleton /> : data?.connection ? (
                    <div>
                      <div className="text-[12px] font-bold text-status-optimal">✓ Connected</div>
                      <div className="mt-1 font-mono text-[10px] text-ink-40">
                        Last sync: {data.connection.last_sync_at ? new Date(data.connection.last_sync_at).toLocaleString("th-TH") : "—"}
                      </div>
                      <Button variant="outline" size="sm" className="mt-3" onClick={syncNow} disabled={syncing}>
                        {syncing ? "Syncing..." : "↻ Sync Now"}
                      </Button>
                    </div>
                  ) : (
                    <InviteUI
                      url={inviteUrl ?? (data?.latest_invite && !data.latest_invite.used_at ? `${siteUrl}/connect/${data.latest_invite.token}` : null)}
                      onCreate={createInvite}
                      onCopy={copy}
                    />
                  )}
                </WorkflowCard>

                {/* Step 2: Intake */}
                <WorkflowCard
                  step="2"
                  title="กรอก Intake (5 ข้อ)"
                  done={!!data?.latest_intake?.submitted_at}
                >
                  {loading ? <Skeleton /> : data?.latest_intake?.submitted_at ? (
                    <div>
                      <div className="text-[12px] font-bold text-status-optimal">✓ Submitted</div>
                      <div className="mt-1 font-mono text-[10px] text-ink-40">
                        {new Date(data.latest_intake.submitted_at).toLocaleString("th-TH")}
                      </div>
                      <Button variant="ghost" size="sm" className="mt-3" onClick={createIntake}>
                        + กรอกใหม่
                      </Button>
                    </div>
                  ) : (
                    <InviteUI
                      url={intakeUrl ?? (data?.latest_intake && !data.latest_intake.submitted_at ? `${siteUrl}/intake/${data.latest_intake.token}` : null)}
                      onCreate={createIntake}
                      onCopy={copy}
                      label="สร้างลิงก์ Intake"
                    />
                  )}
                </WorkflowCard>

                {/* Step 3: Assess */}
                <WorkflowCard
                  step="3"
                  title="วิเคราะห์ + แนะนำ"
                  done={(data?.assessments?.length ?? 0) > 0}
                >
                  {loading ? <Skeleton /> : (
                    <div>
                      <Button
                        variant="rose" size="sm"
                        onClick={runAssess}
                        disabled={assessing || !data?.connection || !data?.latest_intake?.submitted_at}
                      >
                        {assessing ? "AI กำลังคิด..." : "🧠 รัน AI Assessment"}
                      </Button>
                      {(!data?.connection || !data?.latest_intake?.submitted_at) && (
                        <p className="mt-2 font-thai text-[11px] text-ink-40">
                          ต้อง connect Google Fit + Intake submitted ก่อน
                        </p>
                      )}
                    </div>
                  )}
                </WorkflowCard>
              </div>
            </section>

            {/* Assessments list */}
            {data?.assessments && data.assessments.length > 0 && (
              <section className="mt-6 rounded-3xl border border-ink-10 bg-white p-8">
                <div className="mb-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-40">Assessments</div>
                  <h2 className="mt-1 font-head text-2xl font-extrabold tracking-tight text-ink">รายงานที่ AI วิเคราะห์</h2>
                </div>
                <div className="space-y-3">
                  {data.assessments.map((a) => (
                    <AssessmentRow
                      key={a.id}
                      a={a}
                      siteUrl={siteUrl}
                      onPublish={publishAssessment}
                      onCopy={copy}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Charts */}
            {data?.connection && data.readings.length > 0 && (
              <section className="mt-6 rounded-3xl border border-ink-10 bg-white p-8">
                <div className="mb-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-40">Trend Charts</div>
                  <h2 className="mt-1 font-head text-2xl font-extrabold tracking-tight text-ink">แนวโน้ม 7 วัน</h2>
                </div>
                <PulseCharts readings={data.readings} />
              </section>
            )}
          </>
        )}

        <footer className="mt-12 pb-8 text-center font-mono text-[11px] text-ink-40">
          UPLABS UP Pulse · v0 Beta · Google Fit · Gemini AI · Pharmacist-led
        </footer>
      </div>
    </main>
  );
}

/* ── Components ─────────────────────────────────── */

function WorkflowCard({ step, title, done, children }: {
  step: string; title: string; done: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${done ? "border-status-bg-optimal bg-status-bg-optimal/20" : "border-ink-10 bg-surface"}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-[12px] font-bold ${done ? "bg-status-optimal text-white" : "bg-ink-10 text-ink"}`}>
          {done ? "✓" : step}
        </div>
        <div className="font-head text-[14px] font-bold text-ink">{title}</div>
      </div>
      {children}
    </div>
  );
}

function Skeleton() {
  return <div className="h-12 animate-pulse rounded-lg bg-ink-5" />;
}

function InviteUI({ url, onCreate, onCopy, label = "สร้างลิงก์" }: {
  url: string | null; onCreate: () => void; onCopy: (s: string) => void; label?: string;
}) {
  if (!url) return <Button variant="rose" size="sm" onClick={onCreate}>+ {label}</Button>;
  return (
    <div>
      <div className="rounded-lg bg-ink p-2 font-mono text-[10px] text-white break-all">{url}</div>
      <div className="mt-2 flex gap-2">
        <Button variant="rose"    size="sm" onClick={() => onCopy(url)}>📋 Copy</Button>
        <Button variant="ghost"   size="sm" onClick={onCreate}>♻️</Button>
      </div>
    </div>
  );
}

function AssessmentRow({ a, siteUrl, onPublish, onCopy }: {
  a: Assessment; siteUrl: string;
  onPublish: (a: Assessment) => void;
  onCopy: (s: string) => void;
}) {
  const reportUrl = `${siteUrl}/r/${a.share_token}`;
  const summary = a.ai_output?.summary ?? "";

  return (
    <div className={`rounded-2xl border p-5 ${a.blocked ? "border-amber-300 bg-amber-50" : a.sent_at ? "border-status-bg-optimal bg-white" : "border-ink-10 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-ink-40">
            <span>{new Date(a.created_at).toLocaleString("th-TH")}</span>
            <StatusBadge a={a} />
          </div>
          {a.blocked ? (
            <div className="mt-2 font-thai text-[13px] text-amber-900">
              ⚕️ Blocked: {(a.block_reasons ?? []).join(" · ")}
            </div>
          ) : (
            <p className="mt-2 font-thai text-[13px] leading-[1.6] text-ink line-clamp-2">{summary}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href={reportUrl} target="_blank" rel="noopener" className="rounded-md border border-ink-10 px-3 py-1.5 text-[11px] font-semibold text-ink hover:border-ink-20">
          👁 ดูรายงาน
        </a>
        <button onClick={() => onCopy(reportUrl)} className="rounded-md border border-ink-10 px-3 py-1.5 text-[11px] font-semibold text-ink hover:border-ink-20">
          📋 Copy link
        </button>
        {!a.sent_at && !a.blocked && (
          <button onClick={() => onPublish(a)} className="rounded-md bg-rose px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-rose/90">
            🚀 เผยแพร่ให้ลูกค้า
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ a }: { a: Assessment }) {
  if (a.blocked) return <span className="rounded-full bg-amber-200 px-2 py-0.5 text-amber-800">BLOCKED</span>;
  if (a.sent_at) return <span className="rounded-full bg-status-bg-optimal px-2 py-0.5 text-status-optimal">SENT</span>;
  return <span className="rounded-full bg-ink-10 px-2 py-0.5 text-ink-60">DRAFT</span>;
}
