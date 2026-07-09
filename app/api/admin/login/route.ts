import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isValidPin } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  const { pin } = await req.json();
  if (typeof pin !== "string" || !isValidPin(pin)) {
    return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, pin, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
