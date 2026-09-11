import { prisma } from "@/lib/db";
import { buildCostRows, sessionFees, type CostRow } from "@/lib/costing";
import { COST_SIGNUP_INCLUDE, costAttendees, finishedGameCount } from "@/lib/costReport";
import { ictTodayMidnight, matchesWhen, parseWhen, weekStart } from "@/lib/lineWhen";

/**
 * "สรุปค่าใช้จ่าย" over LINE — the same per-person bill the admin sees, posted
 * into the group. Bill = ค่าแรกเข้า + เกม × ค่าเกม; a no-show pays the flat fine.
 *
 * Numbers come from buildCostRows, exactly like the web page and the exports, so
 * there is one costing path and they can never disagree. People already marked
 * จ่ายแล้ว get a ✅; the footer totals whoever still owes, so the same message
 * doubles as the "เรียกเก็บเงิน" reminder.
 *
 * Only CLOSED days are itemised: while a day is still open, people are still on
 * court and the game counts move. An open day gets a short "รอปิดรอบก่อน" reply.
 */

const BAHT = (n: number) => Math.round(n).toLocaleString("en-US");

/** "Monday 03.08.2026", the same label the roster message uses. */
function dateLabel(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${weekday} ${d}.${m}.${date.getUTCFullYear()}`;
}

interface CostSessionLike {
  date: Date;
  venue: string;
  courtsEarly: number;
  courtsLate: number;
}

export function formatCostMessage(
  session: CostSessionLike,
  rows: CostRow[],
  gamesPlayed: number,
  entryFee: number,
  gameFee: number
): string {
  const DIVIDER = "━━━━━━━━━━━━";
  const played = rows.filter((r) => !r.noShow);
  const noShows = rows.filter((r) => r.noShow);
  const line = (r: CostRow) =>
    `${r.paid ? "✅ " : ""}${r.name} — ${BAHT(r.totalBaht)}฿ (${r.games} เกม)`;

  const lines: string[] = [
    "💰 สรุปค่าใช้จ่าย",
    `🗓 ${dateLabel(session.date)} · ${session.venue}`,
    `🏸 1 ทุ่ม ${session.courtsEarly} คอร์ท / 2 ทุ่ม ${session.courtsLate} คอร์ท · ${gamesPlayed} เกม`,
  ];

  for (const [slot, header] of [
    ["EARLY", "🔸รอบ 1 ทุ่ม (19.00)🔸"],
    ["LATE", "🔸รอบ 2 ทุ่ม (20.00)🔸"],
  ] as const) {
    const group = played.filter((r) => r.timeSlot === slot);
    if (group.length === 0) continue;
    lines.push("", header, ...group.map(line));
  }

  if (noShows.length > 0) {
    lines.push(
      "",
      `🔴 ไม่มา (ปรับ ${BAHT(noShows[0].totalBaht)}฿)`,
      ...noShows.map((r) => `${r.paid ? "✅ " : ""}${r.name} — ${BAHT(r.totalBaht)}฿`)
    );
  }

  const sumTotal = rows.reduce((a, r) => a + r.totalBaht, 0);
  const unpaid = rows.filter((r) => !r.paid);
  const unpaidBaht = unpaid.reduce((a, r) => a + r.totalBaht, 0);

  lines.push("", DIVIDER, `💵 รวมเก็บ ${BAHT(sumTotal)} ฿ · ${rows.length} คน`);
  lines.push(
    unpaid.length > 0
      ? `🔴 ค้างจ่าย ${unpaid.length} คน · ${BAHT(unpaidBaht)} ฿`
      : "✅ เก็บครบแล้ว"
  );
  lines.push(DIVIDER, `📌 ค่าแรกเข้า ${BAHT(entryFee)}฿ + เกมละ ${BAHT(gameFee)}฿`);

  return lines.join("\n");
}

/** Reply for a day that hasn't been closed yet — no figures, they'd move. */
export function openDayMessage(session: CostSessionLike): string {
  return [
    `🗓 ${dateLabel(session.date)}`,
    "ยังไม่ปิดรอบครับ 🙏 ยอดจะยังไม่นิ่งจนกว่าทุกคนจะเช็คเอาท์และแอดมินปิดรอบ",
    "ปิดรอบแล้วพิมพ์ “สรุปค่าใช้จ่าย” อีกครั้งได้เลยครับ",
  ].join("\n");
}

const NOT_FOUND = "ไม่พบรอบของวันที่ระบุครับ 🙏";
const NOTHING_YET = "ยังไม่มีรอบที่เล่นจบในสัปดาห์นี้ครับ 🙏";

/**
 * Cost summaries for a "สรุปค่าใช้จ่าย" message.
 *
 * Bare keyword → every day of THIS week that has already been played (so from
 * Thursday on, both จันทร์ and พุธ come back). Naming a day or a date picks that
 * one instead, looking backwards — a summary is always about a day that has
 * happened.
 */
export async function costMessagesForText(text: string, now: Date = new Date()): Promise<string[]> {
  const today = ictTodayMidnight(now);
  const when = parseWhen(text);

  const sessions = await prisma.session.findMany({
    where: { date: { lte: today } },
    orderBy: { date: "desc" },
    take: 30,
    include: {
      signUps: {
        where: { status: { not: "WITHDRAWN" } },
        include: COST_SIGNUP_INCLUDE,
        orderBy: { name: "asc" },
      },
    },
  });
  if (sessions.length === 0) return [NOTHING_YET];

  let matched: typeof sessions;
  if (when.specified) {
    matched = sessions.filter((s) => matchesWhen(s.date, when));
    if (matched.length === 0) return [NOT_FOUND];
    matched = matched.slice(0, 2); // the same weekday recurs — newest two at most
  } else {
    const from = weekStart(today).getTime();
    matched = sessions.filter((s) => s.date.getTime() >= from);
    // Nothing played yet this week → the club's last day, which is what someone
    // asking on a Monday morning means.
    if (matched.length === 0) matched = sessions.slice(0, 1);
  }

  // Oldest first, so จันทร์ is read before พุธ.
  matched = [...matched].sort((a, b) => a.date.getTime() - b.date.getTime());

  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });

  const messages: string[] = [];
  for (const session of matched) {
    if (session.status !== "CLOSED") {
      messages.push(openDayMessage(session));
      continue;
    }
    const { entryFee, gameFee } = sessionFees(session, settings);
    const { rows } = buildCostRows(costAttendees(session.signUps), entryFee, gameFee);
    if (rows.length === 0) {
      messages.push(`🗓 ${dateLabel(session.date)}\nไม่มีคนเช็คอินในรอบนี้ครับ`);
      continue;
    }
    messages.push(formatCostMessage(session, rows, finishedGameCount(session.signUps), entryFee, gameFee));
  }
  return messages;
}
