#!/usr/bin/env node
/**
 * Supabase backup — dumps every table in the `public` schema to JSON.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/backup-supabase.mjs
 *
 * Output:
 *   backups/<timestamp>/
 *     ├── _manifest.json     (row counts, columns)
 *     ├── customers.json
 *     ├── measurements.json
 *     ├── auth-users.json    (auth.users via admin API)
 *     └── ...
 *
 * Safe to run anytime — read-only.
 */

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supa = createClient(URL, KEY, { auth: { persistSession: false } });

// Tables to back up. Auto-discovered first; falls back to this list if introspection isn't available.
const FALLBACK_TABLES = [
  "customers",
  "measurements",
  "profiles",
  "user_app_grants",
];

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = join(process.cwd(), "backups", ts);
mkdirSync(outDir, { recursive: true });

console.log(`📦 Backup → ${outDir}\n`);

async function listTables() {
  // Try information_schema; if blocked, use fallback.
  const { data, error } = await supa
    .from("information_schema.tables")
    .select("table_name")
    .eq("table_schema", "public")
    .neq("table_type", "VIEW");
  if (error || !data) return FALLBACK_TABLES;
  return data.map((r) => r.table_name);
}

async function dumpTable(name) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supa.from(name).select("*").range(from, from + PAGE - 1);
    if (error) {
      console.log(`  ⚠️  ${name}: ${error.message}`);
      return null;
    }
    all = all.concat(data ?? []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(all, null, 2));
  console.log(`  ✓ ${name.padEnd(24)} ${String(all.length).padStart(6)} rows`);
  return all.length;
}

async function dumpAuthUsers() {
  const { data, error } = await supa.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.log(`  ⚠️  auth.users: ${error.message}`);
    return null;
  }
  writeFileSync(join(outDir, "auth-users.json"), JSON.stringify(data.users, null, 2));
  console.log(`  ✓ ${"auth.users".padEnd(24)} ${String(data.users.length).padStart(6)} rows`);
  return data.users.length;
}

const manifest = { backed_up_at: new Date().toISOString(), supabase_url: URL, tables: {} };

console.log("public schema:");
const tables = await listTables();
for (const t of tables) {
  const n = await dumpTable(t);
  if (n != null) manifest.tables[t] = n;
}

console.log("\nauth schema:");
const authN = await dumpAuthUsers();
if (authN != null) manifest.tables["auth.users"] = authN;

writeFileSync(join(outDir, "_manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`\n✅ Done. ${Object.keys(manifest.tables).length} tables backed up.`);
console.log(`   ${outDir}`);
