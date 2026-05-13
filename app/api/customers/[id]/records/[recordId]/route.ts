import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

/** Fetch one record with all values */
export async function GET(_req: Request, { params }: { params: { id: string; recordId: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    const supa = createClient();
    const [{ data: record }, { data: values }] = await Promise.all([
      supa.from("customer_records").select("*").eq("id", params.recordId).single(),
      supa.from("customer_lab_values").select("*").eq("record_id", params.recordId).order("category"),
    ]);
    if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ record, values: values ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; recordId: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    const supa = createClient();
    const { error } = await supa.from("customer_records").delete().eq("id", params.recordId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
