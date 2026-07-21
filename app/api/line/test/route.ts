import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";

/**
 * Admin-only push tester. Open /api/line/test in the browser (logged in as
 * admin) — it pushes one test message to LINE_GROUP_ID and returns exactly what
 * LINE said, so a broken notification is diagnosable without reading logs:
 *   - ok:true, status:200 → works (a "🔔 ทดสอบ" message appears in the group)
 *   - status:403 → the bot isn't in the group this LINE_GROUP_ID points at
 *   - status:400 → the group id is malformed / wrong
 *   - reason:"no LINE_GROUP_ID" / "no token" → env not set (or not redeployed)
 * The token is never returned; the group id is masked.
 */
const PUSH_URL = "https://api.line.me/v2/bot/message/push";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_GROUP_ID;
  if (!token) return NextResponse.json({ ok: false, reason: "no LINE_CHANNEL_ACCESS_TOKEN" });
  if (!to) return NextResponse.json({ ok: false, reason: "no LINE_GROUP_ID" });

  const mask = to.length > 8 ? `${to.slice(0, 5)}…${to.slice(-4)}` : "(too short)";
  try {
    const res = await fetch(PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        to,
        messages: [{ type: "text", text: "🔔 ทดสอบแจ้งเตือนจากระบบ Tua Tueng Go!" }],
      }),
    });
    const body = await res.text();
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      groupIdMasked: mask,
      tokenLen: token.length,
      lineResponse: body.slice(0, 400),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), groupIdMasked: mask });
  }
}
