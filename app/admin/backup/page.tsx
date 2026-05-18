import { BackupClient } from "./BackupClient";

export const dynamic = "force-dynamic";

export default function AdminBackupPage() {
  return (
    <div className="mx-auto max-w-content px-6 lg:px-10 py-10">
      <div className="mb-2 inline-flex items-center gap-2">
        <span className="h-px w-7 bg-amber" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber">Database Operations</span>
      </div>
      <h1 className="font-head text-[clamp(28px,3.4vw,40px)] font-extrabold tracking-[-1px] text-ink">
        Backup <span className="text-ink-30">/</span> Restore
      </h1>
      <p className="mt-3 max-w-2xl font-thai text-[14px] leading-[1.7] text-ink-60">
        ดาวน์โหลด snapshot ของฐานข้อมูล · เลือกได้ว่าจะ backup ทั้งหมดหรือเฉพาะ table · ใช้สำหรับ migration · disaster recovery · หรือ export เพื่อวิเคราะห์ off-platform
      </p>
      <BackupClient />
    </div>
  );
}
