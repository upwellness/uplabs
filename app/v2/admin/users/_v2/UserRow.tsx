"use client";

/**
 * UP Labs v2 · Admin Users · one user row (clinical-warm)
 * ────────────────────────────────────────────────────────
 * Mirrors EVERY v1 UserRow capability, reusing the SAME server actions:
 *   - role select (updateUserRole)
 *   - inline identity edits: display_name / email / abo_number / phone
 *   - password reset email (sendResetEmail) + copy recovery link (generateResetLink)
 *   - app grants with optimistic toggle (toggleAppGrant)
 *   - managed customers (read-only links)
 *   - Assign customer · co-coach: search → assign (assignCustomer) / unassign (unassignCustomer)
 *
 * Responsive: a 5-col grid on lg+, stacked label/value on mobile. The expandable
 * management panel is keyboard-toggled and uses the single status/token system.
 */

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown, Mail, Link2, Copy, Check, Loader2, UserCog, KeyRound,
  AppWindow, Users2, UserPlus, X, Search, ExternalLink, Save,
} from "lucide-react";
import { ROLES, ROLE_LABEL_TH, ROLE_COLOR, type Role } from "@/lib/auth/roles";
import { APPS } from "@/lib/apps-registry";
import { formatDate } from "@/lib/utils";
import { initials } from "@/lib/v2/identity";
import {
  updateUserRole, updateUserEmail, updateDisplayName,
  updateAboNumber, updatePhone,
  sendResetEmail, generateResetLink, toggleAppGrant,
  assignCustomer, unassignCustomer,
  type UserListRow, type AssignableCustomer,
} from "@/app/admin/users/actions";

