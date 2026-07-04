import { gzipSync, gunzipSync } from "zlib";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Per-customer report HTML store — Supabase table `customer_report_html`, PRIVATE.
 *
 * These reports contain personal lab/imaging data, so they are NEVER committed to
 * the (public) git repo or placed in /public. The HTML is stored gzip+base64 in the
 * DB (`content_gz`) so it's compact and text-safe, and served only after an auth +
 * ownership check by the lab-report / med-map routes (or via an unguessable share token).
 */

export type ReportKind = "lab_report" | "med_map";

/** Decompressed report HTML for a customer, or null if none stored. */
export async function getReportHtml(customerId: string, kind: ReportKind = "lab_report"): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("customer_report_html")
    .select("content_gz")
    .eq("customer_id", customerId)
    .eq("kind", kind)
    .maybeSingle();
  if (!data?.content_gz) return null;
  try {
    return gunzipSync(Buffer.from(data.content_gz as string, "base64")).toString("utf8");
  } catch {
    return null;
  }
}

/** Store (upsert) a customer's report HTML, gzip+base64 compressed. */
export async function saveReportHtml(customerId: string, html: string, kind: ReportKind = "lab_report"): Promise<void> {
  const admin = createAdminClient();
  const content_gz = gzipSync(Buffer.from(html, "utf8"), { level: 9 }).toString("base64");
  const { error } = await admin
    .from("customer_report_html")
    .upsert(
      { customer_id: customerId, kind, content_gz, updated_at: new Date().toISOString() },
      { onConflict: "customer_id,kind" },
    );
  if (error) throw error;
}
