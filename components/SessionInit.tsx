"use client";

/**
 * Detects Supabase auth tokens in URL (#access_token=... or ?code=...) on
 * page load, hands them to the browser client to be exchanged into a
 * cookie session, then routes the user to the right page.
 *
 * Why needed: middleware runs before client JS and can only read cookies.
 * Recovery / magic links arrive with tokens in the URL fragment, so the
 * middleware sees "no session" and bounces to /login. This component
 * catches that case after redirect and finishes the handshake.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SessionInit() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    const hasHashToken = hash.includes("access_token=");
    const hasCode = new URLSearchParams(search).has("code");
    if (!hasHashToken && !hasCode) return;

    const supa = createClient();

    const finish = async () => {
      // The browser client auto-detects URL tokens when first accessed.
      // Wait briefly so the cookie write completes.
      await new Promise((r) => setTimeout(r, 150));
      const { data } = await supa.auth.getSession();
      if (!data.session) return;

      // Decide where to land
      const fragmentParams = new URLSearchParams(hash.slice(1));
      const type = fragmentParams.get("type"); // recovery | magiclink | signup
      const target = type === "recovery" ? "/reset-password" : "/";

      // Clean tokens out of the URL before routing
      window.history.replaceState({}, "", target);
      router.replace(target);
      router.refresh();
    };

    finish();
  }, [router]);

  return null;
}
