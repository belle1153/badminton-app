import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_DAYS, isValidPin, issueAdminToken } from "@/lib/adminAuth";

/**
 * Throttle guesses per client. A 4-digit PIN falls in seconds if you can spam
 * it, so after MAX_ATTEMPTS misses that IP has to sit out LOCKOUT_MS. In-memory
 * is enough here: this runs as one small app, and a restart costs an attacker
 * far more than it costs the admin.
 */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0].trim() || "unknown";
}

function lockedOutFor(key: string, now: number): number {
  const rec = attempts.get(key);
  if (!rec) return 0;
  if (now - rec.firstAt > LOCKOUT_MS) {
    attempts.delete(key);
    return 0;
  }
  if (rec.count < MAX_ATTEMPTS) return 0;
  return LOCKOUT_MS - (now - rec.firstAt);
}

function recordMiss(key: string, now: number) {
  const rec = attempts.get(key);
  if (!rec || now - rec.firstAt > LOCKOUT_MS) attempts.set(key, { count: 1, firstAt: now });
  else rec.count++;
}

export async function POST(req: NextRequest) {
  const now = Date.now();
  const key = clientKey(req);

  const waitMs = lockedOutFor(key, now);
  if (waitMs > 0) {
    return NextResponse.json(
      { error: `ลองผิดหลายครั้งเกินไป — รออีก ${Math.ceil(waitMs / 60000)} นาทีแล้วลองใหม่` },
      { status: 429 }
    );
  }

  const { pin } = await req.json();
  if (typeof pin !== "string" || !isValidPin(pin)) {
    recordMiss(key, now);
    return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
  }

  attempts.delete(key);

  const res = NextResponse.json({ ok: true });
  // A signed, expiring token — not the PIN. Stealing the cookie doesn't reveal
  // the PIN, and it stops working on its own after ADMIN_SESSION_DAYS.
  res.cookies.set(ADMIN_COOKIE_NAME, await issueAdminToken(now), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
