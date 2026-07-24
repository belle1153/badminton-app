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

/** What LINE said, so a failed push is diagnosable from the UI that triggered
 *  it instead of only from the function logs. Never carries the token. */
export interface PushResult {
  ok: boolean;
  status?: number;
  /** LINE's error body, or why the call never went out. */
  detail?: string;
}

export async function pushLineMessage(text: string): Promise<PushResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_GROUP_ID;
  // Log why a push is skipped/failing (never the token itself) so it's
  // diagnosable from the Vercel function logs.
  if (!token) {
    console.warn("[LINE] push skipped: LINE_CHANNEL_ACCESS_TOKEN not set");
    return { ok: false, detail: "LINE_CHANNEL_ACCESS_TOKEN not set" };
  }
  if (!to) {
    console.warn("[LINE] push skipped: LINE_GROUP_ID not set");
    return { ok: false, detail: "LINE_GROUP_ID not set" };
  }
  try {
    const res = await fetch(PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      // LINE caps a text message at 5000 chars.
      body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
    });
    if (!res.ok) {
      // 401 = bad/expired token, 403 = bot not in that group / wrong group id,
      // 429 = monthly push quota used up.
      const detail = (await res.text()).slice(0, 300);
      console.warn(`[LINE] push failed ${res.status}: ${detail}`);
      return { ok: false, status: res.status, detail };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    console.warn("[LINE] push error:", e);
    return { ok: false, detail: String(e) };
  }
}
