import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Serve a customer's Medication & Supplement Map (interactive HTML) behind auth.
 *
 * The report contains sensitive clinical data (psychiatric meds, allergies), so it
 * is NEVER placed in /public. It lives in lib/reports/med-map/<customerId>.html and
 * is returned only to the owning coach (or admin) after a session + ownership check.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new NextResponse("unauthorized", { status: 401 });

  // path-traversal guard — id must be a plain UUID before it touches the filesystem
  if (!/^[0-9a-fA-F-]{36}$/.test(params.id)) {
    return new NextResponse("bad id", { status: 400 });
  }

  const admin = createAdminClient();
  const { data: customer } = await admin
    .from("customers").select("id, coach_id").eq("id", params.id).maybeSingle();
  if (!customer) return new NextResponse("customer not found", { status: 404 });

  const isAdmin = session.profile.role === "admin";
  if (!isAdmin && customer.coach_id !== session.user.id) {
    return new NextResponse("forbidden", { status: 403 });
  }

  try {
    const file = path.join(process.cwd(), "lib/reports/med-map", `${params.id}.html`);
    const html = await readFile(file, "utf8");
    return new NextResponse(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("ยังไม่มีรายงานแผนผังยาสำหรับลูกค้ารายนี้", { status: 404 });
  }
}
