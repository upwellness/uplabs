import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supa = createClient();

  const { data: { user }, error: userErr } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated", userErr });

  const { data: profile, error: profileErr } = await supa
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: grants, error: grantsErr } = await supa
    .from("user_app_grants")
    .select("app_slug")
    .eq("user_id", user.id);

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    profile,
    profileErr,
    grants,
    grantsErr,
  });
}
