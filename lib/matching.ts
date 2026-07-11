export type SkillLevel = "RK" | "N_MINUS" | "N" | "N_PLUS" | "S" | "S_PLUS" | "BG" | "BG_PLUS" | "P";

// Club skill progression, weakest → strongest: RK, BG, BG+, N-, N, N+, S, S+, P.
export const SKILL_RANK: Record<SkillLevel, number> = {
  RK: 0,
  BG: 1,
  BG_PLUS: 2,
  N_MINUS: 3,
  N: 4,
  N_PLUS: 5,
  S: 6,
  S_PLUS: 7,
  P: 8,
};

// Key order here drives the dropdown order (via Object.keys).
export const SKILL_LABELS: Record<SkillLevel, string> = {
  RK: "RK",
  BG: "BG",
  BG_PLUS: "BG+",
  N_MINUS: "N-",
  N: "N",
  N_PLUS: "N+",
  S: "S",
  S_PLUS: "S+",
  P: "P",
};

export interface Player {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  fixedPartnerId?: string | null;
}

export interface CourtMatch {
  court: number;
  team1: Player[];
  team2: Player[];
}

interface Team {
  members: [Player, Player];
  strength: number;
}

/**
 * Groups players into skill-balanced 2v2 courts, respecting admin-assigned
 * fixed practice pairs (they always play as one team together).
 *
 * 1. Mutual fixed pairs become pre-formed teams.
 * 2. Remaining singles are paired strongest+weakest (two-pointer) into ad
 *    hoc teams, same balancing intent as before, just applied once to form
 *    teams instead of directly seeding 4-player groups.
 * 3. A leftover single (odd count) benches directly.
 * 4. Teams are sorted by combined strength and matched against their
 *    strength-adjacent neighbor, so opposing teams are as close as possible.
 * `courtNumbers` are the specific physical courts the admin ticked as
 * available this round (e.g. [1, 3, 5]); teams beyond however many pairs
 * fit those courts bench for this round.
 */
export function generateMatches(
  players: Player[],
  courtNumbers: number[]
): { matches: CourtMatch[]; bench: Player[] } {
  const byId = new Map(players.map((p) => [p.id, p]));
  const visited = new Set<string>();
  const teams: Team[] = [];
  const leftoverSingles: Player[] = [];

  for (const player of players) {
    if (visited.has(player.id)) continue;
    const partner = player.fixedPartnerId ? byId.get(player.fixedPartnerId) : undefined;
    if (partner && !visited.has(partner.id) && partner.fixedPartnerId === player.id) {
      visited.add(player.id);
      visited.add(partner.id);
      teams.push({
        members: [player, partner],
        strength: SKILL_RANK[player.skillLevel] + SKILL_RANK[partner.skillLevel],
      });
    }
  }

  const singles = players
    .filter((p) => !visited.has(p.id))
    .sort((a, b) => SKILL_RANK[b.skillLevel] - SKILL_RANK[a.skillLevel]);

  let lo = 0;
  let hi = singles.length - 1;
  while (lo < hi) {
    const a = singles[lo];
    const b = singles[hi];
    teams.push({ members: [a, b], strength: SKILL_RANK[a.skillLevel] + SKILL_RANK[b.skillLevel] });
    lo++;
    hi--;
  }
  if (lo === hi) leftoverSingles.push(singles[lo]);

  teams.sort((a, b) => b.strength - a.strength);

  const sortedCourtNumbers = [...courtNumbers].sort((a, b) => a - b);
  const courts = Math.max(0, Math.min(sortedCourtNumbers.length, Math.floor(teams.length / 2)));
  const activeTeams = teams.slice(0, courts * 2);
  const benchTeams = teams.slice(courts * 2);

  const matches: CourtMatch[] = [];
  for (let i = 0; i < courts; i++) {
    matches.push({
      court: sortedCourtNumbers[i],
      team1: activeTeams[2 * i].members,
      team2: activeTeams[2 * i + 1].members,
    });
  }

  const bench = [...benchTeams.flatMap((t) => t.members), ...leftoverSingles];

  return { matches, bench };
}
