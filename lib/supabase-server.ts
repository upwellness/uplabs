/**
 * Server-only Supabase client.
 * Frontend never imports this — BFF API routes are the only consumers.
 * Frontend talks to `/api/*` and gets normalized JSON back.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY).");
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
