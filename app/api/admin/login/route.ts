import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_DAYS, isValidPin, issueAdminToken } from "@/lib/adminAuth";

/**
 * No lockout on wrong PINs: admins kept locking themselves out while trying to
 * remember the PIN, so a miss just says so and they can try again straight away.
 * Keep the production ADMIN_PIN long (not a 4-digit number) to make guessing it
 * impractical.
 */
export async function POST(req: NextRequest) {
  const { pin } = await req.json();
  if (typeof pin !== "string" || !isValidPin(pin)) {
    return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  // A signed, expiring token — not the PIN. Stealing the cookie doesn't reveal
  // the PIN, and it stops working on its own after ADMIN_SESSION_DAYS.
  res.cookies.set(ADMIN_COOKIE_NAME, await issueAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
