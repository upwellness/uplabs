/**
 * Service-role Supabase client — bypasses RLS.
 * NEVER import this from a Client Component.
 * Only used by admin server actions and trusted server logic.
 */
import { createClient as createPlainClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  cached = createPlainClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}
