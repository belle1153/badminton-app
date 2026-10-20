import { rubberPoints } from "./rules";
import type { RubberOutcome, SetScore } from "./types";

export interface StandingRow {
  teamId: string;
  rank: number;
  points: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  /** Rubbers won against the other teams level with this one on points and
   *  wins (0 when nobody is level). */
  h2h: number;
}

interface StandingTie {
  teamAId: string;
  teamBId: string;
  rubbers: { outcome: RubberOutcome; sets: SetScore[] }[];
}

/**
 * Qualifier table. Order (agreed with the organisers): points → rubbers won →
 * head to head (rubbers won in ties between the level teams only) → set-point
 * difference → the admin's manual order → seed. Only finished rubbers (those
 * with an outcome) count, sets included.
 */
export function computeStandings(
  teams: { id: string; seed: number }[],
  ties: StandingTie[],
  rankOverride: string[] | null
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teams.map((t) => [
      t.id,
      { teamId: t.id, rank: 0, points: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, diff: 0, h2h: 0 },
    ])
  );
  // rubbers won by a team against a specific opponent, for head to head
  const winsVs = new Map<string, number>();
  const key = (team: string, opp: string) => `${team}|${opp}`;

  for (const tie of ties) {
    const a = rows.get(tie.teamAId);
    const b = rows.get(tie.teamBId);
    if (!a || !b) continue;
    for (const r of tie.rubbers) {
      if (r.outcome == null) continue;
      const [pa, pb] = rubberPoints("QUALIFIER", r.outcome);
      a.points += pa;
      b.points += pb;
      if (r.outcome === "DRAW") {
        a.drawn++;
        b.drawn++;
      } else {
        const [w, l, wId, lId] = r.outcome === "A" ? [a, b, a.teamId, b.teamId] : [b, a, b.teamId, a.teamId];
        w.won++;
        l.lost++;
        winsVs.set(key(wId, lId), (winsVs.get(key(wId, lId)) ?? 0) + 1);
      }
      for (const [x, y] of r.sets) {
        a.pointsFor += x;
        a.pointsAgainst += y;
        b.pointsFor += y;
        b.pointsAgainst += x;
      }
    }
  }

  for (const row of rows.values()) row.diff = row.pointsFor - row.pointsAgainst;

  // Head to head is computed per group of teams level on points and wins.
  const all = [...rows.values()];
  for (const row of all) {
    const group = all.filter((o) => o.points === row.points && o.won === row.won && o.teamId !== row.teamId);
    row.h2h = group.reduce((sum, o) => sum + (winsVs.get(key(row.teamId, o.teamId)) ?? 0), 0);
  }

  const seed = new Map(teams.map((t) => [t.id, t.seed]));
  const overrideIndex = (id: string) => {
    const i = rankOverride?.indexOf(id) ?? -1;
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };

  all.sort(
    (x, y) =>
      y.points - x.points ||
      y.won - x.won ||
      y.h2h - x.h2h ||
      y.diff - x.diff ||
      overrideIndex(x.teamId) - overrideIndex(y.teamId) ||
      (seed.get(x.teamId) ?? 0) - (seed.get(y.teamId) ?? 0)
  );
  all.forEach((row, i) => (row.rank = i + 1));
  return all;
}
