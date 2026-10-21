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
   *  difference (0 when nobody is level). */
  h2h: number;
  /** Set-point difference in those same head-to-head ties. */
  h2hDiff: number;
}

interface StandingTie {
  teamAId: string;
  teamBId: string;
  rubbers: { outcome: RubberOutcome; sets: SetScore[] }[];
  /** SECRET CARD points on top of the rubbers (may be negative after a STEAL). */
  bonusA?: number;
  bonusB?: number;
}

/**
 * Qualifier table. Order (organisers, revised 2026-10-21): points → set-point
 * difference → head to head among the teams still level: rubbers won, then the
 * set-point difference of those ties → the admin's manual order → seed. Only
 * finished rubbers (those with an outcome) count, sets included.
 */
export function computeStandings(
  teams: { id: string; seed: number }[],
  ties: StandingTie[],
  rankOverride: string[] | null
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teams.map((t) => [
      t.id,
      { teamId: t.id, rank: 0, points: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, diff: 0, h2h: 0, h2hDiff: 0 },
    ])
  );
  // per opponent, for head to head: rubbers won and set-point difference
  const winsVs = new Map<string, number>();
  const diffVs = new Map<string, number>();
  const key = (team: string, opp: string) => `${team}|${opp}`;
  const add = (map: Map<string, number>, k: string, n: number) => map.set(k, (map.get(k) ?? 0) + n);

  for (const tie of ties) {
    const a = rows.get(tie.teamAId);
    const b = rows.get(tie.teamBId);
    if (!a || !b) continue;
    a.points += tie.bonusA ?? 0;
    b.points += tie.bonusB ?? 0;
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
        add(winsVs, key(wId, lId), 1);
      }
      for (const [x, y] of r.sets) {
        a.pointsFor += x;
        a.pointsAgainst += y;
        b.pointsFor += y;
        b.pointsAgainst += x;
        add(diffVs, key(a.teamId, b.teamId), x - y);
        add(diffVs, key(b.teamId, a.teamId), y - x);
      }
    }
  }

  for (const row of rows.values()) row.diff = row.pointsFor - row.pointsAgainst;

  // Head to head is computed per group of teams level on points and difference.
  const all = [...rows.values()];
  for (const row of all) {
    const group = all.filter((o) => o.points === row.points && o.diff === row.diff && o.teamId !== row.teamId);
    row.h2h = group.reduce((sum, o) => sum + (winsVs.get(key(row.teamId, o.teamId)) ?? 0), 0);
    row.h2hDiff = group.reduce((sum, o) => sum + (diffVs.get(key(row.teamId, o.teamId)) ?? 0), 0);
  }

  const seed = new Map(teams.map((t) => [t.id, t.seed]));
  const overrideIndex = (id: string) => {
    const i = rankOverride?.indexOf(id) ?? -1;
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };

  all.sort(
    (x, y) =>
      y.points - x.points ||
      y.diff - x.diff ||
      y.h2h - x.h2h ||
      y.h2hDiff - x.h2hDiff ||
      overrideIndex(x.teamId) - overrideIndex(y.teamId) ||
      (seed.get(x.teamId) ?? 0) - (seed.get(y.teamId) ?? 0)
  );
  all.forEach((row, i) => (row.rank = i + 1));
  return all;
}
