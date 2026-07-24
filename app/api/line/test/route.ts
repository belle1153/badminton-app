import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";

/**
 * Admin-only LINE diagnostics. Open /api/line/test logged in as admin.
 *
 * Read-only by default — it reports the token/group/quota state WITHOUT sending
 * anything, because a push costs one of the monthly quota it is meant to
 * diagnose (the old version always sent, so checking a "quota exhausted" problem
 * spent quota). Add ?send=1 to actually push a test message.
 *
 *   quota.value / consumption.totalUsage → how much of the month is left
 *   status 401 → bad/expired token
 *   status 403 → the bot isn't in the group LINE_GROUP_ID points at
 *   status 429 → monthly push limit reached (replies still work — they're free)
 * The token is never returned; the group id is masked.
 */
const PUSH_URL = "https://api.line.me/v2/bot/message/push";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_GROUP_ID;
  if (!token) return NextResponse.json({ ok: false, reason: "no LINE_CHANNEL_ACCESS_TOKEN" });
  if (!to) return NextResponse.json({ ok: false, reason: "no LINE_GROUP_ID" });

  const mask = to.length > 8 ? `${to.slice(0, 5)}…${to.slice(-4)}` : "(too short)";
  const auth = { Authorization: `Bearer ${token}` };
  const read = async (url: string) => {
    try {
      const r = await fetch(url, { headers: auth });
      const text = (await r.text()).slice(0, 300);
      try {
        return { status: r.status, ...JSON.parse(text) };
      } catch {
        return { status: r.status, body: text };
      }
    } catch (e) {
      return { error: String(e) };
    }
  };

  const [quota, consumption, botInfo] = await Promise.all([
    read("https://api.line.me/v2/bot/message/quota"),
    read("https://api.line.me/v2/bot/message/quota/consumption"),
    read("https://api.line.me/v2/bot/info"),
  ]);

  const diagnostics = {
    groupIdMasked: mask,
    tokenLen: token.length,
    quota,
    consumption,
    botInfo,
    note: "reply messages are free and unlimited; only push/broadcast use the quota",
  };

  if (req.nextUrl.searchParams.get("send") !== "1") {
    return NextResponse.json({ sentTestMessage: false, ...diagnostics });
  }

  try {
    const res = await fetch(PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({
        to,
        messages: [{ type: "text", text: "🔔 ทดสอบแจ้งเตือนจากระบบ Tua Tueng Go!" }],
      }),
    });
    const body = await res.text();
    return NextResponse.json({
      sentTestMessage: true,
      ok: res.ok,
      status: res.status,
      lineResponse: body.slice(0, 400),
      ...diagnostics,
    });
  } catch (e) {
    return NextResponse.json({ sentTestMessage: true, ok: false, error: String(e), ...diagnostics });
  }
}
