import { prisma } from "@/lib/db";

/**
 * Per-player playing stats, derived from match history.
 *
 * Two deliberate choices:
 *
 * 1. Everything is computed from `Match`/`MatchPlayer` on every read rather than
 *    kept as running totals. The admin can edit a result, delete a game, or swap
 *    a player out of a finished game, so a stored counter would drift away from
 *    the truth permanently and silently.
 *
 * 2. "Days played" counts session dates where the player actually finished a
 *    game — NOT `SignUp.checkedInAt`. The club does not use the check-in button
 *    (it is null on every sign-up in the database), so attendance has to be read
 *    off something the club really produces.
 *
 * The date range exists from the start so a season or a กีฬาสี period is just a
 * different range over the same function instead of a schema change later.
 */

export interface GameRecord {
  /** The session's date (stored at UTC midnight of the intended local date). */
  date: Date;
  /** Which team the player was on in this game. */
  team: number;
  /** 1 or 2; null means a draw. */
  winnerTeam: number | null;
  /** Same-team players, excluding the player themselves. */
  teammates: { id: string; name: string }[];
}

export interface DateRange {
  /** Inclusive. */
  from?: Date;
  /** Exclusive, so month and quarter ranges tile without overlapping. */
  to?: Date;
}

export interface PartnerCount {
  id: string;
  name: string;
  games: number;
}

export interface PlayerStats {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  /** 0–100, rounded. Null when no decided game has been played. */
  winRate: number | null;
  /** Distinct session dates with at least one finished game. */
  days: number;
  /** How many different people they have partnered with. */
  partners: number;
  /** Most-frequent partners, highest first. */
  topPartners: PartnerCount[];
  firstPlayed: Date | null;
  lastPlayed: Date | null;
}

function inRange(date: Date, range?: DateRange): boolean {
  if (!range) return true;
  if (range.from && date.getTime() < range.from.getTime()) return false;
  if (range.to && date.getTime() >= range.to.getTime()) return false;
  return true;
}

/** Pure aggregation — no DB, so the counting rules are unit-testable. */
export function computePlayerStats(
  games: GameRecord[],
  range?: DateRange,
  topPartnerLimit = 3
): PlayerStats {
  const scoped = games.filter((g) => inRange(g.date, range));

  const days = new Set<string>();
  const partnerGames = new Map<string, PartnerCount>();
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let first: Date | null = null;
  let last: Date | null = null;

  for (const g of scoped) {
    days.add(g.date.toISOString().slice(0, 10));
    if (g.winnerTeam == null) draws++;
    else if (g.winnerTeam === g.team) wins++;
    else losses++;

    for (const t of g.teammates) {
      const prev = partnerGames.get(t.id);
      if (prev) prev.games++;
      else partnerGames.set(t.id, { id: t.id, name: t.name, games: 1 });
    }

    if (!first || g.date.getTime() < first.getTime()) first = g.date;
    if (!last || g.date.getTime() > last.getTime()) last = g.date;
  }

  const decided = wins + losses;
  const topPartners = [...partnerGames.values()]
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name, "th"))
    .slice(0, topPartnerLimit);

  return {
    games: scoped.length,
    wins,
    losses,
    draws,
    winRate: decided > 0 ? Math.round((wins / decided) * 100) : null,
    days: days.size,
    partners: partnerGames.size,
    topPartners,
    firstPlayed: first,
    lastPlayed: last,
  };
}

/**
 * Load every finished game an athlete has played, in the shape
 * `computePlayerStats` expects. Withdrawn sign-ups are excluded, and so are
 * teammates with no athlete link (they cannot be pointed at a profile).
 */
export async function loadPlayerGames(athleteId: string): Promise<GameRecord[]> {
  const signUps = await prisma.signUp.findMany({
    where: { athleteId, status: { not: "WITHDRAWN" } },
    select: {
      session: { select: { date: true } },
      matchSlots: {
        select: {
          team: true,
          match: {
            select: {
              finishedAt: true,
              winnerTeam: true,
              players: {
                select: { team: true, signUp: { select: { athleteId: true, name: true } } },
              },
            },
          },
        },
      },
    },
  });

  const games: GameRecord[] = [];
  for (const s of signUps) {
    for (const slot of s.matchSlots) {
      if (!slot.match.finishedAt) continue;
      const teammates = slot.match.players
        .filter((p) => p.team === slot.team && p.signUp.athleteId && p.signUp.athleteId !== athleteId)
        .map((p) => ({ id: p.signUp.athleteId as string, name: p.signUp.name }));
      games.push({
        date: s.session.date,
        team: slot.team,
        winnerTeam: slot.match.winnerTeam,
        teammates,
      });
    }
  }
  return games;
}
