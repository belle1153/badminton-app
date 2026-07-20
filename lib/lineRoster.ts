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

  const lines: string[] = [
    "รายชื่อตีแบดก๊วนตัวตึงแหลมฉบัง 🏸",
    "",
    `🗓 ${dateLabel(session.date)}`,
    `🏸 จำนวนสนาม : 1 ทุ่ม ${session.courtsEarly} คอร์ท / 2 ทุ่ม ${session.courtsLate} คอร์ท`,
    `👥️ เปิดรับ ${totalCapacity} คน`,
    "",
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
    `🟢 ว่างรอบ 1 ทุ่ม = ${Math.max(0, earlyCapacity - earlyUsed)} คน`,
    `🟢 ว่างรอบ 2 ทุ่ม = ${Math.max(0, lateCapacity - lateUsed)} คน`,
    `🟠 สำรอง = ${waitlist} คน`,
    "",
    `🗒 ลงชื่อผ่านเว็บแอป "Tua Tueng Go!" Click ที่นี่ ▶️ ${SIGNUP_URL}`
  );

  return lines.join("\n");
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
