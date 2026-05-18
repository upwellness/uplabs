import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { TABLE_NAMES } from "@/lib/backup/tables";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Admin-only · restore tables from a backup JSON file via upsert.
 *
 * Body shape (matches backup output):
 * {
 *   _meta: { ... },
 *   tables: {
 *     "customers": { row_count, rows: [...] },
 *     ...
 *   }
 * }
 *
 * Query params:
 *   ?mode=preview   — dry run · count rows per table · no DB writes
 *   ?mode=execute   — actually upsert by primary key (default: id)
 *
 * Notes:
 *   - Upsert by id (won't duplicate existing rows · updates if present)
 *   - Skip tables not in the known TABLE_NAMES allowlist
 *   - Does NOT delete rows that exist in DB but not in backup (additive only)
 *   - Does NOT restore auth.users (separate process · risky)
 */

const CHUNK = 200;

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (session.profile.role !== "admin") return NextResponse.json({ error: "admin only" }, { status: 403 });

    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") === "execute" ? "execute" : "preview";

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || !body.tables) {
      return NextResponse.json({ error: "invalid backup file · expected {tables: {...}}" }, { status: 400 });
    }

    const admin = createAdminClient();
    const report: Array<{
      table: string;
      provided: number;
      skipped?: boolean;
      reason?: string;
      upserted?: number;
      errors?: string[];
    }> = [];

    for (const [tableName, entry] of Object.entries(body.tables as Record<string, { rows: any[]; row_count?: number }>)) {
      if (!TABLE_NAMES.includes(tableName)) {
        report.push({ table: tableName, provided: 0, skipped: true, reason: "not in allowlist" });
        continue;
      }
      const rows: any[] = Array.isArray(entry?.rows) ? entry.rows : [];
      if (rows.length === 0) {
        report.push({ table: tableName, provided: 0, skipped: true, reason: "empty rows" });
        continue;
      }

      if (mode === "preview") {
        report.push({ table: tableName, provided: rows.length, upserted: 0 });
        continue;
      }

      // Execute mode: upsert in chunks
      let upserted = 0;
      const errors: string[] = [];
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await admin.from(tableName).upsert(chunk, { onConflict: "id" });
        if (error) {
          errors.push(`chunk ${i}-${i + chunk.length}: ${error.message}`);
        } else {
          upserted += chunk.length;
        }
      }
      report.push({ table: tableName, provided: rows.length, upserted, ...(errors.length ? { errors } : {}) });
    }

    if (mode === "execute") revalidateTag("dashboard");

    const totalProvided = report.reduce((s, r) => s + r.provided, 0);
    const totalUpserted = report.reduce((s, r) => s + (r.upserted ?? 0), 0);
    const totalErrors   = report.reduce((s, r) => s + (r.errors?.length ?? 0), 0);

    return NextResponse.json({
      mode,
      summary: {
        tables_processed: report.length,
        total_rows_provided: totalProvided,
        total_rows_upserted: totalUpserted,
        total_errors: totalErrors,
      },
      report,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "unknown" }, { status: 500 });
  }
}
