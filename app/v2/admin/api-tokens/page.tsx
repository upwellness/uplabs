import { getSession } from "@/lib/auth/session";
import { Shell } from "../../_components/Shell";
import { listTokens, listCoaches, listLogs } from "./actions";
import { TokensManager } from "./_v2/TokensManager";

export const dynamic = "force-dynamic";

/**
 * UP Labs v2 · Admin · API Tokens
 * ───────────────────────────────
 * Issue and revoke the credentials that let outside AI systems read UP Labs data.
 * Gated by app/v2/admin/layout.tsx (admin only); the server actions re-check anyway.
 * Spec: docs/SPEC-External-API.md
 */
export default async function V2AdminApiTokensPage() {
  const session = await getSession();
  const [tokens, coaches, logs] = await Promise.all([listTokens(), listCoaches(), listLogs()]);

  const breadcrumb = [
    { label: "หน้าแรก", href: "/v2" },
    { label: "ผู้ดูแลระบบ" },
    { label: "API Token" },
  ];

  return (
    <Shell breadcrumb={breadcrumb} profile={session?.profile ?? undefined}>
      <TokensManager tokens={tokens} coaches={coaches} initialLogs={logs} />
    </Shell>
  );
}
