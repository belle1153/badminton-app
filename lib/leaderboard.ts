import { prisma } from "@/lib/db";
import { computeExp, type DayPlayed } from "@/lib/exp";
import { levelProgress, type RankTheme } from "@/lib/levels";

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
 * The top N by EXP.
 *
 * Deliberately one pass over every sign-up rather than calling
 * loadPlayerProgress per athlete, which would be two queries each — roughly
 * 160 round trips for the current roster.
 */
export async function loadLeaderboard(limit = 5): Promise<LeaderboardEntry[]> {
  const [signUps, clubDays, athletes] = await Promise.all([
    prisma.signUp.findMany({
      where: { athleteId: { not: null }, status: { not: "WITHDRAWN" } },
      select: {
        athleteId: true,
        timeSlot: true,
        session: { select: { date: true } },
        matchSlots: {
          select: {
            team: true,
            match: {
              select: {
                finishedAt: true,
                winnerTeam: true,
                players: { select: { team: true, signUp: { select: { athleteId: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.session
      .findMany({
        where: { matches: { some: { finishedAt: { not: null } } } },
        select: { date: true },
        orderBy: { date: "asc" },
      })
      .then((rows) => rows.map((r) => r.date)),
    prisma.athlete.findMany({
      select: { id: true, name: true, photoUrl: true, updatedAt: true },
    }),
  ]);

  // athleteId -> dateKey -> that day's play, mirroring loadPlayerProgress.
  const byAthlete = new Map<string, Map<string, DayPlayed>>();

  for (const s of signUps) {
    const athleteId = s.athleteId;
    if (!athleteId) continue;
    const dateKey = s.session.date.toISOString().slice(0, 10);

    for (const slot of s.matchSlots) {
      const m = slot.match;
      if (!m.finishedAt) continue;

      let days = byAthlete.get(athleteId);
      if (!days) {
        days = new Map();
        byAthlete.set(athleteId, days);
      }
      let entry = days.get(dateKey);
      if (!entry) {
        entry = { date: s.session.date, games: 0, wins: 0, partnerIds: [] };
        days.set(dateKey, entry);
      }

      entry.games++;
      if (m.winnerTeam != null && m.winnerTeam === slot.team) entry.wins++;

      for (const p of m.players) {
        if (p.team !== slot.team) continue;
        const pid = p.signUp.athleteId;
        if (!pid || pid === athleteId) continue;
        if (!entry.partnerIds.includes(pid)) entry.partnerIds.push(pid);
      }
    }
  }

  const byId = new Map(athletes.map((a) => [a.id, a]));
  const rows: RankableRow[] = [];
  for (const [athleteId, dayMap] of byAthlete) {
    const athlete = byId.get(athleteId);
    if (!athlete) continue;
    const days = [...dayMap.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
    const exp = computeExp(days, clubDays).total;
    if (exp <= 0) continue;
    rows.push({
      athleteId,
      name: athlete.name,
      exp,
      days: days.length,
      games: days.reduce((n, d) => n + d.games, 0),
    });
  }

  return rankPlayers(rows)
    .slice(0, limit)
    .map((r) => {
      const athlete = byId.get(r.athleteId)!;
      const progress = levelProgress(r.exp);
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