export function UserRow({ user, allCustomers }: { user: UserListRow; allCustomers: AssignableCustomer[] }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [linkOut, setLinkOut] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailEdit, setEmailEdit] = useState(user.email ?? "");
  const [nameEdit, setNameEdit] = useState(user.display_name ?? "");
  const [aboEdit, setAboEdit] = useState(user.abo_number ?? "");
  const [phoneEdit, setPhoneEdit] = useState(user.phone ?? "");
  const [assignQuery, setAssignQuery] = useState("");
  const [, start] = useTransition();
  const router = useRouter();

  /** Optimistic mirror of granted_app_slugs — flips instantly on click. */
  const [grants, setGrants] = useState<Set<string>>(() => new Set(user.granted_app_slugs));
  useEffect(() => { setGrants(new Set(user.granted_app_slugs)); }, [user.granted_app_slugs]);

  const run = async (key: string, fn: () => Promise<{ error?: string; ok?: boolean; url?: string | null } | void>) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    if (r && "error" in r && r.error) { alert(`ผิดพลาด: ${r.error}`); return; }
    if (r && "url" in r && r.url) setLinkOut(r.url);
    router.refresh();
  };

  const handleGrantToggle = (slug: string, checked: boolean) => {
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

  const copyLink = async () => {
    if (!linkOut) return;
    try { await navigator.clipboard.writeText(linkOut); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt("คัดลอกลิงก์นี้:", linkOut); }
  };

  const q = assignQuery.trim().toLowerCase();
  const assignCandidates = q
    ? allCustomers.filter((c) =>
        c.coach_id !== user.id &&
        !user.assigned_customers.some((a) => a.id === c.id) &&
        c.name.toLowerCase().includes(q)).slice(0, 8)
    : [];

  return (
    <li>
      {/* Row */}
      <div className="grid grid-cols-1 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface lg:grid-cols-[minmax(0,1fr)_140px_180px_120px_96px] lg:px-5">
        {/* User identity */}
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose text-[12px] font-bold text-white">
            {initials(user.display_name ?? user.email)}
          </span>
          <div className="min-w-0">
            <div className="truncate font-head text-[14px] font-bold text-ink">{user.display_name ?? "—"}</div>
            <div className="truncate font-mono text-[11px] text-ink-60">{user.email ?? "ไม่มี email"}</div>
          </div>
        </div>

        {/* Role */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-ink-40 lg:hidden">Role</span>
          <select
            value={user.role}
            onChange={(e) => start(() => run("role", () => updateUserRole(user.id, e.target.value as Role)))}
            disabled={busy !== null}
            aria-label={`เปลี่ยน role ของ ${user.display_name ?? user.email ?? "ผู้ใช้"}`}
            className={`min-h-[36px] cursor-pointer rounded-full border-0 px-3 py-1 text-[12px] font-semibold outline-none ${ROLE_COLOR[user.role]}`}
          >
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL_TH[r]}</option>)}
          </select>
        </div>

        {/* Grants + customer badges */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-60">
          <span className="font-mono">{user.granted_app_slugs.length} สิทธิ์</span>
          {user.managed_customers.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-ultra px-1.5 py-0.5 text-[10px] font-bold text-rose">
              <Users2 size={11} strokeWidth={2.5} aria-hidden /> {user.managed_customers.length}
            </span>
          )}
          {user.assigned_customers.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-wellness/10 px-1.5 py-0.5 text-[10px] font-bold text-wellness">
              +{user.assigned_customers.length} แชร์
            </span>
          )}
        </div>

        {/* Last sign in */}
        <div className="flex items-center gap-2 font-mono text-[11px] text-ink-60">
          <span className="text-[11px] font-semibold text-ink-40 lg:hidden">เข้าระบบล่าสุด</span>
          {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : "—"}
        </div>

        {/* Manage toggle */}
        <div className="lg:text-right">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 ${
              expanded ? "bg-ink text-white" : "border border-ink-10 bg-white text-ink-60 hover:border-ink-20 hover:text-ink"
            }`}
          >
            <UserCog size={14} strokeWidth={2.25} aria-hidden /> {expanded ? "ปิด" : "จัดการ"}
            <ChevronDown size={13} strokeWidth={2.5} className={`transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
          </button>
        </div>
      </div>

      {/* Expanded management panel */}
      {expanded && (
        <div className="border-t border-ink-5 bg-surface/60 px-4 py-5 lg:px-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* ── Identity + password ── */}
            <div className="rounded-2xl border border-ink-10 bg-white p-4 lg:p-5">
              <PanelLabel icon={UserCog}>ข้อมูลผู้ใช้</PanelLabel>
              <div className="mt-3 space-y-3">
                <InlineField label="ชื่อแสดง" value={nameEdit} onChange={setNameEdit} onSave={() => run("name", () => updateDisplayName(user.id, nameEdit))} busy={busy === "name"} />
                <InlineField label="Email" type="email" value={emailEdit} onChange={setEmailEdit} onSave={() => run("email", () => updateUserEmail(user.id, emailEdit))} busy={busy === "email"} />
                <InlineField label="ABO Number" value={aboEdit} onChange={setAboEdit} onSave={() => run("abo", () => updateAboNumber(user.id, aboEdit))} busy={busy === "abo"} placeholder="7866861" />
                <InlineField label="เบอร์โทร" value={phoneEdit} onChange={setPhoneEdit} onSave={() => run("phone", () => updatePhone(user.id, phoneEdit))} busy={busy === "phone"} placeholder="0812345678" />
              </div>
              <p className="mt-2 font-thai text-[11.5px] text-ink-60">ผู้ใช้ login ด้วย email · ABO number · เบอร์โทร อย่างใดอย่างหนึ่งได้</p>

              <div className="mt-4 border-t border-ink-5 pt-4">
                <PanelLabel icon={KeyRound}>รีเซ็ตรหัสผ่าน</PanelLabel>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => start(() => run("send", () => sendResetEmail(user.email ?? "")))}
                    disabled={!user.email || busy !== null}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-rose px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-rose-mid disabled:opacity-40"
                  >
                    {busy === "send" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Mail size={13} strokeWidth={2.25} aria-hidden />}
                    ส่ง reset email
                  </button>
                  <button
                    type="button"
                    onClick={() => start(() => run("link", () => generateResetLink(user.email ?? "")))}
                    disabled={!user.email || busy !== null}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-ink-10 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink-60 transition-colors hover:border-ink-20 hover:text-ink disabled:opacity-40"
                  >
                    {busy === "link" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Link2 size={13} strokeWidth={2.25} aria-hidden />}
                    คัดลอกลิงก์รีเซ็ต
                  </button>
                </div>
                {linkOut && (
                  <button
                    type="button"
                    onClick={copyLink}
                    className="mt-3 flex w-full items-start gap-2 rounded-xl bg-ink px-3 py-2.5 text-left font-mono text-[11px] text-white transition-opacity hover:opacity-90"
                  >
                    {copied ? <Check size={13} className="mt-0.5 shrink-0 text-wellness" aria-hidden /> : <Copy size={13} className="mt-0.5 shrink-0" aria-hidden />}
                    <span className="break-all">{linkOut}</span>
                  </button>
                )}
              </div>
            </div>

            {/* ── App grants ── */}
            <div className="rounded-2xl border border-ink-10 bg-white p-4 lg:p-5">
              <PanelLabel icon={AppWindow}>สิทธิ์เข้าถึงแอป</PanelLabel>
              <p className="mt-1 font-thai text-[12px] text-ink-60">
                Role <strong>{ROLE_LABEL_TH[user.role]}</strong> เห็นแอปตาม default — ติ๊กเพิ่มเพื่อให้สิทธิ์พิเศษ
              </p>
              <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {APPS.map((app) => {
                  const byRole = app.allowedRoles.includes(user.role);
                  const granted = grants.has(app.slug);
                  const effective = byRole || granted;
                  return (
                    <label
                      key={app.slug}
                      className={`flex min-h-[44px] items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] transition-colors ${
                        byRole
                          ? "cursor-not-allowed bg-status-bg-optimal"
                          : granted
                            ? "cursor-pointer bg-rose-ultra ring-1 ring-inset ring-rose/30"
                            : "cursor-pointer bg-ink-5 hover:bg-ink-10"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={effective}
                        disabled={byRole}
                        onChange={(e) => handleGrantToggle(app.slug, e.target.checked)}
                        className="accent-rose"
                      />
                      <span className="text-[13px]" aria-hidden>{app.icon}</span>
                      <span className="flex-1 truncate font-medium text-ink">{app.name}</span>
                      {byRole && <span className="text-[9px] font-bold uppercase text-status-optimal">role</span>}
                      {!byRole && granted && <span className="text-[9px] font-bold uppercase text-rose">granted</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Managed customers ── */}
          <div className="mt-4 rounded-2xl border border-ink-10 bg-white p-4 lg:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <PanelLabel icon={Users2}>ลูกค้าที่ดูแล</PanelLabel>
                <p className="mt-1 font-thai text-[12px] text-ink-60">ลูกค้าที่ผู้ใช้คนนี้เป็นเจ้าของ ({user.managed_customers.length})</p>
              </div>
              {user.managed_customers.length > 8 && (
                <Link href="/v2/customers" className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-rose hover:underline">
                  ดูทั้งหมด <ExternalLink size={11} strokeWidth={2.5} aria-hidden />
                </Link>
              )}
            </div>
            {user.managed_customers.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-ink-10 px-4 py-6 text-center font-thai text-[12px] text-ink-40">
                ยังไม่มีลูกค้าที่ดูแล
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-1.5 md:grid-cols-3 lg:grid-cols-4">
                {user.managed_customers.slice(0, 12).map((c) => (
                  <Link
                    key={c.id}
                    href={`/v2/customers/${c.id}`}
                    className="group flex items-center gap-2 rounded-xl border border-ink-10 bg-white px-2.5 py-2 transition-all hover:border-rose/40 hover:bg-rose-ultra/40"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose text-[10px] font-bold text-white">{initials(c.name)}</span>
                    <span className="flex-1 truncate font-thai text-[12px] font-semibold text-ink">{c.name}</span>
                  </Link>
                ))}
                {user.managed_customers.length > 12 && (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-ink-10 px-2 py-2 font-mono text-[11px] text-ink-40">
                    +{user.managed_customers.length - 12}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Assigned customers (co-coach) ── */}
          <div className="mt-4 rounded-2xl border border-ink-10 bg-white p-4 lg:p-5">
            <PanelLabel icon={UserPlus}>แชร์ลูกค้าให้ช่วยดูแล (co-coach)</PanelLabel>
            <p className="mt-1 font-thai text-[12px] text-ink-60">
              แชร์ลูกค้าของคนอื่นให้ผู้ใช้คนนี้ <strong>เห็น + แก้ไขได้</strong> — เจ้าของเดิมยังเห็นเหมือนเดิม · ลบสิทธิ์ได้ทุกเมื่อ
            </p>

            {user.assigned_customers.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {user.assigned_customers.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-wellness/20 bg-wellness/10 px-2.5 py-1 text-[12px] font-semibold text-wellness">
                    <Link href={`/v2/customers/${c.id}`} className="hover:underline">{c.name}</Link>
                    <button
                      type="button"
                      onClick={() => run(`unassign-${c.id}`, () => unassignCustomer(user.id, c.id))}
                      disabled={busy !== null}
                      aria-label={`ยกเลิกสิทธิ์ ${c.name}`}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-wellness/60 transition-colors hover:bg-status-bg-danger hover:text-status-danger disabled:opacity-40"
                    >
                      <X size={12} strokeWidth={2.5} aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative mt-3">
              <Search size={15} strokeWidth={2.25} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-30" aria-hidden />
              <input
                value={assignQuery}
                onChange={(e) => setAssignQuery(e.target.value)}
                placeholder="ค้นหาลูกค้าเพื่อแชร์ให้ผู้ใช้คนนี้…"
                aria-label="ค้นหาลูกค้าเพื่อแชร์"
                className="w-full rounded-xl border border-ink-10 bg-white py-2.5 pl-10 pr-3.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-wellness focus:ring-2 focus:ring-wellness/15"
              />
            </div>
            {q && (
              <div className="mt-2 flex flex-col gap-1">
                {assignCandidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { run(`assign-${c.id}`, () => assignCustomer(user.id, c.id)); setAssignQuery(""); }}
                    disabled={busy !== null}
                    className="flex min-h-[44px] items-center justify-between rounded-xl border border-ink-10 bg-white px-3.5 py-2 text-left text-[12.5px] transition-colors hover:border-wellness/40 hover:bg-wellness/5 disabled:opacity-50"
                  >
                    <span className="font-thai font-semibold text-ink">{c.name}</span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-wellness">
                      <UserPlus size={12} strokeWidth={2.5} aria-hidden /> แชร์
                    </span>
                  </button>
                ))}
                {assignCandidates.length === 0 && (
                  <div className="px-3.5 py-2 font-thai text-[12px] text-ink-40">ไม่พบลูกค้า (หรือแชร์ไปแล้ว)</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function PanelLabel({ icon: Icon, children }: { icon: typeof UserCog; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-60">
      <Icon size={14} strokeWidth={2.25} className="text-ink-40" aria-hidden /> {children}
    </div>
  );
}

function InlineField({
  label, value, onChange, onSave, busy, type = "text", placeholder,
}: {
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
      <div className="mb-1 text-[11.5px] font-semibold text-ink-60">{label}</div>
      <div className="flex gap-2">
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-ink-10 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-30 focus:border-rose focus:ring-2 focus:ring-rose-ultra"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          aria-label={`บันทึก ${label}`}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-ink/90 disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Save size={13} strokeWidth={2.25} aria-hidden />}
          บันทึก
        </button>
      </div>
    </div>
  );
}
