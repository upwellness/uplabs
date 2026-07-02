import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { VIEW_AS_COOKIE } from "@/lib/auth/view-as-constants";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/join",                    // invitation self-signup page (token-authorized)
  "/api/join",                // invitation self-signup submit (token-authorized)
  "/auth/callback",
  "/setup",
  "/connect",                 // UP Pulse customer-facing connect flow
  "/api/pulse/oauth",         // OAuth start + callback (called by Google)
  "/intake",                  // UP Pulse customer-facing intake form
  "/api/pulse/intakes",       // intake submit (POST by token — no auth)
  "/api/pulse/share",         // public report fetch
  "/r",                       // public report page
  "/check",                   // Public Health Check form (lead capture)
  "/metaflex",                // Public MetaFlex Quiz (lead capture)
  "/api/check",               // Public submit endpoint
  // NOTE: "/v2" is intentionally NOT public — v2 now renders real customer data and
  // must require login like the rest of the app (was public only while it was a static mockup).
  "/cgm-v1.html",             // CGM Analyzer static embed (iframe·does its own Supabase auth) — กัน middleware เด้ง iframe → /login → จอเปล่า
  "/api/line/webhook",        // LINE bot webhook — called by LINE (no session) · auth = x-line-signature in the route
  "/api/line/push-tomorrow",  // LINE bot cron push — called by Vercel Cron (no session) · auth = CRON_SECRET in the route
];

const isPublic = (path: string) =>
  PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail-safe: if Supabase env not configured, render an explicit setup page
  // for non-public routes instead of crashing the whole site with a 500.
  if (!url || !key) {
    const path = req.nextUrl.pathname;
    if (isPublic(path)) return NextResponse.next();
    const redirect = req.nextUrl.clone();
    redirect.pathname = "/setup";
    return NextResponse.rewrite(redirect);
  }

  let res = NextResponse.next({ request: { headers: req.headers } });

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          req.cookies.set({ name, value, ...options });
          res = NextResponse.next({ request: { headers: req.headers } });
          res.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          req.cookies.set({ name, value: "", ...options });
          res = NextResponse.next({ request: { headers: req.headers } });
          res.cookies.set({ name, value: "", ...options });
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    const path = req.nextUrl.pathname;

    if (user && (path === "/login" || path === "/forgot-password")) {
      const u = req.nextUrl.clone();
      u.pathname = "/";
      return NextResponse.redirect(u);
    }

    if (!user && !isPublic(path)) {
      // For API routes, return 401 JSON instead of redirecting to /login.
      // Browser fetch follows 307 redirect → receives login page HTML
      // → client JSON.parse fails with "Unexpected token '<'".
      if (path.startsWith("/api/")) {
        return NextResponse.json(
          { error: "unauthenticated", redirect: "/login" },
          { status: 401 },
        );
      }
      const u = req.nextUrl.clone();
      u.pathname = "/login";
      u.searchParams.set("next", path);
      return NextResponse.redirect(u);
    }

    // Admin "view as" mode is read-only — block every mutating API call while active.
    // (Cookie is httpOnly and only ever set by lib/auth/view-as.ts's admin-gated action,
    // so its mere presence is enough to deny; no need to re-verify role here.)
    if (path.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.cookies.get(VIEW_AS_COOKIE)?.value) {
        return NextResponse.json(
          { error: "view_as_read_only", message: "โหมด View-As เป็นแบบดูอย่างเดียว ไม่สามารถบันทึกข้อมูลได้" },
          { status: 403 },
        );
      }
    }

    return res;
  } catch (err) {
    console.error("[middleware] auth check failed:", err);
    // Allow public paths through; rewrite the rest to a friendly health page.
    if (isPublic(req.nextUrl.pathname)) return NextResponse.next();
    // API routes should get JSON error, not HTML page.
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "middleware_auth_check_failed" },
        { status: 500 },
      );
    }
    const redirect = req.nextUrl.clone();
    redirect.pathname = "/setup";
    return NextResponse.rewrite(redirect);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
