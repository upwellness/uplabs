import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { isAssignedToCustomer } from "@/lib/customers/access";

/** Coach/admin updates the CGM profile_name → customer linkage */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const { profile_names } = await req.json();
    if (!Array.isArray(profile_names))
      return NextResponse.json({ error: "profile_names must be array" }, { status: 400 });

    const supa = createClient();
    const { data: customer } = await supa.from("customers").select("id, coach_id").eq("id", params.id).single();
    if (!customer) return NextResponse.json({ error: "not found" }, { status: 404 });

    const isAdmin = session.profile.role === "admin";
    if (!isAdmin && customer.coach_id !== session.user.id && !(await isAssignedToCustomer(session.user.id, params.id))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const cleaned = profile_names
      .map((s: any) => typeof s === "string" ? s.trim() : "")
      .filter(Boolean);

    const { error } = await supa
      .from("customers")
      .update({ cgm_profile_names: cleaned })
      .eq("id", params.id);
    if (error) throw error;

    return NextResponse.json({ ok: true, profile_names: cleaned });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
