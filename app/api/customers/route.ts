import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supa = createClient();
    const isAdmin = session.profile.role === "admin";

    // Retired profiles are hidden by default — the whole point is to stop them
    // cluttering the list. ?includeDisabled=1 brings them back for the "show retired"
    // toggle; nothing is ever removed from the database.
    const includeDisabled = new URL(req.url).searchParams.get("includeDisabled") === "1";

    let query = supa.from("customers").select("*").order("name");
    if (!includeDisabled) query = query.is("disabled_at", null);
    const { data, error } = isAdmin
      ? await query
      : await query.eq("coach_id", session.user.id);

    if (error) throw error;
    return NextResponse.json({ customers: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supa = createClient();
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json();
    const { name, gender, birth_year, birth_date, height } = body;
    if (!name || !gender) {
      return NextResponse.json({ error: "name and gender are required" }, { status: 400 });
    }
    // birth_year derived from birth_date via DB trigger when birth_date provided
    const insertRow: Record<string, unknown> = { name: name.trim(), gender, height, coach_id: user.id };
    if (birth_date) insertRow.birth_date = birth_date;
    else if (birth_year) insertRow.birth_year = birth_year;

    const { data, error } = await supa
      .from("customers")
      .insert(insertRow)
      .select()
      .single();
    if (error) throw error;
    revalidateTag("dashboard");
    return NextResponse.json({ customer: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
