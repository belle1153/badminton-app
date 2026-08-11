/**
 * Which day a LINE message is asking about.
 *
 * Shared by the roster reply (looks forward) and the cost summary (looks back),
 * so "วันจันทร์", "10/08/2026" and "วันจันทร์ที่ 10" mean the same thing to both.
 */

// Thai weekday word → getUTCDay() index (session dates are read in UTC, the same
// way they're labelled). "พฤหัส" covers "พฤหัสบดี" too.
export const WEEKDAY_WORDS: [string, number][] = [
  ["อาทิตย์", 0],
  ["จันทร์", 1],
  ["อังคาร", 2],
  ["พุธ", 3],
  ["พฤหัส", 4],
  ["ศุกร์", 5],
  ["เสาร์", 6],
];

export interface When {
  /** 0=Sun … 6=Sat, or null when no weekday was named. */
  weekday: number | null;
  day: number | null;
  month: number | null;
  /** Always CE — a Buddhist year in the text is converted here. */
  year: number | null;
  /** Did the text pin anything at all? */
  specified: boolean;
}

const EMPTY: When = { weekday: null, day: null, month: null, year: null, specified: false };

/** 2569 → 2026, 26 → 2026, 2026 → 2026. */
function normalizeYear(raw: number): number {
  if (raw >= 2400) return raw - 543; // Buddhist era
  if (raw < 100) return 2000 + raw;
  return raw;
}

/**
 * Read a day out of free text. A full date wins over a bare number, and a
 * weekday can ride along with either ("วันจันทร์ที่ 10").
 */
export function parseWhen(text: string): When {
  const weekdayHit = WEEKDAY_WORDS.find(([w]) => text.includes(w));
  const weekday = weekdayHit ? weekdayHit[1] : null;

  // 10/08/2026 · 10-8-26 · 10.08 — day first, the way the club writes dates.
  const full = text.match(/(\d{1,2})\s*[/\-.]\s*(\d{1,2})(?:\s*[/\-.]\s*(\d{2,4}))?/);
  if (full) {
    const day = Number(full[1]);
    const month = Number(full[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return {
        weekday,
        day,
        month,
        year: full[3] ? normalizeYear(Number(full[3])) : null,
        specified: true,
      };
    }
  }

  // A bare number is a date-of-month ("วันจันทร์ที่ 10", "สรุปค่าใช้จ่าย 10").
  const bare = text.match(/\d{1,2}/);
  if (bare) {
    const day = Number(bare[0]);
    if (day >= 1 && day <= 31) return { weekday, day, month: null, year: null, specified: true };
  }

  if (weekday != null) return { weekday, day: null, month: null, year: null, specified: true };
  return EMPTY;
}

/** Does a session date satisfy everything the text pinned down? */
export function matchesWhen(date: Date, when: When): boolean {
  if (when.weekday != null && date.getUTCDay() !== when.weekday) return false;
  if (when.day != null && date.getUTCDate() !== when.day) return false;
  if (when.month != null && date.getUTCMonth() + 1 !== when.month) return false;
  if (when.year != null && date.getUTCFullYear() !== when.year) return false;
  return true;
}

/** UTC midnight of today in Thailand — the cut between "played" and "upcoming". */
export function ictTodayMidnight(now: Date = new Date()): Date {
  const ict = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(ict.getUTCFullYear(), ict.getUTCMonth(), ict.getUTCDate()));
}

/**
 * Monday of the week `today` falls in. The club plays two days a week, so a
 * bare "สรุปค่าใช้จ่าย" after Wednesday should answer with both of them — this
 * is the window that makes that happen.
 */
export function weekStart(today: Date): Date {
  const dow = today.getUTCDay(); // 0=Sun
  const backToMonday = dow === 0 ? 6 : dow - 1;
  return new Date(today.getTime() - backToMonday * 24 * 60 * 60 * 1000);
}
