"use client";

/**
 * Catches Supabase auth tokens carried in the URL after a redirect.
 *
 * Three cases:
 *  1. Implicit flow — `#access_token=...&refresh_token=...&type=recovery`
 *  2. PKCE flow     — `?code=...`
 *  3. None          — no-op
 *
 * In all cases the goal is the same: exchange the token into a cookie
 * session (via supabase-js) and then route the user to the right page.
 * Lives in the root layout so it runs on every page mount.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SessionInit() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const searchParams = new URLSearchParams(search);

    const access_token  = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token");
    const code          = searchParams.get("code");
    const type          = hashParams.get("type") ?? searchParams.get("type");

    if (!access_token && !code) return;

    const supa = createClient();

    (async () => {
      try {
        if (access_token && refresh_token) {
          // Implicit flow — set session directly
          const { error } = await supa.auth.setSession({ access_token, refresh_token });
          if (error) { console.error("setSession failed:", error); return; }
        } else if (code) {
          // PKCE flow — exchange code for session
          const { error } = await supa.auth.exchangeCodeForSession(code);
          if (error) { console.error("exchangeCodeForSession failed:", error); return; }
        }

        // Decide destination
        const target = type === "recovery" ? "/reset-password" : "/";

        // Strip tokens from address bar then navigate
        window.history.replaceState({}, "", target);
        // Hard reload so the server re-runs middleware with the new cookie
        window.location.replace(target);
      } catch (err) {
        console.error("SessionInit error:", err);
      }
    })();
  }, [router]);

  return null;
}
