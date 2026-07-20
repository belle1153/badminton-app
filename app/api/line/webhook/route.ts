import { NextRequest, NextResponse } from "next/server";

/**
 * LINE webhook. Its one job right now is helping you find the group id: invite
 * the bot to the club group and type anything — the bot replies with the group
 * id (also logged to the Vercel function logs). Put that value in the
 * LINE_GROUP_ID env var and the roster messages start posting there.
 *
 * LINE calls this with a "Verify" ping on save (no events) — we just return 200.
 */
const REPLY_URL = "https://api.line.me/v2/bot/message/reply";

export async function POST(req: NextRequest) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
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

    // Reply with the id so it can be read straight from the chat.
    if (token && event.type === "message" && event.replyToken) {
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
