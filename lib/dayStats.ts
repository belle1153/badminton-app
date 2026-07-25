/**
 * Within-a-single-day figures for achievements. Kept pure and separate from the
 * DB loader so the counting rules are testable on their own.
 */

/** One finished game's outcome for the player, in the order it was played. */
export interface DayGameResult {
  /** When the game finished — used only to order the day's games. */
  finishedAt: Date;
  won: boolean;
}

/**
 * Longest run of consecutive wins inside one day.
 *
 * Games are sorted by finish time first: the caller collects them per sign-up,
 * which does not guarantee play order, and a run only means anything in the
 * order they were actually played. Draws and losses both break a run.
 */
export function longestWinRun(games: DayGameResult[]): number {
  const inOrder = [...games].sort((a, b) => a.finishedAt.getTime() - b.finishedAt.getTime());
  let best = 0;
  let run = 0;
  for (const g of inOrder) {
    run = g.won ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/**
 * Hours spent on court that day: from the block the player signed up for
 * (19:00 or 20:00 ICT) to their last finished game.
 *
 * Deliberately NOT based on `checkedOutAt` — only an admin can set that, so a
 * badge resting on it would be unearnable by the player themselves, and would
 * silently miss on days nobody got round to checking people out.
 */
export function hoursOnCourt(blockStartAt: Date, lastFinishedAt: Date): number {
  const ms = lastFinishedAt.getTime() - blockStartAt.getTime();
  return ms <= 0 ? 0 : ms / 3_600_000;
}
