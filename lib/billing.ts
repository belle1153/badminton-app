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

/** Billable hours between start and checkout (min 2h, half-hour steps, 10-min grace). */
export function billedHours(start: Date, end: Date): number {
  const minutes = Math.max(0, (end.getTime() - start.getTime()) / 60_000);
  const steps = Math.max(0, Math.ceil((minutes - 10) / 30));
  return Math.max(2, (steps * 30) / 60);
}

export function formatHours(h: number): string {
  return Number.isInteger(h) ? `${h}` : h.toFixed(1);
}
