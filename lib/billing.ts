/**
 * Per-person time billing rules:
 * - The clock starts on the hour block they booked: 1 ทุ่ม = 19:00, 2 ทุ่ม =
 *   20:00 Thailand time (session dates are stored at UTC midnight; ICT=UTC+7).
 * - Minimum charge 2 hours.
 * - Past that, time is billed in half-hour steps with a 10-minute grace:
 *   leave 21:00–21:10 → 21:00, leave 21:11–21:30 → 21:30, etc.
 */

export function blockStart(sessionDate: Date, timeSlot: "EARLY" | "LATE"): Date {
  const hourUtc = timeSlot === "EARLY" ? 12 : 13; // 19:00 / 20:00 ICT
  return new Date(sessionDate.getTime() + hourUtc * 60 * 60 * 1000);
}

/** UTC instant for a given ICT hour (e.g. 20 → 20:00 ICT) on the session date. */
export function ictInstant(sessionDate: Date, hourIct: number): Date {
  return new Date(sessionDate.getTime() + (hourIct - 7) * 60 * 60 * 1000);
}

/**
 * Courts open right now. The 2-ทุ่ม courts unlock at 20:00 ICT — or earlier if
 * the admin pressed "open late" (lateOpenedAt). Before that only courtsEarly
 * are in play, so the 19:00 round never uses the 20:00 courts.
 */
export function activeCourtCount(
  session: { courtsEarly: number; courtsLate: number; date: Date; lateOpenedAt: Date | null },
  now: Date = new Date()
): number {
  if (session.lateOpenedAt) return session.courtsLate;
  return now.getTime() >= ictInstant(session.date, 20).getTime()
    ? session.courtsLate
    : session.courtsEarly;
}

/**
 * Billing time blocks: two 1-hour blocks (19-20, 20-21) then 30-min blocks up
 * to 23:00 ICT. Each = [start, end) as UTC instants + its length in hours.
 */
export function billingBlocks(sessionDate: Date): { start: Date; end: Date; hours: number }[] {
  const marks = [19, 20, 21, 21.5, 22, 22.5, 23]; // ICT hours
  const blocks = [];
  for (let i = 0; i < marks.length - 1; i++) {
    blocks.push({
      start: ictInstant(sessionDate, marks[i]),
      end: ictInstant(sessionDate, marks[i + 1]),
      hours: marks[i + 1] - marks[i],
    });
  }
  return blocks;
}

/**
 * Courts open during a block: early courts before 20:00 ICT, late from 20:00 —
 * or from lateOpenedAt if the admin unlocked the 2-ทุ่ม courts early.
 */
export function courtsOpenAt(
  session: { courtsEarly: number; courtsLate: number; date: Date; lateOpenedAt?: Date | null },
  blockStartUtc: Date
): number {
  if (session.lateOpenedAt && blockStartUtc.getTime() >= session.lateOpenedAt.getTime()) {
    return session.courtsLate;
  }
  return blockStartUtc.getTime() >= ictInstant(session.date, 20).getTime()
    ? session.courtsLate
    : session.courtsEarly;
}

/** Billable hours between start and checkout (min 2h, half-hour steps, 10-min grace). */
export function billedHours(start: Date, end: Date): number {
  const minutes = Math.max(0, (end.getTime() - start.getTime()) / 60_000);
  const steps = Math.max(0, Math.ceil((minutes - 10) / 30));
  return Math.max(2, (steps * 30) / 60);
}

export function formatHours(h: number): string {
  return Number.isInteger(h) ? `${h}` : h.toFixed(1);
}
