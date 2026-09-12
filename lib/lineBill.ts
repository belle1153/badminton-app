import { prisma } from "@/lib/db";
import { buildCostRows, sessionFees } from "@/lib/costing";
import { COST_SIGNUP_INCLUDE, costAttendees } from "@/lib/costReport";
import { ictTodayMidnight } from "@/lib/lineWhen";

/**
 * "เรียกเก็บเงิน" over LINE — one running tab per person of everything they
 * still owe across the last two weeks, so the admin can post the whole
 * collection sheet at once (unlike "สรุปค่าใช้จ่าย", which itemises one day).
 *
 * A day counts here only once it is CLOSED (its bill is final) and only the
 * lines still marked unpaid are added up. Someone with nothing outstanding
 * simply doesn't appear.
 */

const BAHT = (n: number) => Math.round(n).toLocaleString("en-US");
const DIVIDER = "━━━━━━━━━━━━";
/** How far back "2 อาทิตย์ล่าสุด" reaches. */
const WINDOW_DAYS = 14;
/** Stay well under LINE's 5000-char per-message limit when packing people. */
const MAX_CHARS = 4500;

/** "จ 4/8" — Thai weekday initial + day/month, from the UTC-midnight date. */
function shortDay(date: Date): string {
  const wd = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"][date.getUTCDay()];
  return `${wd} ${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
}

export interface Debt {
  name: string;
  total: number;
  days: { label: string; baht: number }[];
}

/**
 * Pack per-person debts into LINE messages. Pure, so the wording is testable
 * without a database. One block per person; a person who owes for a single day
 * doesn't get the redundant breakdown line.
 */
export function formatBillMessages(debts: Debt[]): string[] {
  if (debts.length === 0) return ["✅ ไม่มียอดค้างใน 2 อาทิตย์ล่าสุดครับ"];

  const people = [...debts].sort((a, b) => a.name.localeCompare(b.name, "th"));
  const grand = people.reduce((n, d) => n + d.total, 0);

  const header = "🧾 เรียกเก็บเงิน (ค้าง 2 อาทิตย์ล่าสุด)";
  const footer = `${DIVIDER}\nรวมค้าง ${people.length} คน · ${BAHT(grand)}฿`;
  const blocks = people.map((d) => {
    const lines = [`👤 ${d.name} — ค้าง ${BAHT(d.total)}฿`];
    // Only spell out the days when there's more than one — otherwise the total
    // already says everything.
    if (d.days.length > 1) for (const day of d.days) lines.push(`   • ${day.label} — ${BAHT(day.baht)}฿`);
    return lines.join("\n");
  });

  const messages: string[] = [];
  let cur = header;
  for (const b of blocks) {
    if (cur.length + b.length + 2 > MAX_CHARS) {
      messages.push(cur);
      cur = "";
    }
    cur += (cur ? "\n\n" : "") + b;
  }
  if (cur.length + footer.length + 2 > MAX_CHARS) {
    messages.push(cur);
    cur = footer;
  } else {
    cur += `\n\n${footer}`;
  }
  messages.push(cur);
  return messages.slice(0, 5);
}

/** Everyone's outstanding tab over the last two weeks, ready to post to LINE. */
export async function outstandingBillMessages(now: Date = new Date()): Promise<string[]> {
  const today = ictTodayMidnight(now);
  const from = new Date(today.getTime() - WINDOW_DAYS * 86_400_000);

  const [sessions, settings] = await Promise.all([
    prisma.session.findMany({
      where: { status: "CLOSED", date: { gte: from, lte: today } },
      orderBy: { date: "asc" },
      include: {
        signUps: {
          where: { status: { not: "WITHDRAWN" } },
          include: COST_SIGNUP_INCLUDE,
          orderBy: { name: "asc" },
        },
      },
    }),
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  // Group the unpaid lines by player name — the identity shown to the group.
  const byName = new Map<string, Debt>();
  for (const s of sessions) {
    const { entryFee, gameFee } = sessionFees(s, settings);
    const { rows } = buildCostRows(costAttendees(s.signUps), entryFee, gameFee);
    for (const r of rows) {
      if (r.paid) continue;
      const d = byName.get(r.name) ?? { name: r.name, total: 0, days: [] };
      d.total += r.totalBaht;
      d.days.push({ label: shortDay(s.date), baht: r.totalBaht });
      byName.set(r.name, d);
    }
  }

  return formatBillMessages([...byName.values()]);
}
