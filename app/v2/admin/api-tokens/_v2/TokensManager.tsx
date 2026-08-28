"use client";

import { useState, useTransition } from "react";
import { KeyRound, Plus, Ban, Copy, Check, ScrollText, AlertTriangle, X } from "lucide-react";
import { SCOPES, SCOPE_LABEL_TH, CLINICAL_SCOPES, type Scope } from "@/lib/api/scopes";
import { createToken, revokeToken, listLogs, type TokenListRow, type CoachOption, type LogRow } from "../actions";

/**
 * Admin screen for External API tokens.
 *
 * The one interaction that matters: after creating a token the full value is shown
 * in a modal that cannot be reopened. The copy in that modal says so plainly,
 * because the failure mode is an admin closing it and assuming they can look it up
 * later — they cannot, only the hash is stored.
 */
export function TokensManager({
  tokens, coaches, initialLogs,
}: { tokens: TokenListRow[]; coaches: CoachOption[]; initialLogs: LogRow[] }) {
  const [showForm, setShowForm] = useState(false);
  const [minted, setMinted] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogRow[]>(initialLogs);
  const [logFilter, setLogFilter] = useState<string>("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-ink">
            <KeyRound className="h-6 w-6 text-rose" /> API Token สำหรับระบบภายนอก
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-60">
            ให้ ChatGPT · n8n · หรือสคริปต์ ดึงข้อมูลจาก UP Labs ได้ตามสิทธิ์ที่กำหนด ·
            แต่ละ token กำหนดได้ว่าอ่าน/เขียนอะไรได้ และเห็นลูกค้าของใครบ้าง
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-deep"
        >
          <Plus className="h-4 w-4" /> สร้าง token ใหม่
        </button>
      </header>

      {showForm && (
        <CreateForm
          coaches={coaches}
          onDone={(token) => { setShowForm(false); if (token) setMinted(token); }}
        />
      )}

      {minted && <MintedDialog token={minted} onClose={() => setMinted(null)} />}

      <section className="overflow-hidden rounded-2xl border border-ink-10 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-surface text-xs text-ink-60">
              <tr>
                <th className="p-3 text-left font-semibold">ชื่อ</th>
                <th className="p-3 text-left font-semibold">token</th>
                <th className="p-3 text-left font-semibold">สิทธิ์</th>
                <th className="p-3 text-left font-semibold">ขอบเขตลูกค้า</th>
                <th className="p-3 text-left font-semibold">ใช้ล่าสุด</th>
                <th className="p-3 text-right font-semibold">7 วัน</th>
                <th className="p-3 text-left font-semibold">สถานะ</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {tokens.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-ink-40">ยังไม่มี token — กด "สร้าง token ใหม่"</td></tr>
              )}
              {tokens.map((t) => {
                const expired = t.expires_at && new Date(t.expires_at) < new Date();
                const dead = !!t.revoked_at || !!expired;
                return (
                  <tr key={t.id} className={`border-t border-ink-10 ${dead ? "opacity-55" : ""}`}>
                    <td className="p-3">
                      <div className="font-medium text-ink">{t.name}</div>
                      {t.note && <div className="text-xs text-ink-40">{t.note}</div>}
                    </td>
                    <td className="p-3 font-mono text-xs text-ink-60">{t.masked}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {t.scopes.map((s) => (
                          <span key={s} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            s.endsWith(":write") ? "bg-amber-pale text-amber" : "bg-science-pale text-science"
                          }`}>{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-ink-60">{describeScope(t.customer_scope, coaches)}</td>
                    <td className="p-3 text-xs text-ink-60">{t.last_used_at ? fmt(t.last_used_at) : "—"}</td>
                    <td className="p-3 text-right tabular-nums text-ink-60">{t.calls_7d}</td>
                    <td className="p-3 text-xs">
                      {t.revoked_at ? <span className="text-status-danger">เพิกถอนแล้ว</span>
                        : expired ? <span className="text-status-warning">หมดอายุ</span>
                        : <span className="text-status-good">ใช้งานได้</span>}
                      {t.expires_at && !t.revoked_at && (
                        <div className="text-ink-40">ถึง {fmt(t.expires_at)}</div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {!dead && (
                        <button
                          disabled={pending}
                          onClick={() => {
                            if (!confirm(`เพิกถอน "${t.name}" ใช่ไหม? ระบบที่ใช้ token นี้อยู่จะเรียกไม่ได้ทันที และย้อนกลับไม่ได้`)) return;
                            startTransition(async () => { await revokeToken(t.id); });
                          }}
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-ink-10 px-3 text-xs text-status-danger transition-colors hover:bg-rose-ultra disabled:opacity-50"
                        >
                          <Ban className="h-3.5 w-3.5" /> เพิกถอน
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-ink-10 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <ScrollText className="h-4 w-4 text-science" /> บันทึกการเรียก (200 รายการล่าสุด)
          </h2>
          <select
            value={logFilter}
            onChange={(e) => {
              const v = e.target.value; setLogFilter(v);
              startTransition(async () => setLogs(await listLogs(v || undefined)));
            }}
            className="min-h-9 rounded-lg border border-ink-10 bg-white px-3 text-sm"
          >
            <option value="">ทุก token</option>
            {tokens.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="sticky top-0 bg-surface text-ink-60">
              <tr>
                <th className="p-2 text-left font-semibold">เวลา</th>
                <th className="p-2 text-left font-semibold">token</th>
                <th className="p-2 text-left font-semibold">เส้นทาง</th>
                <th className="p-2 text-left font-semibold">intent</th>
                <th className="p-2 text-left font-semibold">คำสั่ง</th>
                <th className="p-2 text-right font-semibold">สถานะ</th>
                <th className="p-2 text-right font-semibold">ms</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-ink-40">ยังไม่มีการเรียก</td></tr>}
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-ink-10">
                  <td className="p-2 whitespace-nowrap text-ink-60">{fmt(l.ts, true)}</td>
                  <td className="p-2 font-mono text-ink-40">{l.token_prefix ?? "—"}</td>
                  <td className="p-2 font-mono text-ink-60">{l.method} {l.path}</td>
                  <td className="p-2 text-ink-60">{l.intent ?? "—"}</td>
                  <td className="p-2 max-w-[220px] truncate text-ink-40" title={l.q ?? ""}>{l.q ?? "—"}</td>
                  <td className={`p-2 text-right font-semibold ${
                    (l.status ?? 0) < 300 ? "text-status-good" : (l.status ?? 0) < 500 ? "text-status-caution" : "text-status-danger"
                  }`}>
                    {l.status}{l.error ? ` ${l.error}` : ""}
                  </td>
                  <td className="p-2 text-right tabular-nums text-ink-40">{l.duration_ms ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CreateForm({ coaches, onDone }: { coaches: CoachOption[]; onDone: (token: string | null) => void }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [scopes, setScopes] = useState<Scope[]>(["customers:read", "labs:read"]);
  const [kind, setKind] = useState<"all" | "coach" | "list">("coach");
  const [coachId, setCoachId] = useState(coaches[0]?.id ?? "");
  const [customerIds, setCustomerIds] = useState("");
  const [expires, setExpires] = useState<string>("90");
  const [rate, setRate] = useState("60");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (s: Scope) => setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  const writeCount = scopes.filter((s) => s.endsWith(":write")).length;
  const clinicalCount = scopes.filter((s) => (CLINICAL_SCOPES as string[]).includes(s)).length;

  return (
    <section className="rounded-2xl border border-rose-pale bg-rose-ultra p-5">
      <h2 className="text-base font-semibold text-ink">สร้าง token ใหม่</h2>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-ink-80">ชื่อ (ให้รู้ว่าใครใช้)</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="เช่น ผู้ช่วย ChatGPT ของต้น"
            className="mt-1 min-h-11 w-full rounded-xl border border-ink-10 bg-white px-3 text-sm" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-80">หมายเหตุ (ไม่บังคับ)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-ink-10 bg-white px-3 text-sm" />
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-ink-80">สิทธิ์ที่ให้ (เลือกเท่าที่จำเป็น)</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SCOPES.map((s) => (
            <label key={s} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-ink-10 bg-white px-3 text-sm">
              <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggle(s)} className="h-4 w-4 accent-rose" />
              <span className="flex-1">{SCOPE_LABEL_TH[s]}</span>
              <code className="text-[10px] text-ink-40">{s}</code>
            </label>
          ))}
        </div>
        {writeCount > 0 && (
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-pale px-3 py-2 text-xs text-amber">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            token นี้<b className="mx-1">เขียนข้อมูลได้ {writeCount} อย่าง</b> — ให้เฉพาะระบบที่เชื่อถือได้จริง
          </p>
        )}
        {clinicalCount > 0 && (
          <p className="mt-2 text-xs text-ink-60">
            มีสิทธิ์อ่านข้อมูลสุขภาพ {clinicalCount} หมวด — ข้อมูลที่ส่งออกไปจะมีค่าตรวจจริงของลูกค้า
          </p>
        )}
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-ink-80">เห็นลูกค้าของใคร</legend>
        <div className="mt-2 space-y-2">
          {([["coach", "ของโค้ชคนหนึ่ง + สายงานลงไปทั้งหมด"], ["list", "เฉพาะลูกค้าที่ระบุ"], ["all", "ทุกคนในระบบ (ระวัง)"]] as const).map(([k, label]) => (
            <label key={k} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-ink-10 bg-white px-3 text-sm">
              <input type="radio" name="scopekind" checked={kind === k} onChange={() => setKind(k)} className="h-4 w-4 accent-rose" />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {kind === "coach" && (
          <select value={coachId} onChange={(e) => setCoachId(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-ink-10 bg-white px-3 text-sm">
            {coaches.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        )}
        {kind === "list" && (
          <textarea value={customerIds} onChange={(e) => setCustomerIds(e.target.value)}
            rows={3} placeholder="customer id คั่นด้วย comma หรือขึ้นบรรทัดใหม่"
            className="mt-2 w-full rounded-xl border border-ink-10 bg-white px-3 py-2 font-mono text-xs" />
        )}
        {kind === "all" && (
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-rose-pale px-3 py-2 text-xs text-rose-deep">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            token นี้จะเห็นลูกค้า<b className="mx-1">ทุกคน</b>ในระบบ — ใช้เฉพาะเครื่องมือของแอดมินเท่านั้น
          </p>
        )}
      </fieldset>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-ink-80">หมดอายุใน</span>
          <select value={expires} onChange={(e) => setExpires(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-ink-10 bg-white px-3 text-sm">
            <option value="30">30 วัน</option>
            <option value="90">90 วัน</option>
            <option value="365">1 ปี</option>
            <option value="">ไม่หมดอายุ</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-80">จำกัดการเรียก (ครั้ง/นาที)</span>
          <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="numeric"
            className="mt-1 min-h-11 w-full rounded-xl border border-ink-10 bg-white px-3 text-sm" />
        </label>
      </div>

      {error && <p className="mt-3 rounded-xl bg-rose-pale px-3 py-2 text-sm text-rose-deep">{error}</p>}

      <div className="mt-5 flex gap-2">
        <button
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await createToken({
                name, note, scopes,
                customerScopeKind: kind,
                coachId: kind === "coach" ? coachId : undefined,
                customerIds: kind === "list" ? customerIds : undefined,
                expiresInDays: expires ? Number(expires) : null,
                rateLimit: Number(rate) || 60,
              });
              if (res.ok) onDone(res.token); else setError(res.error);
            });
          }}
          className="min-h-11 rounded-xl bg-rose px-5 text-sm font-semibold text-white transition-colors hover:bg-rose-deep disabled:opacity-50"
        >
          {pending ? "กำลังสร้าง…" : "สร้าง token"}
        </button>
        <button onClick={() => onDone(null)}
          className="min-h-11 rounded-xl border border-ink-10 bg-white px-5 text-sm text-ink-60">ยกเลิก</button>
      </div>
    </section>
  );
}

function MintedDialog({ token, onClose }: { token: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-ink">คัดลอก token เดี๋ยวนี้</h2>
          <button onClick={onClose} aria-label="ปิด" className="rounded-lg p-1 text-ink-40 hover:bg-ink-5">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-pale px-3 py-2 text-sm text-amber">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ระบบเก็บไว้แค่ลายเซ็นของ token ไม่ได้เก็บตัวเต็ม — <b className="mx-1">ปิดหน้าต่างนี้แล้วจะดูอีกไม่ได้</b> ถ้าทำหาย ต้องสร้างใหม่
        </p>
        <div className="mt-3 break-all rounded-xl border border-ink-10 bg-surface p-3 font-mono text-sm">{token}</div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={async () => {
              try { await navigator.clipboard.writeText(token); setCopied(true); setTimeout(() => setCopied(false), 2000); }
              catch { /* clipboard blocked — the value is on screen to select manually */ }
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose px-4 text-sm font-semibold text-white hover:bg-rose-deep"
          >
            {copied ? <><Check className="h-4 w-4" /> คัดลอกแล้ว</> : <><Copy className="h-4 w-4" /> คัดลอก</>}
          </button>
          <button onClick={onClose} className="min-h-11 rounded-xl border border-ink-10 px-4 text-sm text-ink-60">
            คัดลอกแล้ว ปิดได้เลย
          </button>
        </div>
      </div>
    </div>
  );
}

function describeScope(scope: string, coaches: CoachOption[]): string {
  if (!scope || scope === "all") return "ทุกคนในระบบ";
  if (scope.startsWith("coach:")) {
    const id = scope.slice(6);
    return `โค้ช: ${coaches.find((c) => c.id === id)?.label ?? id.slice(0, 8)} + สายงาน`;
  }
  if (scope.startsWith("list:")) {
    const n = scope.slice(5).split(",").filter(Boolean).length;
    return `เฉพาะ ${n} คนที่ระบุ`;
  }
  return scope;
}

function fmt(iso: string, withTime = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("th-TH", {
    day: "numeric", month: "short", year: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
