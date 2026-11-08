import { NextRequest, NextResponse } from "next/server";

// Fail closed for all application pages. Authentication is checked by the
// existing server-side native session endpoint, never by cookie presence alone.
const PUBLIC = new Set(["/", "/login", "/about"]);
const ASSETS = /^\/(?:_next\/|favicon\.ico$|robots\.txt$|sitemap\.xml$)/;

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Canonical host ensures __Host- session cookies remain on one origin.
  if (request.nextUrl.hostname === "www.davesbbs.com") {
    const url = request.nextUrl.clone();
    url.hostname = "davesbbs.com";
    return NextResponse.redirect(url, 308);
  }
  if (ASSETS.test(pathname) || PUBLIC.has(pathname)) return NextResponse.next();
  // API calls must return authentication errors, not HTML login redirects.
  // Their handlers must still enforce identity and area-level permissions.
  if (pathname.startsWith("/api/")) return NextResponse.next();
  try {
    // Authenticate against the local Next.js listener, not the public HTTPS
    // hostname. Server-side self-fetches through nginx can fail or be routed
    // differently from browser requests. Never derive this target from Host.
    const sessionUrl = new URL("/api/auth/session", "http://127.0.0.1:3100");
    const response = await fetch(sessionUrl, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.warn("MysticWeb page guard: session check returned", response.status);
    if (response.ok) {
      const session: unknown = await response.json();
      if (session && typeof session === "object" &&
          "authenticated" in session && session.authenticated === true)
        return NextResponse.next();
    }
  } catch (error) {
    console.warn("MysticWeb page guard: internal session check failed",
      error instanceof Error ? error.message : "unknown error");
    // Authentication unavailable: deny access. Never log cookies or tokens.
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
