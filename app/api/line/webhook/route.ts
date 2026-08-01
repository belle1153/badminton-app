import { NextRequest, NextResponse } from "next/server";
import { rosterMessagesForText } from "@/lib/lineRoster";
import { withdrawFromLine } from "@/lib/lineWithdraw";
import { verifyLineSignature } from "@/lib/lineSignature";

/**
 * LINE webhook.
 *
 * The URL is public, so every request is checked against LINE's
 * `X-Line-Signature` before anything happens. Set `LINE_CHANNEL_SECRET` (LINE
 * Developers Console, same page as the access token). Until it is set, requests
 * can't be verified and ถอนชื่อ — the only thing here that changes data — is
 * refused; the read-only replies carry on.
 *
 * - "<ชื่อ> ถอนชื่อ <วัน>" → withdraws that name (anyone in the group can),
 *   replies a confirmation + updated roster.
 * - "รายชื่อ" (or "เช็คชื่อ" / "list") → the bot replies with the nearest
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
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  // The raw text, not req.json(): the signature covers these exact bytes, and
  // re-serialising the parsed object would never match.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ ok: true });
  }

  let signed = false;
  if (channelSecret) {
    signed = await verifyLineSignature(raw, req.headers.get("x-line-signature"), channelSecret);
    if (!signed) {
      // 200 so a prober learns nothing from the status, but nothing is done.
      console.warn("[LINE webhook] rejected: bad or missing signature");
      return NextResponse.json({ ok: true });
    }
  } else {
    // Without the secret nothing can be verified, so the destructive action is
    // withheld (see below) while the read-only replies keep working. Set
    // LINE_CHANNEL_SECRET to restore withdrawal over LINE.
    console.warn(
      "[LINE webhook] LINE_CHANNEL_SECRET is not set — requests cannot be verified, ถอนชื่อ is disabled"
    );
  }

  let body: { events?: LineEvent[] } = {};
  try {
    body = JSON.parse(raw);
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

    // "ถอน" → withdraw a name (checked before the roster keyword so a message
    // like "ถอนชื่อ Alex" isn't treated as a roster lookup).
    //
    // This is the one event that changes data, so it is the one that must be
    // provably from LINE. Unsigned (no channel secret configured), it answers
    // instead of acting — otherwise anyone who knew the URL could withdraw any
    // player from any open day with a plain POST.
    if (text.includes("ถอน")) {
      const messages = signed
        ? await withdrawFromLine(text)
        : ["ยังถอนผ่าน LINE ไม่ได้ครับ 🙏 ให้ถอนในเว็บแอป หรือแจ้งแอดมิน"];
      await reply(event.replyToken, token, messages);
      continue;
    }

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
