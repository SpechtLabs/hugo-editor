import { type NextRequest, NextResponse } from "next/server";

/**
 * Lightweight gate: bounce visitors with no session cookie to /login. This is a
 * UX shortcut only — it checks for the cookie's presence, not its validity. The
 * authoritative check lives in the page (`getGitHub()`) and in every Server Action
 * (`requireGitHub()`), which is what the Next.js proxy guidance recommends.
 *
 * (Auth.js's `auth` middleware wrapper isn't compatible with Next 16's `proxy`
 * convention, so we read the cookie directly instead.)
 */

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => req.cookies.has(name));
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // /login must stay reachable even with a stale cookie (the page itself sends
  // genuinely-authenticated users home), otherwise a bad cookie loops forever.
  if (pathname === "/login") return NextResponse.next();

  if (!hasSessionCookie(req)) {
    const url = new URL("/login", req.nextUrl.origin);
    if (pathname !== "/") url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
