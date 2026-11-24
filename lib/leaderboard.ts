import { prisma } from "@/lib/db";
import { type RankTheme } from "@/lib/levels";
import { loadClubPlayDays, PROGRESS_SIGNUP_SELECT, type ProgressSignUp } from "@/lib/playerProgress";
import { loadQuestExpByAthleteBySeason } from "@/lib/questProgress";
import { buildSeasonedProgress, type SeasonedProgress } from "@/lib/seasonProgress";
import { currentSeason, type SeasonId } from "@/lib/seasons";

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
  /** The season `exp`, `days` and `games` are counted over. */
  season: SeasonId;
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
 * Every athlete's seasoned progress, in one pass over every sign-up rather than
 * calling loadSeasonedProgress per athlete, which would be two queries each —
 * roughly 160 round trips for the current roster.
 */
async function loadRoster(now: Date) {
  const [signUps, clubDays, athletes, questExp] = await Promise.all([
    prisma.signUp.findMany({
      where: { athleteId: { not: null }, status: { not: "WITHDRAWN" } },
      select: { athleteId: true, ...PROGRESS_SIGNUP_SELECT },
    }),
    loadClubPlayDays(),
    prisma.athlete.findMany({
      select: { id: true, name: true, photoUrl: true, updatedAt: true },
    }),
    loadQuestExpByAthleteBySeason(now),
  ]);

  const byAthlete = new Map<string, ProgressSignUp[]>();
  for (const s of signUps) {
    if (!s.athleteId) continue;
    const list = byAthlete.get(s.athleteId);
    if (list) list.push(s);
    else byAthlete.set(s.athleteId, [s]);
  }

  // The same seasoned calculation the profile uses — computing EXP separately
  // here is how the two drifted apart when badges started paying out.
  const byId = new Map(athletes.map((a) => [a.id, a]));
  const out: { athlete: (typeof athletes)[number]; seasoned: SeasonedProgress }[] = [];
  for (const [athleteId, playerSignUps] of byAthlete) {
    const athlete = byId.get(athleteId);
    if (!athlete) continue;
    out.push({
      athlete,
      seasoned: buildSeasonedProgress(
        athleteId,
        playerSignUps,
        clubDays,
        questExp.get(athleteId) ?? new Map(),
        now
      ),
    });
  }
  return out;
}

/**
 * Ranks one season. `lifetimeLevel` shows the player's real level (the live
 * leaderboard); otherwise the level is that season's alone — "Lv at the end of
 * Season 1" on the hall of fame, which must not move during later seasons.
 *
 * Counts places, not people: cutting at a fixed number of players would drop
 * someone who is genuinely tied with the last person shown, which is exactly
 * the unfairness the shared-place ranking exists to avoid. A big tie can
 * therefore return more than `maxRank` players, and that's correct.
 */
async function rankSeason(
  seasonId: SeasonId,
  maxRank: number,
  now: Date,
  lifetimeLevel: boolean
): Promise<LeaderboardEntry[]> {
  const roster = await loadRoster(now);
  const picked = new Map<string, { athlete: (typeof roster)[number]["athlete"]; s: SeasonedProgress; season: SeasonedProgress["current"] }>();
  const rows: RankableRow[] = [];
  for (const { athlete, seasoned } of roster) {
    const season = seasoned.seasons.find((x) => x.season.id === seasonId);
    if (!season || season.progress.exp.total <= 0) continue;
    picked.set(athlete.id, { athlete, s: seasoned, season });
    rows.push({
      athleteId: athlete.id,
      name: athlete.name,
      exp: season.progress.exp.total,
      days: season.progress.daysPlayed,
      games: season.progress.gamesPlayed,
    });
  }

  return rankPlayers(rows)
    .filter((r) => r.rank <= maxRank)
    .map((r) => {
      const { athlete, s, season } = picked.get(r.athleteId)!;
      const level = lifetimeLevel ? s.level : season.progress.level;
      return {
        rank: r.rank,
        athleteId: r.athleteId,
        name: r.name,
        hasPhoto: athlete.photoUrl != null,
        photoVersion: athlete.updatedAt.getTime(),
        exp: r.exp,
        level: level.level,
        rankTitle: level.rank,
        theme: level.theme,
        days: r.days,
        games: r.games,
        season: seasonId,
      };
    });
}

/** The live leaderboard: this season's EXP, the player's lifetime level. */
export function loadLeaderboard(maxRank = Infinity, now: Date = new Date()): Promise<LeaderboardEntry[]> {
  return rankSeason(currentSeason(now).id, maxRank, now, true);
}

/** One season's final table, with each player's level from that season alone. */
export function loadSeasonLeaderboard(
  seasonId: SeasonId,
  maxRank = Infinity,
  now: Date = new Date()
): Promise<LeaderboardEntry[]> {
  return rankSeason(seasonId, maxRank, now, false);
}
