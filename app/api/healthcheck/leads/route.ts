import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

/** Coach lists their leads · admin sees all */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const url = new URL(req.url);
    const status = url.searchParams.get("status"); // new/contacted/converted/dismissed
    const limit  = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

    const supa = createClient();
    let q = supa.from("healthcheck_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ leads: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
