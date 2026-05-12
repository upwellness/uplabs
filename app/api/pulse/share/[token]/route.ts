import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Public — fetch assessment by share_token (for customer to view) */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("pulse_assessments")
      .select("ai_output, blocked, block_reasons, created_at, sent_at, customers!inner(name)")
      .eq("share_token", params.token)
      .single();
    if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });
    // Only show if sent
    if (!data.sent_at) return NextResponse.json({ error: "not yet published" }, { status: 410 });

    return NextResponse.json({
      customer_name: (data.customers as any).name,
      ai_output:     data.ai_output,
      blocked:       data.blocked,
      block_reasons: data.block_reasons,
      created_at:    data.created_at,
      sent_at:       data.sent_at,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
