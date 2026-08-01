import { prisma } from "@/lib/db";
import { pushLineMessage, lineConfigured } from "@/lib/line";
import { registrationOpensAt } from "@/lib/registration";

const SIGNUP_URL = process.env.LINE_SIGNUP_URL ?? "https://tinyurl.com/54fk2r7s";

/**
 * How long after sign-ups open the unattended cron keeps trying.
 *
 * It runs daily rather than only on Friday, so a Friday that failed — a 429 on
 * the push, LINE down, a deploy mid-flight — is retried the next morning and
 * the one after instead of being lost. `registrationOpenNotifiedAt` is stamped
 * only on a successful send, so the retries stop the moment one gets through.
 *
 * The window still exists to stop a first deploy (every OPEN session has a null
 * marker) announcing days that opened weeks ago.
 */
const CRON_RETRY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Who is asking. The cron runs unattended and must never surprise the group, so
 * it keeps the 24-hour window. The admin button is a person deciding to post
 * right now — holding them to the same window meant that if Friday 11:00 came
 * and went (a failed push, nobody around, a day added late) the announcement
 * could never be sent at all, and the button just said "แจ้งไปแล้ว" when it
 * never had been. `registrationOpenNotifiedAt` is the real don't-repeat guard.
 */
export type AnnounceMode = "cron" | "manual";

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

/**
 * Days the daily cron may announce: everything the button may, minus days whose
 * sign-ups opened longer ago than the retry window. Pure, so the timing rule is
 * unit-testable without a DB.
 */
export function pickFreshlyOpen<T extends { date: Date }>(sessions: T[], now: Date): T[] {
  return pickAnnounceable(sessions, now).filter(
    (s) => now.getTime() - registrationOpensAt(s.date).getTime() < CRON_RETRY_WINDOW_MS
  );
}

/** UTC midnight of today's ICT date — session dates are stored that way, so
 *  this is the cut-off for "hasn't happened yet". */
function ictToday(now: Date): number {
  const ict = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return Date.UTC(ict.getUTCFullYear(), ict.getUTCMonth(), ict.getUTCDate());
}

/**
 * Days the admin's button may announce: sign-ups already open, and the day
 * itself still to come. No freshness window — a person pressing the button is
 * the intent — but a day that has already been played is never announced, which
 * is what stops a stale OPEN session from being posted weeks later.
 */
export function pickAnnounceable<T extends { date: Date }>(sessions: T[], now: Date): T[] {
  const today = ictToday(now);
  return sessions.filter(
    (s) =>
      registrationOpensAt(s.date).getTime() <= now.getTime() && s.date.getTime() >= today
  );
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
 * Post a single "sign-ups are open" message to the club LINE group for the days
 * that just opened (this Friday 11:00 ICT), then stamp them so it goes out only
 * once — whichever fires first, the admin button or the Friday cron, claims it
 * and the other becomes a no-op. Never throws; a LINE hiccup just reports back.
 */
export async function announceRegistrationOpen(
  now: Date = new Date(),
  mode: AnnounceMode = "manual"
): Promise<AnnounceResult> {
  if (!lineConfigured()) {
    return { sent: false, reason: "ยังไม่ได้ตั้งค่า LINE (env)", days: [] };
  }

  const candidates = await prisma.session.findMany({
    where: { status: "OPEN", registrationOpenNotifiedAt: null },
    orderBy: { date: "asc" },
  });

  const fresh =
    mode === "cron" ? pickFreshlyOpen(candidates, now) : pickAnnounceable(candidates, now);
  if (fresh.length === 0) {
    // Say which of the two it was. The old combined wording ("ยังไม่ถึงเวลาเปิด
    // หรือแจ้งไปแล้ว") hid a real failure: days that had never been announced
    // looked identical to ones that had.
    const reason =
      candidates.length === 0
        ? "แจ้งไปแล้วทุกวันที่เปิดอยู่"
        : "ยังไม่ถึงเวลาเปิดลงชื่อ (ศุกร์ 11.00 น.)";
    return { sent: false, reason, days: [] };
  }

  const message = formatOpenMessage(fresh);
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
    where: { id: { in: fresh.map((s) => s.id) } },
    data: { registrationOpenNotifiedAt: now },
  });

  return { sent: true, days: fresh.map((s) => thaiDay(s.date)) };
}
