import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not authenticated" });

  const supa = createClient();
  const isAdmin = session.profile.role === "admin";

  // Try admin path (all customers)
  const all = await supa.from("customers").select("id, name, coach_id").limit(20);

  // Also try own customers
  const own = await supa.from("customers").select("id, name, coach_id").eq("coach_id", session.user.id);

  return NextResponse.json({
    role: session.profile.role,
    isAdmin,
    user_id: session.user.id,
    all_customers: { count: all.data?.length ?? 0, data: all.data, error: all.error },
    own_customers: { count: own.data?.length ?? 0, data: own.data, error: own.error },
  });
}
