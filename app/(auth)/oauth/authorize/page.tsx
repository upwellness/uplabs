import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { getRealSession } from "@/lib/auth/session";
import { SCOPES, SCOPE_LABEL_TH, CLINICAL_SCOPES } from "@/lib/api/scopes";
import { parseAuthorizeRequest, defaultScopes, withParams, MCP_PATH } from "@/lib/oauth/core";
import { getClient } from "@/lib/oauth/store";
import { ConsentForm, type ScopeOption } from "./ConsentForm";

export const dynamic = "force-dynamic";

type Q = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * GET /oauth/authorize — the OAuth consent screen (RFC 6749 §4.1.1).
 *
 * Public in middleware so the query string survives; the login gate is here, sending
 * the *whole* URL through /login?next= and back. Errors that cannot safely be sent to
 * the client (unknown client, redirect_uri mismatch) render on this page — redirecting
 * an error to an unverified URL is the classic open-redirect.
 */
export default async function AuthorizePage({ searchParams }: { searchParams: Q }) {
  const q: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(searchParams)) q[k] = first(v);

  const h = headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;

  const client = await getClient(q.client_id ?? "");
  const parsed = parseAuthorizeRequest(q, client, `${base}${MCP_PATH}`);

  if (!parsed.ok) {
    if (parsed.redirectable && q.redirect_uri) {
      redirect(withParams(q.redirect_uri, { error: parsed.error, error_description: parsed.error_description, state: q.state }));
    }
    return (
      <Card eyebrow="Connect" title="เชื่อมต่อไม่ได้">
        <p className="font-thai text-sm text-ink-60">{parsed.error_description}</p>
        <p className="mt-2 font-mono text-[11px] text-ink-40">{parsed.error}</p>
      </Card>
    );
  }

  const session = await getRealSession();
  if (!session) {
    const qs = new URLSearchParams(Object.entries(q).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${qs}`)}`);
  }

  const { value } = parsed;
  const preset = new Set(defaultScopes(value.scopes, SCOPES));
  const scopes: ScopeOption[] = SCOPES.map((s) => ({
    key: s, label: SCOPE_LABEL_TH[s], checked: preset.has(s), clinical: (CLINICAL_SCOPES as readonly string[]).includes(s),
  }));
  const hidden: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) if (typeof v === "string") hidden[k] = v;
  const redirectHost = new URL(value.redirect_uri).host;

  return (
    <Card eyebrow="Connect" title={`${client!.client_name} ขอเชื่อมต่อ UP Labs`}>
      <div className="mb-5 space-y-1 font-thai text-sm text-ink-60">
        <p>แอปนี้จะเข้าถึงข้อมูลลูกค้า <b className="text-ink">ในนามคุณ</b> ({session!.profile.display_name || session!.profile.email}) และเห็นได้ไม่เกินที่คุณเห็นเองในระบบ</p>
        <p>หลังอนุญาต ระบบจะส่งคุณกลับไปที่ <span className="font-mono text-[12px] text-ink">{redirectHost}</span></p>
        <p className="text-[12px] text-ink-40">token มีอายุ 7 วันและต่ออายุอัตโนมัติ · เพิกถอนได้ทุกเมื่อที่ <Link href="/v2/admin/api-tokens" className="underline">API tokens</Link> (แอดมิน)</p>
      </div>
      <ConsentForm params={hidden} scopes={scopes} />
    </Card>
  );
}

function Card({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-ink-10 bg-white p-10">
      <div className="mb-6">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-rose">{eyebrow}</div>
        <h1 className="font-head text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
      </div>
      {children}
    </div>
  );
}
