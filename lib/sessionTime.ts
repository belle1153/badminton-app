/**
 * A play day's start time and its two blocks.
 *
 * The day is split into two one-hour-apart blocks: EARLY starts at the day's
 * start time and LATE one hour later (when the extra courts open). For the
 * club's usual 19:00 start those are "1 ทุ่ม" (19:00) and "2 ทุ่ม" (20:00) — the
 * words everyone knows, so they stay. A day that starts at another time (the
 * club can no longer always lock its courts for 19:00) shows the real clock
 * times instead, e.g. "19:30 น." / "20:30 น.".
 *
 * Session.startTime is stored as text ("19:00"); anything unreadable falls back
 * to 19:00 so an odd old value never breaks a page.
 */

export type Slot = "EARLY" | "LATE";

export const DEFAULT_START_TIME = "19:00";
const DEFAULT_START_MIN = 19 * 60;

/** "19:00", "19.30", "7:05", "19:00 น." → minutes after midnight, or null. */
export function parseStartTime(text: string | null | undefined): number | null {
  const m = (text ?? "").trim().match(/^(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Start minute of the day, falling back to 19:00. */
export function startMinutes(startTime: string | null | undefined): number {
  return parseStartTime(startTime) ?? DEFAULT_START_MIN;
}

/** Minutes after midnight (ICT) at which a block starts. */
export function slotStartMinutes(startTime: string | null | undefined, slot: Slot): number {
  return startMinutes(startTime) + (slot === "LATE" ? 60 : 0);
}

function hhmm(minutes: number, sep = ":"): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}${sep}${String(m).padStart(2, "0")}`;
}

/** Canonical "HH:MM" for a start time, or null when it can't be read. */
export function normalizeStartTime(text: string | null | undefined): string | null {
  const m = parseStartTime(text);
  return m == null ? null : hhmm(m);
}

/** Is this the club's usual 19:00 start (so the ทุ่ม words still apply)? */
export function isStandardStart(startTime: string | null | undefined): boolean {
  return startMinutes(startTime) === DEFAULT_START_MIN;
}

/**
 * The block's name as players know it: "1 ทุ่ม" / "2 ทุ่ม" on a 19:00 day,
 * otherwise the block's clock time, "19:30 น." / "20:30 น.".
 */
export function slotLabel(startTime: string | null | undefined, slot: Slot): string {
  if (isStandardStart(startTime)) return slot === "EARLY" ? "1 ทุ่ม" : "2 ทุ่ม";
  return `${hhmm(slotStartMinutes(startTime, slot))} น.`;
}

/** The block's start written the way the cost sheet does: "19.00" / "20.30". */
export function slotClock(startTime: string | null | undefined, slot: Slot): string {
  return hhmm(slotStartMinutes(startTime, slot), ".");
}

/**
 * UTC instant a block starts. Session dates are stored at UTC midnight of the
 * local (ICT, UTC+7) play day.
 */
export function slotStartAt(
  sessionDate: Date,
  startTime: string | null | undefined,
  slot: Slot
): Date {
  const min = slotStartMinutes(startTime, slot) - 7 * 60;
  return new Date(sessionDate.getTime() + min * 60_000);
}
