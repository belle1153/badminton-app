import { prisma } from "@/lib/db";
import { type RankTheme } from "@/lib/levels";
import {
  buildPlayerProgress,
  loadClubPlayDays,
  PROGRESS_SIGNUP_SELECT,
  type ProgressSignUp,
} from "@/lib/playerProgress";
import { loadQuestExpByAthlete } from "@/lib/questProgress";

export interface LeaderboardEntry {
  rank: number;
  athleteId: string;
  name: string;
  hasPhoto: boolean;
  photoVersion: number;
  exp: number;
  level: number;
  rankTitle: string;
  theme: RankTheme;
  days: number;
  games: number;
}

export interface RankableRow {
  athleteId: string;
  name: string;
  exp: number;
  days: number;
  games: number;
}

/**
 * Orders players and assigns places. Ties share a place (two firsts, then a
 * third) so nobody is put below someone they're level with on an arbitrary
 * tiebreak — with a roster this small, an unexplained ordering between equals
 * is the kind of thing people notice.
 *
 * EXP decides, then days played, then games, then name for a stable order.
 */
export function rankPlayers<T extends RankableRow>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort(
    (a, b) =>
      b.exp - a.exp ||
      b.days - a.days ||
      b.games - a.games ||
      a.name.localeCompare(b.name, "th")
  );

  const out: (T & { rank: number })[] = [];
  let lastExp: number | null = null;
  let lastRank = 0;
  sorted.forEach((row, i) => {
    const rank = lastExp != null && row.exp === lastExp ? lastRank : i + 1;
    lastExp = row.exp;
    lastRank = rank;
    out.push({ ...row, rank });
  });
  return out;
}

/**
 * Everyone holding a place of `maxRank` or better.
 *
 * Counts places, not people: cutting at a fixed number of players would drop
 * someone who is genuinely tied with the last person shown, which is exactly
 * the unfairness the shared-place ranking exists to avoid. A big tie can
 * therefore return more than `maxRank` players, and that's correct.
 *
 * Deliberately one pass over every sign-up rather than calling
 * loadPlayerProgress per athlete, which would be two queries each — roughly
 * 160 round trips for the current roster.
 */
export async function loadLeaderboard(maxRank = 5): Promise<LeaderboardEntry[]> {
  const [signUps, clubDays, athletes, questExpByAthlete] = await Promise.all([
    prisma.signUp.findMany({
      where: { athleteId: { not: null }, status: { not: "WITHDRAWN" } },
      select: { athleteId: true, ...PROGRESS_SIGNUP_SELECT },
    }),
    loadClubPlayDays(),
    prisma.athlete.findMany({
      select: { id: true, name: true, photoUrl: true, updatedAt: true },
    }),
    loadQuestExpByAthlete(),
  ]);

  // Group each player's sign-ups, then run the same progress calculation the
  // profile uses — computing EXP separately here is how the two drifted apart
  // when badges started paying out.
  const byAthlete = new Map<string, ProgressSignUp[]>();
  for (const s of signUps) {
    if (!s.athleteId) continue;
    const list = byAthlete.get(s.athleteId);
    if (list) list.push(s);
    else byAthlete.set(s.athleteId, [s]);
  }

  const byId = new Map(athletes.map((a) => [a.id, a]));
  const progressById = new Map<string, ReturnType<typeof buildPlayerProgress>>();
  const rows: RankableRow[] = [];
  for (const [athleteId, playerSignUps] of byAthlete) {
    const athlete = byId.get(athleteId);
    if (!athlete) continue;
    const progress = buildPlayerProgress(
      athleteId,
      playerSignUps,
      clubDays,
      questExpByAthlete.get(athleteId) ?? 0
    );
    if (progress.exp.total <= 0) continue;
    progressById.set(athleteId, progress);
    rows.push({
      athleteId,
      name: athlete.name,
      exp: progress.exp.total,
      days: progress.daysPlayed,
      games: progress.gamesPlayed,
    });
  }

  return rankPlayers(rows)
    .filter((r) => r.rank <= maxRank)
    .map((r) => {
      const athlete = byId.get(r.athleteId)!;
      const progress = progressById.get(r.athleteId)!.level;
      return {
        rank: r.rank,
        athleteId: r.athleteId,
        name: r.name,
        hasPhoto: athlete.photoUrl != null,
        photoVersion: athlete.updatedAt.getTime(),
        exp: r.exp,
        level: progress.level,
        rankTitle: progress.rank,
        theme: progress.theme,
        days: r.days,
        games: r.games,
      };
    });
}
