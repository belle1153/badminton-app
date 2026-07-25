import { prisma } from "@/lib/db";
import { computeExp, type DayPlayed, type ExpBreakdown } from "@/lib/exp";
import { levelProgress, type LevelProgress } from "@/lib/levels";
import { longestStreak } from "@/lib/streaks";
import { computeAchievements, type Achievement } from "@/lib/achievements";
import { blockStart } from "@/lib/billing";
import { longestWinRun, hoursOnCourt } from "@/lib/dayStats";

/** How many of the club's first play-days count as "รุ่นบุกเบิก". */
const FOUNDING_WINDOW = 4;
/** Hours on court that make a day count toward the อึด badges. */
const LONG_DAY_HOURS = 3;

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
        timeSlot: true,
        session: { select: { date: true } },
        matchSlots: {
          select: {
            team: true,
            match: {
              select: {
                finishedAt: true,
                winnerTeam: true,
                court: true,
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
  type DayEntry = DayPlayed & {
    draws: number;
    /** Per-game outcomes, for the within-a-day win-streak badge. */
    results: { finishedAt: Date; won: boolean }[];
    /** Start of the block they signed up for, for the hours-on-court badges. */
    blockStartAt: Date;
    lastFinishedAt: Date | null;
  };
  const byDate = new Map<string, DayEntry>();
  // Across all days, for the achievement metrics.
  const gamesPerPartner = new Map<string, number>();
  let isFoundingMember = false;

  for (const s of signUps) {
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
          partnerIds: [],
          draws: 0,
          results: [],
          blockStartAt: blockStart(s.session.date, s.timeSlot as "EARLY" | "LATE"),
          lastFinishedAt: null,
        };
        byDate.set(dateKey, entry);
      }

      entry.games++;
      const won = m.winnerTeam != null && m.winnerTeam === slot.team;
      if (m.winnerTeam == null) entry.draws++;
      else if (won) entry.wins++;

      entry.results.push({ finishedAt: m.finishedAt, won });
      if (!entry.lastFinishedAt || m.finishedAt > entry.lastFinishedAt) {
        entry.lastFinishedAt = m.finishedAt;
      }

      for (const p of m.players) {
        if (p.team !== slot.team) continue;
        const pid = p.signUp.athleteId;
        if (!pid || pid === athleteId) continue;
        if (!entry.partnerIds.includes(pid)) entry.partnerIds.push(pid);
        gamesPerPartner.set(pid, (gamesPerPartner.get(pid) ?? 0) + 1);
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
  const dayHours = days.map((d) =>
    d.lastFinishedAt ? hoursOnCourt(d.blockStartAt, d.lastFinishedAt) : 0
  );
  const achievements = computeAchievements({
    gamesPlayed: days.reduce((n, d) => n + d.games, 0),
    wins: days.reduce((n, d) => n + d.wins, 0),
    draws: days.reduce((n, d) => n + d.draws, 0),
    daysPlayed: days.length,
    longestStreakDays: streakDays,
    distinctPartners: partnerIds.size,
    bestDayGames: days.reduce((n, d) => Math.max(n, d.games), 0),
    bestPartnerGames: Math.max(0, ...gamesPerPartner.values()),
    bestDayHours: Math.max(0, ...dayHours),
    longDays: dayHours.filter((h) => h >= LONG_DAY_HOURS).length,
    bestDayPartners: days.reduce((n, d) => Math.max(n, d.partnerIds.length), 0),
    bestDayWinStreak: days.reduce((n, d) => Math.max(n, longestWinRun(d.results)), 0),
    isFoundingMember,
  });

  return { exp, level, achievements, longestStreakDays: streakDays };
}
