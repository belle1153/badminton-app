import type { StandingRow } from "./standings";
import type { Side, Stage } from "./types";

interface KnockoutTie {
  id: string;
  stage: Stage;
  slot: number;
  winner: Side | null;
  teamAId: string | null;
  teamBId: string | null;
}

export interface KnockoutSides {
  teamAId: string | null;
  teamBId: string | null;
  /** True while the pairing comes from standings that can still change. */
  projected: boolean;
}

/**
 * Who meets whom in the knockout, derived on every read so an edited result
 * re-pairs everything after it: semis 1 v 4 and 2 v 3, fifth place 5 v 6, then
 * semi winners to the final and semi losers to third place.
 */
export function resolveKnockout(
  ties: KnockoutTie[],
  standings: StandingRow[],
  qualifierDone: boolean
): Record<string, KnockoutSides> {
  const byRank = (rank: number) => standings.find((s) => s.rank === rank)?.teamId ?? null;
  const out: Record<string, KnockoutSides> = {};
  const projected = !qualifierDone;

  const semi = (slot: number) => ties.find((t) => t.stage === "SEMI" && t.slot === slot);
  const semiSides = (slot: number): [string | null, string | null] =>
    slot === 1 ? [byRank(1), byRank(4)] : [byRank(2), byRank(3)];

  for (const t of ties) {
    if (t.stage === "SEMI") {
      const [a, b] = semiSides(t.slot);
      out[t.id] = { teamAId: a, teamBId: b, projected };
    } else if (t.stage === "FIFTH") {
      out[t.id] = { teamAId: byRank(5), teamBId: byRank(6), projected };
    }
  }

  // Winner / loser of a semi once it is decided, else null.
  const fromSemi = (slot: number, want: "winner" | "loser"): string | null => {
    const s = semi(slot);
    if (!s?.winner) return null;
    const [a, b] = semiSides(slot);
    const winnerId = s.winner === "A" ? a : b;
    const loserId = s.winner === "A" ? b : a;
    return want === "winner" ? winnerId : loserId;
  };

  for (const t of ties) {
    if (t.stage === "FINAL") {
      out[t.id] = { teamAId: fromSemi(1, "winner"), teamBId: fromSemi(2, "winner"), projected };
    } else if (t.stage === "THIRD") {
      out[t.id] = { teamAId: fromSemi(1, "loser"), teamBId: fromSemi(2, "loser"), projected };
    }
  }
  return out;
}
