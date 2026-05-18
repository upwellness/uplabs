import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { TABLES, TABLE_NAMES, AUTH_USERS_KEY } from "@/lib/backup/tables";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Admin-only · backup public-schema tables to a single JSON file.
 * Body: { tables?: string[], includeStructure?: boolean, includeAuthUsers?: boolean }
 * - omit tables to back up ALL known tables
 * - includeStructure adds column names per table (derived from first row)
 * - includeAuthUsers adds auth.users dump (via supabase admin API)
 */

async function dumpTable(admin: ReturnType<typeof createAdminClient>, name: string) {
  const PAGE = 1000;
  const all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await admin.from(name).select("*").range(from, from + PAGE - 1);
    if (error) return { error: error.message, rows: [] as any[] };
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return { rows: all };
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (session.profile.role !== "admin") return NextResponse.json({ error: "admin only" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const requested: string[] = Array.isArray(body.tables) && body.tables.length > 0
      ? body.tables
      : TABLE_NAMES;
    const includeStructure: boolean = body.includeStructure !== false;
    const includeAuthUsers: boolean = body.includeAuthUsers === true;

    // Validate table names against known list (prevent arbitrary table access)
    const validTables = requested.filter((t) => TABLE_NAMES.includes(t));
    if (validTables.length === 0) {
      return NextResponse.json({ error: "no valid tables selected" }, { status: 400 });
    }

    const admin = createAdminClient();
    const result: Record<string, unknown> = {};
    const tableResults: Record<string, { row_count: number; columns?: string[]; rows: any[]; error?: string }> = {};

    for (const t of validTables) {
      const { rows, error } = await dumpTable(admin, t);
      if (error) {
        tableResults[t] = { row_count: 0, rows: [], error };
        continue;
      }
      const entry: typeof tableResults[string] = { row_count: rows.length, rows };
      if (includeStructure && rows.length > 0) {
        entry.columns = Object.keys(rows[0]);
      }
      tableResults[t] = entry;
    }

    let authUsers: any[] | undefined;
    let authError: string | undefined;
    if (includeAuthUsers) {
      try {
        const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
        if (error) authError = error.message;
        else authUsers = data.users;
      } catch (e: any) {
        authError = e.message ?? "unknown";
      }
    }

    const totalRows = Object.values(tableResults).reduce((sum, r) => sum + r.row_count, 0);
    const payload = {
      _meta: {
        backed_up_at: new Date().toISOString(),
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        schema_version: 1,
        app: "UP Wellness Ops",
        backed_up_by: session.profile.email ?? session.profile.id,
        include_structure: includeStructure,
        include_auth_users: includeAuthUsers,
        table_count: validTables.length,
        total_rows: totalRows + (authUsers?.length ?? 0),
      },
      tables: tableResults,
      ...(authUsers !== undefined ? { [AUTH_USERS_KEY]: { row_count: authUsers.length, rows: authUsers } } : {}),
      ...(authError ? { auth_users_error: authError } : {}),
    };

    const filename = `upwellness-backup-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}

/**
 * GET — return table list with current row counts (for the UI).
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (session.profile.role !== "admin") return NextResponse.json({ error: "admin only" }, { status: 403 });

    const admin = createAdminClient();
    const counts: Record<string, number | null> = {};
    await Promise.all(
      TABLES.map(async (t) => {
        const { count, error } = await admin.from(t.name).select("*", { count: "exact", head: true });
        counts[t.name] = error ? null : (count ?? 0);
      }),
    );

    return NextResponse.json({ tables: TABLES, counts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
