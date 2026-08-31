import { getSession } from "@/lib/auth/session";
import { Shell } from "../_components/Shell";
import { listPending } from "./actions";
import { InboxClient } from "./_v2/InboxClient";

export const dynamic = "force-dynamic";

/**
 * UP Labs v2 · Lab review inbox
 * ─────────────────────────────
 * Everything an AI assistant submitted through POST /api/v1/customers/{id}/labs/submit
 * waits here. Nothing on this page is part of a customer's history yet — a person
 * compares it against the real slip and confirms first.
 * Spec: docs/SPEC-External-API.md
 */
export default async function V2LabInboxPage() {
  const session = await getSession();
  const rows = await listPending();

  return (
    <Shell
      breadcrumb={[{ label: "หน้าแรก", href: "/v2" }, { label: "ผลแล็บรอตรวจ" }]}
      profile={session?.profile ?? undefined}
    >
      <div className="mb-5">
        <h1 className="font-head text-[24px] font-extrabold tracking-tight text-ink">
          ผลแล็บรอตรวจสอบ
          {rows.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-pale px-2.5 py-1 align-middle font-mono text-[13px] text-amber">
              {rows.length}
            </span>
          )}
        </h1>
        <p className="mt-1 max-w-2xl font-thai text-[13px] text-ink-60">
          ผลแล็บที่ผู้ช่วย AI อ่านจากเอกสารแล้วส่งเข้ามา · <b>ยังไม่ได้อยู่ในประวัติลูกค้า</b> จนกว่าจะกดยืนยัน ·
          แก้ค่าตรงช่องได้เลย ระบบบันทึกตามที่แก้
        </p>
      </div>
      <InboxClient rows={rows} />
    </Shell>
  );
}
