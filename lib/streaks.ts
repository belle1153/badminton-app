/**
 * A "streak" is consecutive attendance measured against the CLUB's own
 * calendar of play days, not the player's personal gaps — missing a session
 * the club actually ran breaks it, but the club skipping a week doesn't count
 * against anyone.
 */

/** ISO yyyy-mm-dd, stable regardless of time-of-day on the Date object. */
const key = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Streak length ending at each of `playerDates`, in the same order. `playerDates`
 * must be a subset of `clubPlayDates`, both sorted ascending.
 *
 * e.g. club played Mon/Wed/Fri; a player who attended Mon and Fri (missed Wed)
 * gets `[1, 1]` — each is an isolated day, not a 2-streak, because a club day
 * was missed in between.
 */
export function computeStreaks(playerDates: Date[], clubPlayDates: Date[]): number[] {
  const indexByDate = new Map(clubPlayDates.map((d, i) => [key(d), i]));
  const streaks: number[] = [];
  let streak = 0;
  let lastIndex: number | null = null;

  for (const d of playerDates) {
    const idx = indexByDate.get(key(d));
    if (idx == null) {
      // Not part of the given calendar — treat as an isolated day rather than
      // throwing, so a caller building the calendar slightly differently still
      // gets a sane answer instead of a crash.
      streak = 1;
    } else {
      streak = lastIndex != null && idx === lastIndex + 1 ? streak + 1 : 1;
      lastIndex = idx;
    }
    streaks.push(streak);
  }
  return streaks;
}

export function longestStreak(playerDates: Date[], clubPlayDates: Date[]): number {
  const streaks = computeStreaks(playerDates, clubPlayDates);
  return streaks.length === 0 ? 0 : Math.max(...streaks);
}
