import { NextRequest, NextResponse } from "next/server";
import { rosterMessagesForText } from "@/lib/lineRoster";

/**
 * LINE webhook.
 *
 * - Types "รายชื่อ" (or "เช็คชื่อ" / "list") → the bot replies with the nearest
 *   upcoming day's roster; add a day (จันทร์ / พุธ …) or a date number (20) and
 *   it replies just that day. Otherwise it stays quiet.
 * - Logs the source id of every event (find a new group id in the Vercel logs).
 *   Set LINE_ECHO_ID=1 temporarily to have it reply the id in chat, then unset.
 *
 * LINE calls this with a "Verify" ping on save (no events) — we just return 200.
 */
const REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const ROSTER_KEYWORDS = ["รายชื่อ", "เช็คชื่อ", "list"];

async function reply(replyToken: string, token: string, texts: string[]) {
  try {
    await fetch(REPLY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        replyToken,
        messages: texts.slice(0, 5).map((t) => ({ type: "text", text: t.slice(0, 4900) })),
      }),
    });
  } catch {
    // ignore — a failed reply must never surface
  }
}

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

    if (!token || event.type !== "message" || !event.replyToken) continue;
    const text = (event.message?.text ?? "").trim();

    // Keyword → nearest day's roster, or a specific day if named.
    if (ROSTER_KEYWORDS.some((k) => text.toLowerCase().includes(k.toLowerCase()))) {
      await reply(event.replyToken, token, await rosterMessagesForText(text));
      continue;
    }

    // Off by default — only echoes the id back when explicitly turned on.
    if (echoId) {
      await reply(event.replyToken, token, [
        src.groupId || src.roomId
          ? `LINE_GROUP_ID = ${id}\n(เอาค่านี้ไปใส่ env บน Vercel)`
          : `LINE user id = ${id}`,
      ]);
    }
  }

  return NextResponse.json({ ok: true });
}

interface LineEvent {
  type: string;
  replyToken?: string;
  message?: { type?: string; text?: string };
  source?: { type?: string; groupId?: string; roomId?: string; userId?: string };
}
