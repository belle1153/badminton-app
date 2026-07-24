import { prisma } from "@/lib/db";
import { pushLineMessage, lineConfigured } from "@/lib/line";
import { registrationOpensAt } from "@/lib/registration";

const SIGNUP_URL = process.env.LINE_SIGNUP_URL ?? "https://tinyurl.com/54fk2r7s";

// Only announce days whose sign-ups opened within the last day. Without this, a
// first deploy (every OPEN session still has a null marker) would retro-announce
// days that opened last week — the window keeps it to "just opened this Friday".
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

/** "จันทร์ที่ 27 กรกฎาคม" — dates are stored at UTC midnight of the intended
 *  local date, so format in UTC to keep that calendar date. */
export function thaiDay(date: Date): string {
  return date.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export interface OpenDay {
  id: string;
  date: Date;
  startTime: string;
}

/** Days whose sign-ups are open right now and opened within the fresh window —
 *  pure, so the timing rule is unit-testable without a DB. */
export function pickFreshlyOpen<T extends { date: Date }>(sessions: T[], now: Date): T[] {
  return sessions.filter((s) => {
    const opensAt = registrationOpensAt(s.date).getTime();
    return opensAt <= now.getTime() && now.getTime() - opensAt < FRESH_WINDOW_MS;
  });
}

/** The "sign-ups are open" group message for the given days. */
export function formatOpenMessage(days: OpenDay[], signupUrl: string = SIGNUP_URL): string {
  return [
    "🏸 เปิดรับสมัครแล้ว! ตีแบดก๊วนตัวตึงแหลมฉบัง",
    "",
    "ลงชื่อได้เลยตอนนี้ 👇",
    ...days.map((s) => `🗓 ${thaiDay(s.date)} · เริ่ม ${s.startTime} น.`),
    "",
    `👉 ${signupUrl}`,
  ].join("\n");
}

export interface AnnounceResult {
  sent: boolean;
  /** Present when nothing was sent, in Thai, for the admin button to show. */
  reason?: string;
  /** Day labels that were announced. */
  days: string[];
}

/**
 * Post a single "sign-ups are open" message to the club LINE group for the days
 * that just opened (this Friday 11:00 ICT), then stamp them so it goes out only
 * once — whichever fires first, the admin button or the Friday cron, claims it
 * and the other becomes a no-op. Never throws; a LINE hiccup just reports back.
 */
export async function announceRegistrationOpen(now: Date = new Date()): Promise<AnnounceResult> {
  if (!lineConfigured()) {
    return { sent: false, reason: "ยังไม่ได้ตั้งค่า LINE (env)", days: [] };
  }

  const candidates = await prisma.session.findMany({
    where: { status: "OPEN", registrationOpenNotifiedAt: null },
    orderBy: { date: "asc" },
  });

  const fresh = pickFreshlyOpen(candidates, now);
  if (fresh.length === 0) {
    return { sent: false, reason: "ยังไม่ถึงเวลาเปิด หรือแจ้งไปแล้ว", days: [] };
  }

  const ok = await pushLineMessage(formatOpenMessage(fresh));
  if (!ok) return { sent: false, reason: "ส่งข้อความ LINE ไม่สำเร็จ", days: [] };

  // Mark only after a successful push, so a failed send can be retried.
  await prisma.session.updateMany({
    where: { id: { in: fresh.map((s) => s.id) } },
    data: { registrationOpenNotifiedAt: now },
  });

  return { sent: true, days: fresh.map((s) => thaiDay(s.date)) };
}
