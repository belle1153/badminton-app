import { prisma } from "@/lib/db";
import { rebalanceSession } from "@/lib/seating";
import { formatRosterMessage } from "@/lib/lineRoster";
import { selfWithdrawAllowed } from "@/lib/withdrawPolicy";

// Thai weekday word → getUTCDay() index (session dates read in UTC).
const WEEKDAY_WORDS: [string, number][] = [
  ["อาทิตย์", 0],
  ["จันทร์", 1],
  ["อังคาร", 2],
  ["พุธ", 3],
  ["พฤหัส", 4],
  ["ศุกร์", 5],
  ["เสาร์", 6],
];

/**
 * Work out which rostered person a withdraw message refers to. Two passes:
 *
 *  1. Mention match — spot any roster name that appears verbatim in the raw
 *     message, longest first. Robust against surrounding Thai particles
 *     ("NW ถอนชื่อ ให้หน่อยดิ้" still finds "NW").
 *  2. Stripped-leftover match — fall back to the text left after removing the
 *     keywords / day words / numbers, matched both directions.
 *
 * `name` is the stripped leftover, used only for the "not found" reply.
 */
export function resolveWithdrawName<T extends { name: string }>(
  signUps: T[],
  text: string
): { target?: T; name: string } {
  const hay = text.toLowerCase();
  let target: T | undefined = signUps
    .filter((s) => s.name.trim().length >= 2 && hay.includes(s.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0];

  let name = text;
  for (const [w] of WEEKDAY_WORDS) name = name.split(w).join(" ");
  name = name
    .replace(/ถอนชื่อ|ถอน|รายชื่อ|วันที่|วัน|ไม่ได้|ให้|ด้วย|หน่อย|ครับ|ค่ะ|คับ|จ้า|จ๊ะ|นะ|ที|ดิ้|ดิ/g, " ")
    .replace(/\d{1,2}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!target && name) {
    const lower = name.toLowerCase();
    target =
      signUps.find((s) => s.name.toLowerCase() === lower) ??
      signUps.find((s) => s.name.toLowerCase().includes(lower)) ??
      signUps.find((s) => s.name.trim().length >= 2 && lower.includes(s.name.toLowerCase()));
  }
  return { target, name };
}

function dayLabel(date: Date): string {
  const wd = date.toLocaleDateString("th-TH", { weekday: "long", timeZone: "UTC" });
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${wd} ${d}.${m}`;
}

/**
 * Withdraw a name from LINE. Anyone in the group may type e.g.
 * "Alex ถอนชื่อ จันทร์" or "ถอน Alex 20" — the bot finds that person on that
 * day and withdraws them (no time-limit, unlike the web self-withdraw), then
 * replies with a confirmation and the updated roster. Reply-only, so it costs
 * no push quota. Returns the reply lines.
 */
export async function withdrawFromLine(text: string): Promise<string[]> {
  const nowIct = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayMidnight = new Date(
    Date.UTC(nowIct.getUTCFullYear(), nowIct.getUTCMonth(), nowIct.getUTCDate())
  );
  const sessions = await prisma.session.findMany({
    where: { status: "OPEN", date: { gte: todayMidnight } },
    orderBy: { date: "asc" },
    include: { signUps: { where: { status: { not: "WITHDRAWN" } } } },
    take: 14,
  });
  if (sessions.length === 0) return ["ยังไม่มีรอบเปิดรับสมัครครับ 🙏"];

  // Which day? A weekday word or a date number; else the nearest open day.
  let session = sessions[0];
  const weekday = WEEKDAY_WORDS.find(([w]) => text.includes(w));
  if (weekday) {
    const m = sessions.find((s) => new Date(s.date).getUTCDay() === weekday[1]);
    if (!m) return ["ไม่พบรอบของวันที่ระบุครับ 🙏"];
    session = m;
  } else {
    const num = text.match(/\d{1,2}/);
    if (num) {
      const m = sessions.find((s) => new Date(s.date).getUTCDate() === Number(num[0]));
      if (!m) return ["ไม่พบรอบของวันที่ระบุครับ 🙏"];
      session = m;
    }
  }

  const { target, name } = resolveWithdrawName(session.signUps, text);
  if (!target) {
    if (!name) return ['พิมพ์ชื่อที่จะถอนด้วยครับ เช่น "Alex ถอนชื่อ จันทร์"'];
    return [`ไม่พบชื่อ "${name}" ในรายชื่อ ${dayLabel(session.date)} ครับ 🙏`];
  }

  // Same cutoff as the web self-withdraw: only until noon (ICT) on the play
  // day. After that the bot won't withdraw — the admin must accept it (club
  // charges a fee unless a replacement is found).
  if (!selfWithdrawAllowed(session.date)) {
    return [
      `⛔ "${target.name}" ถอนชื่อผ่านไลน์ไม่ได้แล้ว (เลยเที่ยงวันเล่น ${dayLabel(session.date)})\nติดต่อแอดมินเพื่อกด accept การถอนชื่อครับ`,
    ];
  }

  if (target.fixedPartnerId) {
    await prisma.signUp.update({ where: { id: target.fixedPartnerId }, data: { fixedPartnerId: null } });
  }
  await prisma.signUp.update({
    where: { id: target.id },
    data: { status: "WITHDRAWN", slotNumber: null, fixedPartnerId: null, withdrawnAt: new Date() },
  });
  if (session.registrationClosedAt == null) await rebalanceSession(session);

  const fresh = await prisma.session.findUnique({
    where: { id: session.id },
    include: {
      signUps: {
        where: { status: { not: "WITHDRAWN" } },
        orderBy: [{ slotNumber: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  const reply = [`✅ ถอนชื่อ "${target.name}" ออกจาก ${dayLabel(session.date)} แล้วครับ`];
  if (fresh) reply.push(formatRosterMessage(fresh, fresh.signUps));
  return reply;
}
