import { prisma } from "@/lib/db";
import { pushLineMessage, lineConfigured } from "@/lib/line";

const SIGNUP_URL = process.env.LINE_SIGNUP_URL ?? "https://tinyurl.com/54fk2r7s";

/*
 * The "sign-ups are open" LINE post is sent only when the admin presses the
 * button. There used to be a daily 11:00 cron that posted it automatically; the
 * club turned that off (2026-11-01) along with the Friday 11:00 sign-up gate —
 * sign-ups now open the moment a day is created.
 */

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

/** UTC midnight of today's ICT date — session dates are stored that way, so
 *  this is the cut-off for "hasn't happened yet". */
function ictToday(now: Date): number {
  const ict = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return Date.UTC(ict.getUTCFullYear(), ict.getUTCMonth(), ict.getUTCDate());
}

/**
 * Days the admin's button may announce: any day still to come (sign-ups are
 * open from the moment a day is created). A day that has already been played is
 * never announced, which is what stops a stale OPEN session from being posted
 * weeks later. Pure, so the rule is unit-testable without a DB.
 */
export function pickAnnounceable<T extends { date: Date }>(sessions: T[], now: Date): T[] {
  const today = ictToday(now);
  return sessions.filter((s) => s.date.getTime() >= today);
}

/** The "sign-ups are open" group message for the given days. */
export function formatOpenMessage(days: OpenDay[], signupUrl: string = SIGNUP_URL): string {
  return [
    "🏸 เปิดลงชื่อแล้ว! ตีแบดก๊วนตัวตึงแหลมฉบัง",
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
  /**
   * The composed announcement, returned when the push failed so the admin can
   * paste it into the group by hand — typing in LINE is free, while push is
   * capped by the monthly quota that just blocked it.
   */
  message?: string;
}

/**
 * Days the button would announce right now, for the admin dashboard.
 *
 * Read-only and cheap, so the page can show "2 days still unannounced" without
 * anyone having to press the button to find out. A failed Friday used to be
 * completely silent — the only symptom was a group that never got the message.
 */
export async function pendingAnnouncements(now: Date = new Date()): Promise<string[]> {
  const candidates = await prisma.session.findMany({
    where: { status: "OPEN", registrationOpenNotifiedAt: null },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  return pickAnnounceable(candidates, now).map((s) => thaiDay(s.date));
}

/**
 * Post a single "sign-ups are open" message to the club LINE group for the
 * upcoming days not announced yet, then stamp them so a second press just
 * reports it was already sent. Never throws; a LINE hiccup just reports back,
 * and leaves the days unstamped so the next press retries them.
 */
export async function announceRegistrationOpen(now: Date = new Date()): Promise<AnnounceResult> {
  if (!lineConfigured()) {
    return { sent: false, reason: "ยังไม่ได้ตั้งค่า LINE (env)", days: [] };
  }

  const candidates = await prisma.session.findMany({
    where: { status: "OPEN", registrationOpenNotifiedAt: null },
    orderBy: { date: "asc" },
  });

  const due = pickAnnounceable(candidates, now);
  if (due.length === 0) {
    // Say which of the two it was: days that had never been announced must not
    // look identical to ones that had.
    const reason =
      candidates.length === 0
        ? "แจ้งไปแล้วทุกวันที่เปิดอยู่"
        : "วันที่ยังไม่ได้แจ้ง ผ่านไปแล้วทั้งหมด";
    return { sent: false, reason, days: [] };
  }

  const message = formatOpenMessage(due);
  const push = await pushLineMessage(message);
  if (!push.ok) {
    // Surface exactly what LINE said — 401 bad token, 403 bot not in the group,
    // 429 monthly quota — so the admin can fix it without reading server logs,
    // and hand back the text to post manually in the meantime.
    const parts = ["ส่ง LINE ไม่สำเร็จ"];
    if (push.status) parts.push(`(${push.status})`);
    if (push.status === 429) parts.push("— โควตา push รายเดือนหมด (reply ยังฟรี)");
    else if (push.detail) parts.push(push.detail);
    return { sent: false, reason: parts.join(" "), days: [], message };
  }

  // Mark only after a successful push, so a failed send can be retried.
  await prisma.session.updateMany({
    where: { id: { in: due.map((s) => s.id) } },
    data: { registrationOpenNotifiedAt: now },
  });

  return { sent: true, days: due.map((s) => thaiDay(s.date)) };
}
