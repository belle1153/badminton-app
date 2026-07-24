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

// Club weighting groups the 9 levels into 4 tiers for balancing:
// 1=RK · 2=BG,BG+ · 3=N-,N,N+ · 4=S,S+,P
export const SKILL_TIER: Record<SkillLevel, number> = {
  RK: 1,
  BG: 2,
  BG_PLUS: 2,
  N_MINUS: 3,
  N: 3,
  N_PLUS: 3,
  S: 4,
  S_PLUS: 4,
  P: 4,
};

export interface Player {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  fixedPartnerId?: string | null;
}

/**
 * Split exactly four players into the two most even teams by tier weight
 * (a team's weight = sum of its players' tiers). A mutual fixed pair always
 * stays together.
 *
 * Besides the weight difference, `mismatch` measures how differently the two
 * teams are composed: sorted tiers compared position by position. Equal sums
 * can still feel unfair — RK+S+ (1,4) vs BG+N- (2,3) is 5v5 but plays badly,
 * so mirrored line-ups (N-+S+ vs N-+P → (3,4) vs (3,4)) are preferred.
 */
export function balanceTeams(four: Player[]): {
  team1: Player[];
  team2: Player[];
  diff: number;
  mismatch: number;
} {
  const [a, b, c, d] = four;
  const w = (p: Player) => SKILL_TIER[p.skillLevel];
  const r = (p: Player) => SKILL_RANK[p.skillLevel];
  const splits: [Player[], Player[]][] = [
    [[a, b], [c, d]],
    [[a, c], [b, d]],
    [[a, d], [b, c]],
  ];
  const paired = (t: Player[]) =>
    t[0].fixedPartnerId === t[1].id && t[1].fixedPartnerId === t[0].id;
  const hasPair = splits.some(([t1, t2]) => paired(t1) || paired(t2));

  let best:
    | { team1: Player[]; team2: Player[]; diff: number; mismatch: number; rankDiff: number }
    | null = null;
  for (const [t1, t2] of splits) {
    if (hasPair && !(paired(t1) || paired(t2))) continue; // never break a fixed pair
    const diff = Math.abs(w(t1[0]) + w(t1[1]) - (w(t2[0]) + w(t2[1])));
    const s1 = [w(t1[0]), w(t1[1])].sort((x, y) => x - y);
    const s2 = [w(t2[0]), w(t2[1])].sort((x, y) => x - y);
    const mismatch = Math.abs(s1[0] - s2[0]) + Math.abs(s1[1] - s2[1]);
    // Fine tiebreak by the full 9-level rank: BG and BG+ share a tier but BG+
    // is stronger, so pair the weakest with the strongest (RK+BG+ vs BG+BG,
    // not RK+BG vs BG+BG+) when the tier sums tie.
    const rankDiff = Math.abs(r(t1[0]) + r(t1[1]) - (r(t2[0]) + r(t2[1])));
    if (
      !best ||
      diff < best.diff ||
      (diff === best.diff && mismatch < best.mismatch) ||
      (diff === best.diff && mismatch === best.mismatch && rankDiff < best.rankDiff)
    ) {
      best = { team1: t1, team2: t2, diff, mismatch, rankDiff };
    }
  }
  return best!;
}

/**
 * Cost of putting two skill groups on the same court, from the club's pairing
 * table (lower = more suitable). Group = SKILL_TIER: 1=RK, 2=BG/BG+,
 * 3=N-/N/N+, 4=S/S+/P. Same group is ideal (0); the two low groups (RK+BG) and
 * the two high groups (N+S) pair well (20); crossing the whole range (RK+S) is
 * worst (50). Indexed [1..4][1..4]; row/col 0 unused.
 */
const GROUP_PAIR_COST: number[][] = [
  [0, 0, 0, 0, 0],
  [0, 0, 20, 40, 50],
  [0, 20, 0, 30, 40],
  [0, 40, 30, 0, 20],
  [0, 50, 40, 20, 0],
];

/**
 * How skill-mismatched a foursome is: the sum of the group-pair cost over all
 * six pairings. 0 = everyone in the same group; higher = wider skill spread.
 * The matchmaker minimizes this first so each court plays players of the
 * closest skill possible.
 */
export function courtSkillCost(four: Player[]): number {
  let cost = 0;
  for (let a = 0; a < four.length; a++) {
    for (let b = a + 1; b < four.length; b++) {
      cost += GROUP_PAIR_COST[SKILL_TIER[four[a].skillLevel]][SKILL_TIER[four[b].skillLevel]];
    }
  }
  return cost;
}

/**
 * The single worst pairing on a court, from the same table. Used as a hard
 * gate: the club's line is "RK never meets N-and-up opponents' tier gap"
 * — a sum like courtSkillCost can hide one terrible pairing inside an
 * otherwise-cheap total, so gates must look at the worst pair, not the sum.
 */
export function worstPairCost(four: Player[]): number {
  let worst = 0;
  for (let a = 0; a < four.length; a++) {
    for (let b = a + 1; b < four.length; b++) {
      worst = Math.max(
        worst,
        GROUP_PAIR_COST[SKILL_TIER[four[a].skillLevel]][SKILL_TIER[four[b].skillLevel]]
      );
    }
  }
  return worst;
}

/**
 * How many คู่เตรียม the system keeps queued ahead (the admin's own number).
 * Small on purpose: players held back in the waiting pool give the matchmaker
 * more people to choose from, which is what keeps the มือ on a court close.
 * จัดคู่เตรียมเอง (hand-picked) is not counted against this.
 */
export const PENDING_QUEUE_CAP = 3;
