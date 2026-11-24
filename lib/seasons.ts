/**
 * มิชชั่นโคตรตึง seasons. EXP and coins count per season; Level is lifetime.
 *
 * Seasons are windows over play dates, not stored state: nothing is reset in
 * the database, every number is recomputed from history filtered to a window.
 * A new season is one more entry here.
 *
 * Session dates are stored at UTC midnight of the local play day, so windows
 * are UTC midnights of the Thai calendar date.
 */
export type SeasonId = 1 | 2;

export interface Season {
  id: SeasonId;
  label: string;
  /** Inclusive; null = from the beginning. */
  start: Date | null;
  /** Exclusive; null = still running. */
  end: Date | null;
}

export const SEASON_2_START = new Date(Date.UTC(2026, 10, 30));

export const SEASONS: Season[] = [
  { id: 1, label: "Season 1", start: null, end: SEASON_2_START },
  { id: 2, label: "Season 2", start: SEASON_2_START, end: null },
];

export function inSeason(date: Date, s: Season): boolean {
  const t = date.getTime();
  return (s.start == null || t >= s.start.getTime()) && (s.end == null || t < s.end.getTime());
}

export function seasonOf(date: Date): SeasonId {
  return (SEASONS.find((s) => inSeason(date, s)) ?? SEASONS[SEASONS.length - 1]).id;
}

export function seasonById(id: SeasonId): Season {
  return SEASONS.find((s) => s.id === id)!;
}

/** The Thai calendar day of `now` (UTC+7), as UTC midnight like session dates. */
function thaiDay(now: Date): Date {
  const local = new Date(now.getTime() + 7 * 3_600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

export function currentSeason(now: Date = new Date()): Season {
  return seasonById(seasonOf(thaiDay(now)));
}

/** Seasons that have begun by `now`, oldest first. */
export function startedSeasons(now: Date = new Date()): Season[] {
  const cur = currentSeason(now).id;
  return SEASONS.filter((s) => s.id <= cur);
}
