"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ROLES, ROLE_LABEL_TH, ROLE_COLOR, type Role } from "@/lib/auth/roles";
import { APPS } from "@/lib/apps-registry";
import { formatDate } from "@/lib/utils";
import {
  updateUserRole, updateUserEmail, updateDisplayName,
  updateAboNumber, updatePhone,
  sendResetEmail, generateResetLink, toggleAppGrant,
  type UserListRow,
} from "./actions";

export function UserRow({ user }: { user: UserListRow }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [linkOut, setLinkOut] = useState<string | null>(null);
  const [emailEdit, setEmailEdit] = useState(user.email ?? "");
  const [nameEdit,  setNameEdit]  = useState(user.display_name ?? "");
  const [aboEdit,   setAboEdit]   = useState(user.abo_number ?? "");
  const [phoneEdit, setPhoneEdit] = useState(user.phone ?? "");
  const [, start] = useTransition();
  const router = useRouter();

  /**
   * Optimistic mirror of user.granted_app_slugs · flips instantly on click so
   * the checkbox shows feedback immediately while the server round-trip + refresh
   * happens in the background. Re-syncs whenever fresh server props arrive.
   */
  const [grants, setGrants] = useState<Set<string>>(() => new Set(user.granted_app_slugs));
  useEffect(() => {
    setGrants(new Set(user.granted_app_slugs));
  }, [user.granted_app_slugs]);

  const run = async (key: string, fn: () => Promise<{ error?: string; ok?: boolean; url?: string | null } | void>) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    if (r && "error" in r && r.error) { alert(`ผิดพลาด: ${r.error}`); return; }
    if (r && "url" in r && r.url) setLinkOut(r.url);
    router.refresh();
  };

  const handleGrantToggle = (slug: string, checked: boolean) => {
    // Flip optimistically — instant visual feedback
    setGrants((prev) => {
      const next = new Set(prev);
      if (checked) next.add(slug); else next.delete(slug);
      return next;
    });
    start(async () => {
      setBusy(`grant-${slug}`);
      const r = await toggleAppGrant(user.id, slug, checked);
      setBusy(null);
      if (r && "error" in r && r.error) {
        alert(`ผิดพลาด: ${r.error}`);
        // Revert on server failure
        setGrants((prev) => {
          const next = new Set(prev);
          if (!checked) next.add(slug); else next.delete(slug);
          return next;
        });
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <tr className="border-b border-ink-5 hover:bg-surface transition-colors">
        <td className="px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose text-[12px] font-bold text-white shrink-0">
              {(user.display_name ?? user.email ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-head text-sm font-bold text-ink">{user.display_name ?? "—"}</div>
              <div className="font-mono text-[11px] text-ink-40">{user.email ?? "no email"}</div>
            </div>
          </div>
        </td>
        <td className="px-6 py-3">
          <select
            value={user.role}
            onChange={(e) => start(() => run("role", () => updateUserRole(user.id, e.target.value as Role)))}
            disabled={busy !== null}
            className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider border-0 outline-none cursor-pointer ${ROLE_COLOR[user.role]}`}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL_TH[r]}</option>
            ))}
          </select>
        </td>
        <td className="px-6 py-3">
          <div className="font-mono text-[11px] text-ink-60">
            {user.granted_app_slugs.length} grant{user.granted_app_slugs.length !== 1 ? "s" : ""}
            {user.managed_customers.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-rose-ultra px-1.5 py-0.5 text-[10px] font-bold text-rose">
                👥 {user.managed_customers.length}
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-3 font-mono text-[11px] text-ink-60">
          {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : "—"}
        </td>
        <td className="px-6 py-3 text-right">
          <Button size="sm" variant={expanded ? "primary" : "outline"} onClick={() => setExpanded(!expanded)}>
            {expanded ? "ปิด" : "จัดการ"}
          </Button>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-ink-10 bg-surface">
          <td colSpan={5} className="px-6 py-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* ── Identity ── */}
              <div className="rounded-2xl border border-ink-10 bg-white p-5">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-40">Identity</div>

                <div className="space-y-3">
                  <InlineField
                    label="Display name"
                    value={nameEdit}
                    onChange={setNameEdit}
                    onSave={() => run("name", () => updateDisplayName(user.id, nameEdit))}
                    busy={busy === "name"}
                  />
                  <InlineField
                    label="Email"
                    value={emailEdit}
                    onChange={setEmailEdit}
                    onSave={() => run("email", () => updateUserEmail(user.id, emailEdit))}
                    busy={busy === "email"}
                    type="email"
                  />
                  <InlineField
                    label="ABO Number"
                    value={aboEdit}
                    onChange={setAboEdit}
                    onSave={() => run("abo", () => updateAboNumber(user.id, aboEdit))}
                    busy={busy === "abo"}
                    placeholder="7866861"
                  />
                  <InlineField
                    label="เบอร์โทร"
                    value={phoneEdit}
                    onChange={setPhoneEdit}
                    onSave={() => run("phone", () => updatePhone(user.id, phoneEdit))}
                    busy={busy === "phone"}
                    placeholder="0812345678"
                  />
                </div>
                <p className="mt-2 font-thai text-[11px] text-ink-40">
                  ผู้ใช้สามารถ login ด้วย email · ABO number · เบอร์โทร อย่างใดอย่างหนึ่ง
                </p>

                <div className="mt-5 border-t border-ink-10 pt-4">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-40">Password Reset</div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="rose" onClick={() => start(() => run("send", () => sendResetEmail(user.email ?? "")))} disabled={!user.email || busy !== null}>
                      ส่ง reset email
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => start(() => run("link", () => generateResetLink(user.email ?? "")))} disabled={!user.email || busy !== null}>
                      Copy reset link
                    </Button>
                  </div>
                  {linkOut && (
                    <div className="mt-3 rounded-xl bg-ink p-3 font-mono text-[11px] text-white break-all">
                      <button
                        onClick={() => { navigator.clipboard.writeText(linkOut); alert("Copied!"); }}
                        className="text-left w-full hover:underline"
                      >
                        {linkOut}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── App Grants ── */}
              <div className="rounded-2xl border border-ink-10 bg-white p-5">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-40">App Permissions</div>
                <p className="mb-3 font-thai text-[12px] text-ink-60">
                  Role <strong>{ROLE_LABEL_TH[user.role]}</strong> เห็น apps ตาม default — ติ๊กเพิ่มเพื่อให้สิทธิ์พิเศษ
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {APPS.map((app) => {
                    const byRole = app.allowedRoles.includes(user.role);
                    const granted = grants.has(app.slug);
                    const effective = byRole || granted;
                    return (
                      <label
                        key={app.slug}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] transition-colors ${
                          byRole
                            ? "bg-status-bg-optimal cursor-not-allowed"
                            : granted
                              ? "bg-rose-ultra cursor-pointer ring-1 ring-inset ring-rose/30"
                              : "bg-ink-5 cursor-pointer hover:bg-ink-10"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={effective}
                          disabled={byRole}
                          onChange={(e) => handleGrantToggle(app.slug, e.target.checked)}
                          className="accent-rose"
                        />
                        <span className="text-sm">{app.icon}</span>
                        <span className="font-medium text-ink flex-1">{app.name}</span>
                        {byRole && <span className="text-[9px] font-bold uppercase text-status-optimal">role</span>}
                        {!byRole && granted && <span className="text-[9px] font-bold uppercase text-rose">granted</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Managed Customers ── */}
            <div className="mt-6 rounded-2xl border border-ink-10 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-40">Managed Customers</div>
                  <p className="mt-1 font-thai text-[12px] text-ink-60">
                    ลูกค้าที่ user คนนี้ดูแลอยู่ ({user.managed_customers.length})
                  </p>
                </div>
                {user.managed_customers.length > 8 && (
                  <Link href="/customers" className="font-mono text-[11px] font-bold text-rose hover:underline">
                    ดูทั้งหมดใน /customers →
                  </Link>
                )}
              </div>
              {user.managed_customers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ink-10 px-4 py-6 text-center font-thai text-[12px] text-ink-40">
                  ยังไม่มีลูกค้าที่ดูแล
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
                  {user.managed_customers.slice(0, 12).map((c) => {
                    const initials = c.name.replace(/^(คุณ|นาย|นาง|น\.ส\.)\s?/, "").slice(0, 2).toUpperCase();
                    return (
                      <Link
                        key={c.id}
                        href={`/customers/${c.id}`}
                        className="group flex items-center gap-2 rounded-lg border border-ink-10 bg-white px-2.5 py-2 transition-all hover:border-rose/40 hover:bg-rose-ultra/40"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose text-[10px] font-bold text-white">
                          {initials}
                        </span>
                        <span className="font-thai text-[12px] font-semibold text-ink truncate flex-1">{c.name}</span>
                        <span className="text-ink-20 text-[10px] transition-transform group-hover:translate-x-0.5 group-hover:text-rose">›</span>
                      </Link>
                    );
                  })}
                  {user.managed_customers.length > 12 && (
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-ink-10 px-2 py-2 font-mono text-[11px] text-ink-40">
                      +{user.managed_customers.length - 12} more
                    </div>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function InlineField({ label, value, onChange, onSave, busy, type = "text", placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  busy: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-60">{label}</div>
      <div className="flex gap-2">
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-lg border border-ink-10 bg-white px-3 py-2 text-sm outline-none focus:border-rose placeholder:text-ink-20"
        />
        <Button size="sm" variant="primary" onClick={onSave} disabled={busy}>
          {busy ? "..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
