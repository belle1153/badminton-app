import { isKnockout, knockoutSetOver, setsWon } from "./rules";
import type { SetScore, Side, Stage } from "./types";

export interface LiveCount {
  sets: SetScore[];
  /** The set being counted (1-based). */
  liveSet: number;
  /** A side has won the rubber; the page asks before saving. */
  rubberOver: boolean;
}

/**
 * One tap on the live-count screen. +1/−1 only ever touch the set being
 * counted. In the knockout a set closes by itself on the 21/deuce/30 rule and
 * the next one opens, until a side has two sets. Qualifier sets are timed, so
 * they only close when the counter presses "จบเซต" (closeSet).
 */
export function applyTap(stage: Stage, sets: SetScore[], liveSet: number, side: Side, delta: 1 | -1): LiveCount {
  const next: SetScore[] = sets.map(([a, b]) => [a, b]);
  const i = liveSet - 1;
  while (next.length <= i) next.push([0, 0]);
  const cur = next[i];
  const j = side === "A" ? 0 : 1;
  cur[j] = Math.max(0, cur[j] + delta);

  if (delta === 1 && isKnockout(stage) && knockoutSetOver(cur[0], cur[1])) {
    const [a, b] = setsWon(next.slice(0, i + 1));
    if (a >= 2 || b >= 2) return { sets: next, liveSet, rubberOver: true };
    next.push([0, 0]);
    return { sets: next, liveSet: liveSet + 1, rubberOver: false };
  }
  return { sets: next, liveSet, rubberOver: false };
}

/** Qualifier: the counter ends the current set by hand; after set 2 the rubber is over. */
export function closeSet(sets: SetScore[], liveSet: number): LiveCount {
  const next: SetScore[] = sets.map(([a, b]) => [a, b]);
  if (liveSet >= 2) return { sets: next, liveSet, rubberOver: true };
  while (next.length < 2) next.push([0, 0]);
  return { sets: next, liveSet: 2, rubberOver: false };
}
