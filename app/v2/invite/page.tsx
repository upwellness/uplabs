"use client";

/**
 * UP Labs v2 · Invite new members
 * ───────────────────────────────
 * Any logged-in user can generate an invitation link. Whoever registers through
 * it joins as this user's downline (read-only visibility flows upward). The
 * invitee sets their own password + real email on the /join/[token] page.
 */

import { useEffect, useState } from "react";
import { UserPlus, Copy, Check, Trash2, Link2, Clock } from "lucide-react";
import { Shell } from "../_components/Shell";
import { LoadingState } from "@/lib/v2/ui";
import { createInvite, listMyInvites, revokeInvite, type InviteRow } from "@/lib/invites/actions";

export default function V2InvitePage() {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setInvites(await listMyInvites()); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setCreating(true); setError(null);
    const r = await createInvite(note);
    setCreating(false);
    if (r && "error" in r && r.error) { setError(r.error); return; }
    setNote("");
    if (r?.url) { await copy(r.url); }
    load();
  };

  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(url); setTimeout(() => setCopied(null), 1800); } catch {}
  };

  const revoke = async (token: string) => {
    if (!confirm("ลบลิงก์เชิญนี้?")) return;
    await revokeInvite(token);
    load();
  };

  return (
    <Shell breadcrumb={[{ label: "หน้าแรก", href: "/v2" }, { label: "ชวนสมาชิกใหม่" }]}>
      <div className="mb-5">
        <h1 className="font-head text-[24px] font-extrabold tracking-tight text-ink">ชวนสมาชิกใหม่</h1>
        <p className="mt-1 font-thai text-[13px] text-ink-60">
          สร้างลิงก์เชิญแล้วส่งให้คนที่ต้องการชวน · เขาจะตั้ง password + กรอก email เอง · เมื่อสมัครแล้วจะอยู่ในสายงานของคุณ (คุณเห็นข้อมูลลูกค้าของเขาได้แบบดูอย่างเดียว)
        </p>
      </div>

      {/* Generate */}
      <div className="mb-6 rounded-2xl border border-ink-10 bg-white p-5">
        <label className="block">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-60">โน้ต (ไม่บังคับ · เช่น ชื่อคนที่ชวน)</div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น พี่สมชาย / ทีมกรุงเทพ"
            className="mt-1.5 w-full max-w-md rounded-xl border border-ink-10 bg-white px-4 py-2.5 text-sm placeholder:text-ink-30 focus:border-rose focus:outline-none"
          />
        </label>
        {error && <div className="mt-3 rounded-xl border border-status-bg-danger bg-status-bg-danger px-4 py-2.5 text-sm text-status-danger">{error}</div>}
        <button
          type="button"
          onClick={generate}
          disabled={creating}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-rose px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-mid disabled:opacity-50"
        >
          <UserPlus size={15} strokeWidth={2.25} aria-hidden />
          {creating ? "กำลังสร้าง…" : "สร้างลิงก์เชิญ"}
        </button>
        <p className="mt-2 font-thai text-[12px] text-ink-40">ลิงก์ใช้ได้ครั้งเดียว · หมดอายุใน 14 วัน · สร้างเสร็จจะคัดลอกให้อัตโนมัติ</p>
      </div>

      {/* My invites */}
      <div className="overflow-hidden rounded-2xl border border-ink-10 bg-white">
        <div className="border-b border-ink-5 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-40">
          ลิงก์เชิญของฉัน
        </div>
        {loading ? (
          <LoadingState label="กำลังโหลด…" />
        ) : invites.length === 0 ? (
          <div className="px-5 py-8 text-center font-thai text-[13px] text-ink-40">ยังไม่มีลิงก์เชิญ — กด “สร้างลิงก์เชิญ” ด้านบน</div>
        ) : (
          <ul className="divide-y divide-ink-5">
            {invites.map((inv) => {
              const used = !!inv.used_at;
              const expired = !used && new Date(inv.expires_at).getTime() < Date.now();
              return (
                <li key={inv.token} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link2 size={14} strokeWidth={2.25} className="shrink-0 text-ink-30" aria-hidden />
                      <span className="truncate font-mono text-[12px] text-ink-60">{inv.url}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 font-thai text-[11px]">
                      {inv.note && <span className="text-ink-60">{inv.note}</span>}
                      {used ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-wellness/10 px-2 py-0.5 font-semibold text-wellness">
                          <Check size={11} strokeWidth={2.5} aria-hidden /> สมัครแล้ว
                        </span>
                      ) : expired ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ink-5 px-2 py-0.5 font-semibold text-ink-40">
                          <Clock size={11} strokeWidth={2.5} aria-hidden /> หมดอายุ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber/10 px-2 py-0.5 font-semibold text-amber">
                          <Clock size={11} strokeWidth={2.5} aria-hidden /> รอสมัคร
                        </span>
                      )}
                    </div>
                  </div>
                  {!used && !expired && (
                    <button
                      type="button"
                      onClick={() => copy(inv.url)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-60 hover:border-ink-20 hover:text-ink"
                    >
                      {copied === inv.url ? <><Check size={13} strokeWidth={2.5} aria-hidden /> คัดลอกแล้ว</> : <><Copy size={13} strokeWidth={2.25} aria-hidden /> คัดลอก</>}
                    </button>
                  )}
                  {!used && (
                    <button
                      type="button"
                      onClick={() => revoke(inv.token)}
                      aria-label="ลบลิงก์"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-40 hover:bg-status-bg-danger hover:text-status-danger"
                    >
                      <Trash2 size={15} strokeWidth={2.25} aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Shell>
  );
}
