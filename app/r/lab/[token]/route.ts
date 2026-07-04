import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReportHtml } from "@/lib/reports/report-store";

export const dynamic = "force-dynamic";

/**
 * PUBLIC share link for a customer's Longevity Lab Report — no login required.
 *
 * The link is meant to be sent to the customer (the data subject) themselves.
 * Access is gated by an unguessable random share token (stored as the lab_report
 * record's source_id), NOT by the enumerable customer UUID, so the customer list
 * can't be walked. The token resolves to the owning customer, then we serve the
 * same per-customer HTML used by the auth-gated coach route.
 *
 * To revoke a link: rotate source_id on the customer_records lab_report row.
 */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  // token = 16-byte hex (32 chars). Reject anything else before touching the DB.
  if (!/^[0-9a-f]{24,64}$/.test(params.token)) {
    return new NextResponse("bad link", { status: 400 });
  }

  const admin = createAdminClient();
  const { data: rec } = await admin
    .from("customer_records")
    .select("customer_id")
    .eq("document_type", "lab_report")
    .eq("source_id", params.token)
    .maybeSingle();

  if (!rec?.customer_id) {
    return new NextResponse("ไม่พบรายงาน หรือ ลิงก์หมดอายุแล้ว", { status: 404 });
  }

  const html = await getReportHtml(rec.customer_id as string);
  if (!html) {
    return new NextResponse("ยังไม่มีรายงานสุขภาพสำหรับลิงก์นี้", { status: 404 });
  }
  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // shareable link, but keep it out of search engines / shared caches
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
