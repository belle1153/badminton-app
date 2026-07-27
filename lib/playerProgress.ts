import { prisma } from "@/lib/db";
import { computeExp, type DayPlayed, type ExpBreakdown } from "@/lib/exp";
import { levelProgress, type LevelProgress } from "@/lib/levels";
import { longestStreak } from "@/lib/streaks";
import { computeAchievements, type Achievement } from "@/lib/achievements";
import { expForBadge } from "@/lib/achievementRarity";
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
  daysPlayed: number;
  gamesPlayed: number;
}

/**
 * The sign-up shape both callers select — one player's rows for a profile, or
 * everybody's for the leaderboard.
 */
export interface ProgressSignUp {
  timeSlot: string;
  session: { date: Date };
  matchSlots: {
    team: number;
    match: {
      finishedAt: Date | null;
      winnerTeam: number | null;
      players: { team: number; signUp: { athleteId: string | null } }[];
    };
  }[];
}

/**
 * Everything gamified about one player, from their sign-ups.
 *
 * Shared by the profile and the leaderboard so the two can never disagree about
 * someone's EXP — the leaderboard used to compute a bare total of its own,
 * which stopped matching the profile the moment badges started paying EXP.
 *
 * Nothing is stored: the admin can edit a result, delete a game, or swap a
 * player out of a finished game, so a persisted counter would drift from the
 * truth permanently. This recomputes on every read.
 */
export function buildPlayerProgress(
  athleteId: string,
  signUps: ProgressSignUp[],
  clubDays: Date[],
  /** EXP from completed quests — supplied by the caller, since quests live in
   *  their own table and are evaluated separately. */
  questExp = 0
): PlayerProgress {
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
  const streakDays = longestStreak(
    days.map((d) => d.date),
    clubDays
  );

  const partnerIds = new Set(days.flatMap((d) => d.partnerIds));
  const dayHours = days.map((d) =>
    d.lastFinishedAt ? hoursOnCourt(d.blockStartAt, d.lastFinishedAt) : 0
  );
  const gamesPlayed = days.reduce((n, d) => n + d.games, 0);

  const achievements = computeAchievements({
    gamesPlayed,
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

  // Achievements are worked out first: they depend only on play history, never
  // on EXP, so their reward can be folded into the total before levelling.
  const badgeExp = achievements
    .filter((a) => a.earned)
    .reduce((n, a) => n + expForBadge(a.target), 0);

  const exp = computeExp(days, clubDays, badgeExp + questExp);

  return {
    exp,
    level: levelProgress(exp.total),
    achievements,
    longestStreakDays: streakDays,
    daysPlayed: days.length,
    gamesPlayed,
  };
}

/** Every session date that produced at least one finished game — the club's own
 *  calendar, which streaks are measured against. */
export function loadClubPlayDays(): Promise<Date[]> {
  return prisma.session
    .findMany({
      where: { matches: { some: { finishedAt: { not: null } } } },
      select: { date: true },
      orderBy: { date: "asc" },
    })
    .then((rows) => rows.map((r) => r.date));
}

/** What both callers need to select for buildPlayerProgress to work. */
export const PROGRESS_SIGNUP_SELECT = {
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
} as const;

export async function loadPlayerProgress(
  athleteId: string,
  questExp = 0
): Promise<PlayerProgress> {
  const [signUps, clubDays] = await Promise.all([
    prisma.signUp.findMany({
      where: { athleteId, status: { not: "WITHDRAWN" } },
      select: PROGRESS_SIGNUP_SELECT,
    }),
    loadClubPlayDays(),
  ]);

  return buildPlayerProgress(athleteId, signUps, clubDays, questExp);
}
