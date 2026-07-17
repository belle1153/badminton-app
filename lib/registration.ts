import { ictInstant } from "./billing";

/**
 * Sign-ups for a day open on the Friday before it at 11:00 ICT — the club's
 * rule, so everyone races for a seat at the same moment instead of whoever
 * happens to look first taking it days early.
 *
 * Session dates are stored at UTC midnight of the intended local date, so
 * getUTCDay() on one is its Thai weekday (0=Sun … 5=Fri).
 */
const FRIDAY = 5;
const OPEN_HOUR_ICT = 11;

export function registrationOpensAt(sessionDate: Date): Date {
  // Walk back to the most recent Friday: a Friday session opens the same
  // morning, Mon walks back 3 days, Wed 5.
  const daysBack = (sessionDate.getUTCDay() - FRIDAY + 7) % 7;
  const friday = new Date(sessionDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return ictInstant(friday, OPEN_HOUR_ICT);
}

export function registrationIsOpen(sessionDate: Date, now: Date = new Date()): boolean {
  return now.getTime() >= registrationOpensAt(sessionDate).getTime();
}

/** "ศุกร์ที่ 17 ก.ค. 11:00 น." — for telling people when they can sign up. */
export function formatOpensAt(sessionDate: Date): string {
  const opens = registrationOpensAt(sessionDate);
  const day = opens.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  });
  return `${day} ${OPEN_HOUR_ICT}.00 น.`;
}
