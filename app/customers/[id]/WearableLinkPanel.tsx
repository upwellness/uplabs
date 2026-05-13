"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface Connection {
  id: string;
  provider: string;
  status: string;
  connected_at: string;
  last_sync_at: string | null;
  expires_at: string;
}

export function WearableLinkPanel({ customerId, connection, readingCount }: {
  customerId: string;
  connection: Connection | null;
  readingCount: number;
}) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  const createInvite = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/pulse/invites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "invite failed");
      setInviteUrl(json.url);
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  };

  const syncNow = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/pulse/customers/${customerId}/sync`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "sync failed");
      router.refresh();
      alert(`Sync สำเร็จ — ดึงข้อมูล ${json.count} reading`);
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    alert("คัดลอกลิงก์ Google Fit แล้ว");
  };

  if (connection?.status === "active") {
    return (
      <div className="rounded-2xl border border-status-bg-optimal bg-status-bg-optimal/30 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-head text-[15px] font-bold text-status-optimal">
              ✓ Connected · Google Fit
            </div>
            <div className="mt-2 grid gap-1 font-mono text-[11px] text-ink-60">
              <div>Connected: {new Date(connection.connected_at).toLocaleString("th-TH")}</div>
              <div>Last sync:  {connection.last_sync_at ? new Date(connection.last_sync_at).toLocaleString("th-TH") : "—"}</div>
              <div>{readingCount.toLocaleString()} readings · {connection.provider}</div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={syncNow} disabled={busy}>
            {busy ? "..." : "↻ Sync Now"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink-10 bg-surface p-5">
      <div className="font-head text-[14px] font-bold text-ink">📱 ยังไม่ได้ connect Google Fit</div>
      <p className="mt-1.5 font-thai text-[12px] text-ink-60">
        สร้างลิงก์เชิญ → ส่งให้ลูกค้าทาง LINE → ลูกค้าเปิด → grant Google Fit
      </p>
      {!inviteUrl ? (
        <Button variant="rose" size="sm" className="mt-3" onClick={createInvite} disabled={busy}>
          {busy ? "..." : "+ สร้างลิงก์เชื่อมต่อ"}
        </Button>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="rounded-xl bg-ink p-3 font-mono text-[11px] text-white break-all">{inviteUrl}</div>
          <div className="flex gap-2">
            <Button variant="rose"  size="sm" onClick={copyInvite}>📋 คัดลอก</Button>
            <Button variant="ghost" size="sm" onClick={createInvite}>♻️ สร้างใหม่</Button>
          </div>
        </div>
      )}
    </div>
  );
}
