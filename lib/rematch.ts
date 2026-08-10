/**
 * Who has already played with whom today. The matchmaker avoids reruns on its
 * own, but the admin also hand-picks foursomes (จัดคู่เตรียมเอง) and swaps
 * players with ✎ — those paths need a warning, not a silent repeat.
 *
 * Two different repeats matter to the club:
 *   - partner: the same two people on the SAME team again.
 *   - opponent: the same two people on the same court again (facing each other).
 * A foursome-level repeat (3–4 of the same people in one game) is counted
 * separately by `bestOverlap`.
 */

export interface FinishedGameTeams {
  team1: string[]; // signUp ids
  team2: string[];
}

/** Unordered key for a pair of players, so lookups don't care about order. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export interface PairHistory {
  /** pairKey → how many finished games the two played as partners. */
  partner: Record<string, number>;
  /** pairKey → how many finished games the two played against each other. */
  opponent: Record<string, number>;
}

export function buildPairHistory(games: FinishedGameTeams[]): PairHistory {
  const partner: Record<string, number> = {};
  const opponent: Record<string, number> = {};
  const bump = (map: Record<string, number>, a: string, b: string) => {
    const k = pairKey(a, b);
    map[k] = (map[k] ?? 0) + 1;
  };
  for (const g of games) {
    for (const team of [g.team1, g.team2]) {
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) bump(partner, team[i], team[j]);
      }
    }
    for (const a of g.team1) for (const b of g.team2) bump(opponent, a, b);
  }
  return { partner, opponent };
}

export interface RepeatPair {
  ids: [string, string];
  count: number;
}

export interface FoursomeRepeats {
  /** Same two people teamed up before. */
  partners: RepeatPair[];
  /** Same two people faced each other before. */
  opponents: RepeatPair[];
}

/**
 * Repeats inside one proposed foursome. Only pairs that actually recur are
 * returned, so an empty `partners`/`opponents` means "nothing to warn about".
 */
export function foursomeRepeats(
  team1: string[],
  team2: string[],
  history: PairHistory
): FoursomeRepeats {
  const partners: RepeatPair[] = [];
  const opponents: RepeatPair[] = [];
  for (const team of [team1, team2]) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const count = history.partner[pairKey(team[i], team[j])] ?? 0;
        if (count > 0) partners.push({ ids: [team[i], team[j]], count });
      }
    }
  }
  for (const a of team1) {
    for (const b of team2) {
      const count = history.opponent[pairKey(a, b)] ?? 0;
      if (count > 0) opponents.push({ ids: [a, b], count });
    }
  }
  // Worst repeats first — that's the one the admin should act on.
  partners.sort((x, y) => y.count - x.count);
  opponents.sort((x, y) => y.count - x.count);
  return { partners, opponents };
}
