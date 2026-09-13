/**
 * Monday morning LINE message to every customer with a sent plan and a bound LINE
 * group: where they stand against their 90-day goals, what is due, and their portal
 * link. Text only — the numbers come from computeProgress, nothing is composed by an LLM.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { pushMessage } from "@/lib/line/client";
import { planProgress } from "./plan-store";
import { GOAL_STATUS_TH } from "./progress";
import { DOMAIN_LABEL_TH } from "./assess";

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

export function nudgeText(name: string, p: { day: number; days_left: number; goals: { domain: keyof typeof DOMAIN_LABEL_TH; status: keyof typeof GOAL_STATUS_TH; note: string }[]; due_now: { what: string }[] }, portalUrl: string | null): string {
  const lines = [`สวัสดีวันจันทร์ค่ะ คุณ${name} 🌿 แผน 90 วัน — วันที่ ${p.day} (เหลือ ${p.days_left} วัน)`];
  for (const g of p.goals) lines.push(`• ${DOMAIN_LABEL_TH[g.domain]}: ${GOAL_STATUS_TH[g.status]}${g.status !== "no_new_data" && g.note ? ` — ${g.note}` : ""}`);
  if (p.due_now.length) lines.push(`⏰ ถึงกำหนด: ${p.due_now.map((d) => d.what).join(" · ")}`);
  if (p.goals.every((g) => g.status === "no_new_data")) lines.push("สัปดาห์นี้ลองชั่ง BCA หรือบันทึกอาหารสัก 4 วัน ระบบจะเทียบผลให้ค่ะ");
  if (portalUrl) lines.push(`ดูรายละเอียด/บันทึกอาหาร: ${portalUrl}`);
  return lines.join("\n");
}

/** Bangkok weekday: 1 = Monday. */
export const bangkokWeekday = (now = new Date()) => new Date(now.getTime() + 7 * 3_600_000).getUTCDay();

export async function sendWeeklyNudges(): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const admin = createAdminClient();
  const { data: plans } = await admin.from("health_plans").select("customer_id").eq("status", "sent");
  const ids = [...new Set((plans ?? []).map((p: any) => p.customer_id as string))];
  let sent = 0, skipped = 0; const errors: string[] = [];
  for (const cid of ids) {
    try {
      const [{ data: g }, { data: c }, pp] = await Promise.all([
        admin.from("line_bot_groups").select("line_group_id").eq("customer_id", cid).eq("push_enabled", true).limit(1).maybeSingle(),
        admin.from("customers").select("name, portal_token, disabled_at").eq("id", cid).maybeSingle(),
        planProgress(cid),
      ]);
      if (!g || !c || (c as any).disabled_at || !pp) { skipped++; continue; }
      const first = String((c as any).name ?? "").split(/\s+/)[0] || "ลูกค้า";
      const url = (c as any).portal_token ? `${siteUrl()}/my/${(c as any).portal_token}` : null;
      await pushMessage((g as any).line_group_id, [{ type: "text", text: nudgeText(first, pp.progress as any, url) }]);
      sent++;
    } catch (e: any) { errors.push(`${cid.slice(0, 8)}: ${e?.message ?? e}`); }
  }
  return { sent, skipped, errors };
}
