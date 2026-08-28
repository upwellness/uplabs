/**
 * Service-role Supabase client — bypasses RLS.
 * NEVER import this from a Client Component.
 * Only used by admin server actions and trusted server logic.
 *
 * ⚠️ Every query made through this client is forced to `cache: "no-store"`.
 *
 * The App Router patches global `fetch` and caches GET requests by default, and
 * supabase-js issues its queries through that same fetch. Inside a GET route handler
 * that means a *reply from the database* gets reused — `export const dynamic =
 * "force-dynamic"` controls rendering, not the fetch data cache, so it does not save
 * you here.
 *
 * How this surfaced: /api/v1 was live, an API token was revoked, and
 * `GET /api/v1/meta` kept answering 200 for it with the token's pre-revocation
 * scopes, while `POST /api/v1/query` correctly answered `token_revoked` — POST
 * handlers are never fetch-cached. A revoked credential that keeps working until a
 * cache expires is a security hole, not a staleness annoyance.
 *
 * This client reads permissions and live health data. Neither is ever safe to serve
 * from cache, so the opt-out belongs here rather than at each call site, where the
 * next person to add a route would have to remember it.
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
  cached = createPlainClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return cached;
}
