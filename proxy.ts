import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/adminCookie";

/**
 * One choke point for the whole admin side (Next 16's `proxy`, formerly
 * `middleware`). Every admin page/route also checks isAdmin() itself, but this
 * runs first so:
 *   - a new admin route can't be exposed by forgetting the check, and
 *   - the admin side isn't advertised: without a valid cookie these paths just
 *     404 instead of answering with a PIN box that says "admin lives here".
 *
 * /admin/login is the only door in — log in there, then the rest opens up.
 * (The PIN gate that used to appear on /session/<id>/admin is unreachable now;
 * it stays in place only as a fallback if this proxy is ever bypassed.)
 */
const OPEN_PATHS = new Set(["/admin/login", "/api/admin/login", "/api/admin/logout"]);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (OPEN_PATHS.has(pathname)) return NextResponse.next();

  if (await verifyAdminToken(req.cookies.get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.next();
  }

  return new NextResponse("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/session/new",
    "/session/:id/admin",
    "/session/:id/admin/:path*",
    "/api/admin/:path*",
  ],
};
