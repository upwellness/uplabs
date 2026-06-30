"use client";

/**
 * UP Labs v2 · ★ UP Pulse — Provider management (SPEC §7.6)
 * ─────────────────────────────────────────────────────────
 * One customer's wearable providers in clinical-warm:
 *   - WHOOP        — CSV import (4 files) + OAuth connect link
 *   - Apple Health — export.xml/zip upload (parsed on-device, HRV = SDNN)
 *   - Google Fit   — OAuth connect link + manual sync
 *   - CGM          — link/unlink glucose profile names
 *
 * Reuses the v1 client components (WhoopImport / AppleImport) verbatim — they only
 * call the existing import APIs and import cleanly. Google Fit connect reuses the
 * invite API (POST /api/pulse/invites → /connect/[token]); sync reuses
 * POST /api/pulse/customers/[id]/sync; CGM reuses PATCH …/cgm-link.
 *
 * Data: /api/customers/[id]/360 (full customer for the §4 IdentityBlock + cgmProfiles)
 * and /api/pulse/customers/[id] (Google-Fit connection + last sync).
 *
 * NOTE (flagged to maintainer): there is no JSON API that returns the GLOBAL list of
 * CGM profile names (v1 master reads it server-side via the `cgm_list_profiles` RPC).
 * So the v2 CGM manager lists the customer's linked profiles (unlink works) and lets
 * the coach add a profile by typing its exact name — no v1/API change made.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Smartphone, ArrowLeft, ArrowRight, RefreshCw, Link2, FileText, Activity, Wifi, Droplet,
  Plus, X, Loader2, Check,
} from "lucide-react";
import { Shell } from "../../../_components/Shell";
import { IdentityBlock } from "@/lib/v2/IdentityBlock";
import { Card, LoadingState, EmptyState, ErrorState, IconChip } from "@/lib/v2/ui";
import { statusTextClass } from "@/lib/v2/status";
import type { Customer } from "@/lib/types";
import { WhoopImport } from "@/app/pulse/master/[id]/WhoopImport";
import { AppleImport } from "@/app/pulse/master/[id]/AppleImport";
import { fmtDateTime } from "../../_lib";

interface MasterData {
  customer: Customer;
  cgmProfiles: string[];
  connection: { provider: string; status: string; last_sync_at: string | null } | null;
}

export default function V2PulseMasterPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<MasterData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setData(null);
    Promise.all([
      fetch(`/api/customers/${id}/360`).then((r) => r.json()),
      fetch(`/api/pulse/customers/${id}`).then((r) => r.json()),
    ])
      .then(([c360, pulse]) => {
        if (c360.error) throw new Error(c360.error);
        setData({
          customer: c360.customer as Customer,
          cgmProfiles: (c360.cgmProfiles ?? []) as string[],
          connection: pulse?.error ? null : (pulse.connection ?? null),
        });
      })
      .catch((e) => setError(e.message ?? "load failed"));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const name = data ? (data.customer.name ?? "ลูกค้า") : "อุปกรณ์";
  const breadcrumb = [
    { label: "หน้าแรก", href: "/v2" },
    { label: "UP Pulse", href: "/v2/pulse" },
    { label: name, href: `/v2/pulse?customer=${id}` },
    { label: "จัดการอุปกรณ์" },
  ];

  if (error) return <Shell breadcrumb={breadcrumb}><Card><ErrorState message={error} onRetry={load} /></Card></Shell>;
  if (!data) return <Shell breadcrumb={breadcrumb}><Card><LoadingState label="กำลังโหลดข้อมูลอุปกรณ์…" /></Card></Shell>;

  const c = data.customer;

  return (
    <Shell breadcrumb={breadcrumb}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-ultra text-rose"><Smartphone size={16} strokeWidth={2} aria-hidden /></span>
            <h1 className="font-head text-[20px] font-extrabold tracking-tight text-ink">จัดการอุปกรณ์ &amp; นำเข้าข้อมูล</h1>
          </div>
          <Link href={`/v2/pulse?customer=${id}`} className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink">
            <ArrowLeft size={13} strokeWidth={2.25} aria-hidden /> กลับไป UP Pulse
          </Link>
        </div>

        {/* ★ Identity block (SPEC §4) */}
        <IdentityBlock customer={c} editHref={`/customers/${id}`} />

        {/* WHOOP — CSV + OAuth */}
        <ProviderSection icon="ink" title="WHOOP" subtitle="นำเข้าจาก CSV export หรือเชื่อมผ่าน OAuth (sync อัตโนมัติ)">
          <WhoopImport customerId={id} customerName={c.name ?? "ลูกค้า"} initialDayCount={0} initialRange={null} />
        </ProviderSection>

        {/* Apple Health */}
        <ProviderSection icon="ink" title="Apple Watch / Health" subtitle="อัปโหลดไฟล์ export (อ่านในเครื่อง ส่งเฉพาะสรุปรายวัน) · HRV = SDNN">
          <AppleImport customerId={id} customerName={c.name ?? "ลูกค้า"} />
        </ProviderSection>

        {/* Google Fit — OAuth + sync */}
        <ProviderSection icon="wellness" title="Google Fit" subtitle="เชื่อมผ่าน OAuth แล้ว sync ข้อมูล 7 วันล่าสุด">
          <GoogleFitManager customerId={id} customerName={c.name ?? "ลูกค้า"} connection={data.connection} onChanged={load} />
        </ProviderSection>

        {/* CGM */}
        <ProviderSection icon="science" title="CGM (น้ำตาลต่อเนื่อง)" subtitle="ผูกชื่อโปรไฟล์ CGM ของลูกค้าเข้ากับเรคคอร์ดนี้">
          <CgmManager customerId={id} linked={data.cgmProfiles} onSaved={load} />
        </ProviderSection>

        {/* Footer actions */}
        <div className="flex flex-wrap gap-3">
          <Link href={`/v2/pulse?customer=${id}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-mid">
            <ArrowLeft size={15} strokeWidth={2.25} aria-hidden /> กลับไป UP Pulse
          </Link>
          <Link href={`/v2/pulse/report/${id}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-rose/30 bg-rose-ultra px-5 py-2.5 text-[13px] font-semibold text-rose transition-colors hover:bg-rose hover:text-white">
            <FileText size={15} strokeWidth={2.25} aria-hidden /> เปิดรายงาน <ArrowRight size={14} strokeWidth={2.5} aria-hidden />
          </Link>
        </div>
      </div>
    </Shell>
  );
}

