import { getSession } from "@/lib/auth/session";
import { Database } from "lucide-react";
import { Shell } from "../../_components/Shell";
import { IconChip } from "@/lib/v2/ui";
// ★ Reuse the v1 BackupClient unchanged — it already drives /api/admin/backup +
//   /api/admin/restore and uses the shared ink/rose/status tokens.
import { BackupClient } from "@/app/admin/backup/BackupClient";

export const dynamic = "force-dynamic";

/**
 * UP Labs v2 · Admin · Backup / Restore (SPEC §7.12)
 * ───────────────────────────────────────────────────
 * Same dashboard as v1 wrapped in the v2 Shell (top bar + breadcrumb). The
 * BackupClient (API/action) is reused as-is; this page only supplies the
 * clinical-warm page header. Gated to admins by app/v2/admin/layout.tsx.
 */
export default async function V2AdminBackupPage() {
  const session = await getSession();
  const breadcrumb = [{ label: "หน้าแรก", href: "/v2" }, { label: "ผู้ดูแลระบบ" }, { label: "สำรอง / กู้คืนข้อมูล" }];

  return (
    <Shell breadcrumb={breadcrumb} profile={session?.profile ?? undefined}>
      <div className="mb-1 flex items-center gap-2">
        <IconChip icon={Database} tone="amber" size={18} className="h-9 w-9" />
        <h1 className="font-head text-[23px] font-extrabold tracking-tight text-ink">สำรอง / กู้คืนข้อมูล</h1>
      </div>
      <p className="mt-1 max-w-2xl font-thai text-[13px] leading-[1.7] text-ink-60">
        ดาวน์โหลด snapshot ของฐานข้อมูล · เลือก backup ทั้งหมดหรือเฉพาะ table · ใช้สำหรับ migration ·
        disaster recovery · หรือ export เพื่อวิเคราะห์นอกระบบ
      </p>

      <BackupClient />
    </Shell>
  );
}
