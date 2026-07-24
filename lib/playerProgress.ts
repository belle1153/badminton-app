import { prisma } from "@/lib/db";
import { computeExp, type DayPlayed, type ExpBreakdown } from "@/lib/exp";
import { levelProgress, type LevelProgress } from "@/lib/levels";
import { longestStreak } from "@/lib/streaks";
import { computeAchievements, type Achievement } from "@/lib/achievements";

/** How many of the club's first play-days count as "รุ่นบุกเบิก". */
const FOUNDING_WINDOW = 4;
/** ICT hour after which a finished game counts toward the นกฮูก badge. */
const NIGHT_HOUR_ICT = 22;

export interface PlayerProgress {
  exp: ExpBreakdown;
  level: LevelProgress;
  achievements: Achievement[];
  longestStreakDays: number;
}

/**
 * Everything gamified about one player, derived from match history on read.
 *
 * Nothing here is stored: the admin can edit a result, delete a game, or swap a
 * player out of a finished game, so a persisted EXP counter would drift away
 * from the truth permanently. This recomputes instead.
 */
export async function loadPlayerProgress(athleteId: string): Promise<PlayerProgress> {
  const [signUps, clubDays] = await Promise.all([
    prisma.signUp.findMany({
      where: { athleteId, status: { not: "WITHDRAWN" } },
      select: {
        checkedOutAt: true,
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
    // The club's own calendar of play-days: every session date that produced at
    // least one finished game. Streaks are measured against this, so missing a
    // day the club actually ran breaks a streak, while the club skipping a week
    // does not penalise anyone.
    prisma.session
      .findMany({
        where: { matches: { some: { finishedAt: { not: null } } } },
        select: { date: true },
        orderBy: { date: "asc" },
      })
      .then((rows) => rows.map((r) => r.date)),
  ]);

  const foundingDates = new Set(
    clubDays.slice(0, FOUNDING_WINDOW).map((d) => d.toISOString().slice(0, 10))
  );

  // One entry per session the player actually finished a game in.
  const byDate = new Map<string, DayPlayed & { draws: number; nightGames: number }>();
  let checkoutCount = 0;
  let isFoundingMember = false;

  for (const s of signUps) {
    if (s.checkedOutAt) checkoutCount++;
    const dateKey = s.session.date.toISOString().slice(0, 10);

    for (const slot of s.matchSlots) {
      const m = slot.match;
      if (!m.finishedAt) continue;

      let entry = byDate.get(dateKey);
      if (!entry) {
        entry = {
          date: s.session.date,
          games: 0,
          wins: 0,
          checkedOut: s.checkedOutAt != null,
          partnerIds: [],
          draws: 0,
          nightGames: 0,
        };
        byDate.set(dateKey, entry);
      }

      entry.games++;
      if (m.winnerTeam == null) entry.draws++;
      else if (m.winnerTeam === slot.team) entry.wins++;

      // finishedAt is a UTC instant; ICT is UTC+7 with no DST.
      const ictHour = (m.finishedAt.getUTCHours() + 7) % 24;
      if (ictHour >= NIGHT_HOUR_ICT) entry.nightGames++;

      for (const p of m.players) {
        if (p.team !== slot.team) continue;
        const pid = p.signUp.athleteId;
        if (pid && pid !== athleteId && !entry.partnerIds.includes(pid)) entry.partnerIds.push(pid);
      }

      if (foundingDates.has(dateKey)) isFoundingMember = true;
    }
  }

  const days = [...byDate.values()].sort((a, b) => a.date.getTime() - b.date.getTime());

  const exp = computeExp(days, clubDays);
  const level = levelProgress(exp.total);
  const streakDays = longestStreak(
    days.map((d) => d.date),
    clubDays
  );

  const partnerIds = new Set(days.flatMap((d) => d.partnerIds));
  const achievements = computeAchievements({
    gamesPlayed: days.reduce((n, d) => n + d.games, 0),
    wins: days.reduce((n, d) => n + d.wins, 0),
    draws: days.reduce((n, d) => n + d.draws, 0),
    daysPlayed: days.length,
    longestStreakDays: streakDays,
    distinctPartners: partnerIds.size,
    checkoutCount,
    nightGames: days.reduce((n, d) => n + d.nightGames, 0),
    isFoundingMember,
  });

  return { exp, level, achievements, longestStreakDays: streakDays };
}