/* ── Provider section shell ── */
function ProviderSection({ icon, title, subtitle, children }: { icon: "ink" | "wellness" | "science"; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 lg:p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <IconChip icon={icon === "wellness" ? Wifi : icon === "science" ? Droplet : Activity} tone={icon} size={16} className="h-9 w-9" />
        <div>
          <h2 className="font-head text-[16px] font-bold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="font-thai text-[12px] text-ink-60">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

/* ── Google Fit (OAuth connect + sync) ── */
function GoogleFitManager({ customerId, customerName, connection, onChanged }: {
  customerId: string; customerName: string;
  connection: { provider: string; status: string; last_sync_at: string | null } | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<null | "connect" | "sync">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const connected = connection?.status === "active";  // DB stores "active" (not "connected")

  const connect = async () => {
    setBusy("connect"); setErr(null); setMsg(null);
    try {
      const res = await fetch("/api/pulse/invites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "สร้างลิงก์ไม่สำเร็จ");
      window.open(json.url, "_blank");
      setMsg(`สร้างลิงก์เชื่อม Google Fit แล้ว — ส่งให้ ${customerName} เปิดเพื่อยินยอม (เปิดแท็บใหม่ให้แล้ว)`);
    } catch (e: any) { setErr(e.message ?? "connect error"); }
    finally { setBusy(null); }
  };

  const sync = async () => {
    setBusy("sync"); setErr(null); setMsg(null);
    try {
      const res = await fetch(`/api/pulse/customers/${customerId}/sync`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "sync failed");
      setMsg(json.count === 0 ? "Sync สำเร็จ — แต่ Google Fit ไม่มีข้อมูลใน 7 วันที่ผ่านมา" : `Sync สำเร็จ — ดึงข้อมูล ${json.count} ค่า จาก Google Fit`);
      onChanged();
    } catch (e: any) { setErr(e.message ?? "sync error"); }
    finally { setBusy(null); }
  };

  return (
    <div className="rounded-xl border border-ink-10 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {connected ? (
            <>
              <div className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${statusTextClass.optimal}`}>
                <Check size={15} strokeWidth={2.5} aria-hidden /> เชื่อมแล้ว
              </div>
              <div className="mt-0.5 font-mono text-[10.5px] text-ink-60">sync ล่าสุด {fmtDateTime(connection?.last_sync_at ?? null)}</div>
            </>
          ) : (
            <div className="font-thai text-[13px] text-ink-60">ยังไม่ได้เชื่อม Google Fit</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {connected && (
            <button type="button" onClick={sync} disabled={busy !== null} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-2 text-[12px] font-semibold text-ink-80 transition-colors hover:border-rose hover:text-rose disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
              {busy === "sync" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <RefreshCw size={14} strokeWidth={2.25} aria-hidden />} Sync ตอนนี้
            </button>
          )}
          <button type="button" onClick={connect} disabled={busy !== null} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-rose-mid disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
            {busy === "connect" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Link2 size={14} strokeWidth={2.25} aria-hidden />} {connected ? "เชื่อมใหม่" : "เชื่อมผ่าน OAuth"}
          </button>
        </div>
      </div>
      {msg && <div className="mt-3 rounded-lg bg-wellness-ultra px-3 py-2 font-thai text-[12px] text-wellness">{msg}</div>}
      {err && <div className="mt-3 rounded-lg bg-status-bg-danger px-3 py-2 font-thai text-[12px] text-status-danger">⚠ {err}</div>}
    </div>
  );
}

/* ── CGM link manager (linked profiles + manual add; PATCH cgm-link) ── */
function CgmManager({ customerId, linked, onSaved }: { customerId: string; linked: string[]; onSaved: () => void }) {
  const [current, setCurrent] = useState<string[]>(linked);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = JSON.stringify([...current].sort()) !== JSON.stringify([...linked].sort());

  useEffect(() => { setCurrent(linked); }, [linked]);

  const add = () => {
    const v = input.trim();
    if (!v) return;
    setCurrent((c) => (c.includes(v) ? c : [...c, v]));
    setInput("");
  };
  const remove = (p: string) => setCurrent((c) => c.filter((x) => x !== p));

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/pulse/customers/${customerId}/cgm-link`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_names: current }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "save failed");
      onSaved();
    } catch (e: any) { setErr(e.message ?? "save error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-ink-10 bg-white p-4">
      <div className="text-[12px] font-semibold text-ink-60">โปรไฟล์ CGM ที่ผูกไว้</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {current.length === 0 ? (
          <span className="font-thai text-[12px] text-ink-40">ยังไม่ได้ผูกโปรไฟล์ CGM</span>
        ) : (
          current.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => remove(p)}
              aria-label={`เอาโปรไฟล์ ${p} ออก`}
              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-science-ultra px-3 py-1 font-mono text-[11px] text-science transition-colors hover:bg-science hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-science"
            >
              {p} <X size={11} strokeWidth={2.5} aria-hidden />
            </button>
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="min-w-[200px] flex-1">
          <span className="mb-1 block text-[11px] font-semibold text-ink-60">เพิ่มโปรไฟล์ (พิมพ์ชื่อ profile ให้ตรง)</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="เช่น nok_earth_libre"
            className="min-h-[44px] w-full rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 font-mono text-[13px] text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-science focus:ring-2 focus:ring-science/20"
          />
        </label>
        <button type="button" onClick={add} disabled={!input.trim()} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-4 py-2.5 text-[12px] font-semibold text-ink-80 transition-colors hover:border-science hover:text-science disabled:opacity-50">
          <Plus size={14} strokeWidth={2.25} aria-hidden /> เพิ่ม
        </button>
      </div>

      {err && <div className="mt-3 rounded-lg bg-status-bg-danger px-3 py-2 font-thai text-[12px] text-status-danger">⚠ {err}</div>}

      <div className="mt-4 flex items-center justify-end gap-2">
        {dirty && (
          <button type="button" onClick={() => setCurrent(linked)} className="min-h-[44px] rounded-full bg-surface px-4 py-2 text-[12px] font-semibold text-ink-60 hover:bg-ink-5">
            ยกเลิก
          </button>
        )}
        <button type="button" onClick={save} disabled={saving || !dirty} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-science px-5 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-science focus-visible:ring-offset-2">
          {saving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Check size={14} strokeWidth={2.5} aria-hidden />} บันทึก
        </button>
      </div>

      <p className="mt-3 font-thai text-[11px] leading-relaxed text-ink-60">
        หมายเหตุ: เวอร์ชันนี้ยังไม่มี API รายชื่อโปรไฟล์ CGM ทั้งระบบ จึงพิมพ์ชื่อโปรไฟล์เพื่อผูกเอง (ค่าน้ำตาลจะดึงจากชื่อนี้)
      </p>
    </div>
  );
}
