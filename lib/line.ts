/**
 * LINE Messaging API — push a text message to the club group.
 *
 * Config comes from env, never code:
 *   LINE_CHANNEL_ACCESS_TOKEN — long-lived channel access token
 *   LINE_GROUP_ID             — the group to post into (from the webhook)
 *
 * If either is unset the call is a silent no-op, so sign-ups still work before
 * LINE is wired up. Never throws — a LINE outage must not break a sign-up.
 */
const PUSH_URL = "https://api.line.me/v2/bot/message/push";

export function lineConfigured(): boolean {
  return !!process.env.LINE_CHANNEL_ACCESS_TOKEN && !!process.env.LINE_GROUP_ID;
}

export async function pushLineMessage(text: string): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_GROUP_ID;
  // Log why a push is skipped/failing (never the token itself) so it's
  // diagnosable from the Vercel function logs.
  if (!token) {
    console.warn("[LINE] push skipped: LINE_CHANNEL_ACCESS_TOKEN not set");
    return false;
  }
  if (!to) {
    console.warn("[LINE] push skipped: LINE_GROUP_ID not set");
    return false;
  }
  try {
    const res = await fetch(PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      // LINE caps a text message at 5000 chars.
      body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
    });
    if (!res.ok) {
      // e.g. 403 = the bot isn't in that group / wrong LINE_GROUP_ID.
      console.warn(`[LINE] push failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    return res.ok;
  } catch (e) {
    console.warn("[LINE] push error:", e);
    return false;
  }
}
