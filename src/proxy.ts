import { auth } from "@/auth";

/**
 * Gate the whole app behind sign-in. This is a first line of defence only — per
 * the Next.js proxy guidance, every Server Action and route handler also verifies
 * auth itself (a matcher change must never silently expose a mutation).
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLogin = pathname === "/login";

  if (!req.auth && !isLogin) {
    const url = new URL("/login", req.nextUrl.origin);
    if (pathname && pathname !== "/") url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }
  if (req.auth && isLogin) {
    return Response.redirect(new URL("/", req.nextUrl.origin));
  }
});

export const config = {
  // Everything except Auth.js's own endpoints and framework/static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
