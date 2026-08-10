import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, getDemoAuthConfigStatus, verifySessionToken } from "@/lib/auth/session";

const PUBLIC_PATHS = new Set(["/login"]);
const PUBLIC_API_PATHS = new Set(["/api/session"]);

/**
 * Gates the entire app behind a single shared demo password (see
 * src/lib/auth/session.ts) - not a user account system. Runs on every
 * request (pages and API routes alike) before anything else, so an
 * unauthenticated visitor can never reach the dashboard or call an API
 * route regardless of how they got there. (Named "proxy" per Next.js 16 -
 * this file convention was called "middleware" before.)
 *
 * Only ever verifies the signed cookie itself (no database lookup), per
 * Next's own guidance for this file: it runs on every request including
 * prefetches, so it must stay fast and side-effect-free.
 *
 * Local-dev convenience: if DEMO_PASSWORD isn't set at all, the gate is
 * skipped in development so `npm run dev` keeps working out of the box.
 * In production (Vercel deployments always set NODE_ENV=production) a
 * missing DEMO_PASSWORD instead fails closed - nobody can log in until
 * it's configured, which is the safe default for a real deployment.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const authStatus = getDemoAuthConfigStatus();
  if (!authStatus.configured && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = await verifySessionToken(token);

  if (authenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("next", pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
