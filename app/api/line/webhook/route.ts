import { NextRequest, NextResponse } from "next/server";

/**
 * LINE webhook. It just logs the source id of every event (find a new group id
 * in the Vercel function logs). It does NOT reply — the bot stays quiet in the
 * group and only speaks when the app posts a roster.
 *
 * To recover a group id without reading logs, set LINE_ECHO_ID=1 temporarily
 * and the bot will reply with the id when someone types in the group; unset it
 * for normal use so the bot never chatters.
 *
 * LINE calls this with a "Verify" ping on save (no events) — we just return 200.
 */
const REPLY_URL = "https://api.line.me/v2/bot/message/reply";

export async function POST(req: NextRequest) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const echoId = process.env.LINE_ECHO_ID === "1";
  let body: { events?: LineEvent[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  for (const event of body.events ?? []) {
    const src = event.source ?? {};
    const id = src.groupId ?? src.roomId ?? src.userId ?? "(unknown)";
    const kind = src.groupId ? "group" : src.roomId ? "room" : "user";
    console.log(`[LINE webhook] ${event.type} from ${kind} id=${id}`);

    // Off by default — only echoes the id back when explicitly turned on.
    if (echoId && token && event.type === "message" && event.replyToken) {
      const text =
        src.groupId || src.roomId
          ? `LINE_GROUP_ID = ${id}\n(เอาค่านี้ไปใส่ env บน Vercel)`
          : `LINE user id = ${id}`;
      try {
        await fetch(REPLY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ replyToken: event.replyToken, messages: [{ type: "text", text }] }),
        });
      } catch {
        // ignore — logging above already captured the id
      }
    }
  }

  return NextResponse.json({ ok: true });
}

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { type?: string; groupId?: string; roomId?: string; userId?: string };
}
