import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/_health",
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
    redirect.pathname = "/_health";
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
      const u = req.nextUrl.clone();
      u.pathname = "/login";
      u.searchParams.set("next", path);
      return NextResponse.redirect(u);
    }

    return res;
  } catch (err) {
    console.error("[middleware] auth check failed:", err);
    // Allow public paths through; rewrite the rest to a friendly health page.
    if (isPublic(req.nextUrl.pathname)) return NextResponse.next();
    const redirect = req.nextUrl.clone();
    redirect.pathname = "/_health";
    return NextResponse.rewrite(redirect);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
