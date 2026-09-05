import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Session refresh + route protection.
 *
 * Next 16 renamed the `middleware` convention to `proxy`; this is that file.
 *
 * Supabase access tokens are short-lived; without a refresh on each request an admin
 * gets silently signed out mid-task. This runs before every matched route, refreshes the
 * session, and redirects unauthenticated users to the login page.
 *
 * The `matcher` at the bottom deliberately EXCLUDES /r/ -- the public QR redirect must
 * never be gated by auth, and must not pay for a session lookup on the scan path.
 */
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates against Supabase; getSession() only reads the cookie and can
  // be spoofed, so it must not be used for an authorisation decision.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname.startsWith("/login");

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve intent so the admin lands where they were headed after signing in.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *  - /r/          public QR redirect (must stay fast and unauthenticated)
     *  - /api/        route handlers do their own auth checks
     *  - _next/*      framework assets
     *  - static files
     */
    "/((?!r/|api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
