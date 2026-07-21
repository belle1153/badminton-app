import { prisma } from "@/lib/db";
import { blockCapacities } from "@/lib/capacity";
import { pushLineMessage, lineConfigured } from "@/lib/line";

/** Where the LINE message tells people to sign up. Overridable so a new short
 *  link doesn't need a redeploy; defaults to the club's current link. */
const SIGNUP_URL = process.env.LINE_SIGNUP_URL ?? "https://tinyurl.com/54fk2r7s";

interface RosterSession {
  date: Date;
  maxPlayers: number;
  courtsEarly: number;
  courtsLate: number;
}
interface RosterSignUp {
  name: string;
  status: string; // CONFIRMED | WAITLIST | WITHDRAWN
  timeSlot: string; // EARLY | LATE
  slotNumber: number | null;
}

/** "Monday 20.07.2026" — English weekday + DD.MM.YYYY, read in UTC because the
 *  session date is stored at UTC midnight of the intended local day. */
function dateLabel(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${weekday} ${d}.${m}.${date.getUTCFullYear()}`;
}

/**
 * The club roster message, matching the format posted by hand in the group:
 * a numbered 1 ทุ่ม block, a 2 ทุ่ม block, the free-seat / reserve counts, and
 * the sign-up link. Empty seats are shown as a bare number so people can see
 * how many are left.
 */
export function formatRosterMessage(session: RosterSession, signups: RosterSignUp[]): string {
  const { earlyCapacity, totalCapacity } = blockCapacities(session);
  const lateCapacity = Math.max(0, totalCapacity - earlyCapacity);

  const confirmed = signups.filter((s) => s.status === "CONFIRMED");
  const bySlot = new Map<number, string>();
  for (const s of confirmed) if (s.slotNumber != null) bySlot.set(s.slotNumber, s.name);

  const earlyUsed = confirmed.filter((s) => s.timeSlot === "EARLY").length;
  const lateUsed = confirmed.filter((s) => s.timeSlot === "LATE").length;
  const waitlist = signups.filter((s) => s.status === "WAITLIST").length;

  const DIVIDER = "━━━━━━━━━━━━";
  const lines: string[] = [
    "📣 อัปเดต! รายชื่อลงตีแบดก๊วนตัวตึงแหลมฉบัง 🏸",
    "",
    `🗓 ${dateLabel(session.date)}`,
    `🏸 สนาม : 1 ทุ่ม ${session.courtsEarly} คอร์ท / 2 ทุ่ม ${session.courtsLate} คอร์ท`,
    `👥️ เปิดรับ ${totalCapacity} คน`,
    "",
    "🔸รอบ 1 ทุ่ม🔸",
  ];

  for (let n = 1; n <= earlyCapacity; n++) {
    const name = bySlot.get(n);
    lines.push(name ? `${n}. ${name}` : `${n}.`);
  }

  if (lateCapacity > 0) {
    lines.push("", "🔸รอบ 2 ทุ่ม🔸");
    for (let n = earlyCapacity + 1; n <= totalCapacity; n++) {
      const name = bySlot.get(n);
      lines.push(name ? `${n}. ${name}` : `${n}.`);
    }
  }

  lines.push(
    "",
    DIVIDER,
    `🟢 ว่างรอบ 1 ทุ่ม = ${Math.max(0, earlyCapacity - earlyUsed)} คน`,
    `🟢 ว่างรอบ 2 ทุ่ม = ${Math.max(0, lateCapacity - lateUsed)} คน`,
    `🟠 สำรอง = ${waitlist} คน`,
    DIVIDER,
    `🗒 ลงชื่อผ่านเว็บแอป "Tua Tueng Go!" Click ที่นี่ ▶️ ${SIGNUP_URL}`
  );

  return lines.join("\n");
}

// Thai weekday word → getUTCDay() index (session dates read in UTC, same as the
// label). "พฤหัส" covers "พฤหัสบดี" too.
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
 * Roster messages for the keyword lookup in the group. Bare "รายชื่อ" → the
 * single nearest upcoming open day. If the text names a day (จันทร์ / พุธ …) or
 * a date number (20, 21), only that day's roster is returned. Only days from
 * today onward, so a finished day doesn't get re-posted.
 */
export async function rosterMessagesForText(text: string): Promise<string[]> {
  const nowIct = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayMidnight = new Date(
    Date.UTC(nowIct.getUTCFullYear(), nowIct.getUTCMonth(), nowIct.getUTCDate())
  );
  const sessions = await prisma.session.findMany({
    where: { status: "OPEN", date: { gte: todayMidnight } },
    orderBy: { date: "asc" },
    take: 14,
    include: {
      signUps: {
        where: { status: { not: "WITHDRAWN" } },
        orderBy: [{ slotNumber: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (sessions.length === 0) return ["ยังไม่มีรอบเปิดรับสมัครครับ 🙏"];

  // Did the message pin a specific day? Weekday word first, else a date number.
  let specified = false;
  let matched = sessions;
  const weekday = WEEKDAY_WORDS.find(([w]) => text.includes(w));
  if (weekday) {
    specified = true;
    matched = sessions.filter((s) => new Date(s.date).getUTCDay() === weekday[1]);
  } else {
    const num = text.match(/\d{1,2}/);
    if (num) {
      specified = true;
      const day = Number(num[0]);
      matched = sessions.filter((s) => new Date(s.date).getUTCDate() === day);
    }
  }

  if (specified) {
    return matched.length
      ? matched.map((s) => formatRosterMessage(s, s.signUps))
      : ["ไม่พบรอบของวันที่ระบุครับ 🙏"];
  }
  // Bare keyword → just the nearest day.
  return [formatRosterMessage(sessions[0], sessions[0].signUps)];
}

/**
 * Post the current roster for a session to the club LINE group. Silent no-op if
 * LINE isn't configured or the session is closed. Never throws — a failed post
 * must not break the sign-up/withdraw it was triggered by.
 */
export async function pushSessionRoster(sessionId: string): Promise<void> {
  if (!lineConfigured()) return;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        signUps: {
          where: { status: { not: "WITHDRAWN" } },
          orderBy: [{ slotNumber: "asc" }, { createdAt: "asc" }],
        },
      },
    });
    if (!session || session.status === "CLOSED") return;
    await pushLineMessage(formatRosterMessage(session, session.signUps));
  } catch {
    // swallow — never let a notification failure surface to the user
  }
}
