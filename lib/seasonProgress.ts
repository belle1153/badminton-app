import { prisma } from "@/lib/db";
import { levelProgress, type LevelProgress } from "@/lib/levels";
import {
  buildPlayerProgress,
  loadClubPlayDays,
  PROGRESS_SIGNUP_SELECT,
  type PlayerProgress,
  type ProgressSignUp,
} from "@/lib/playerProgress";
import { currentSeason, inSeason, startedSeasons, type Season, type SeasonId } from "@/lib/seasons";

export interface SeasonProgress {
  season: Season;
  /** That season alone. Its `level` is levelProgress of this season's EXP only
   *  — used for "Lv at the end of Season 1", never as the player's level. */
  progress: PlayerProgress;
}

export interface SeasonedProgress {
  /** Every season that has started, oldest first. */
  seasons: SeasonProgress[];
  current: SeasonProgress;
  /** Sum of every season's EXP — what Level is built from. */
  lifetimeExp: number;
  /** The player's level: it never resets between seasons. */
  level: LevelProgress;
}

const FOUNDING_ID = "founding-member";

/**
 * A player's progress split into seasons. Each season is the ordinary
 * buildPlayerProgress run over that season's sign-ups and club days only, so
 * streaks, new-partner bonuses and coins start over; Level is the lifetime sum.
 *
 * Shared by the profile, leaderboard and summary so they cannot disagree.
 */
export function buildSeasonedProgress(
  athleteId: string,
  signUps: ProgressSignUp[],
  clubDays: Date[],
  questExpBySeason: Map<SeasonId, number>,
  now: Date = new Date()
): SeasonedProgress {
  const seasons = startedSeasons(now).map((season, i) => {
    const progress = buildPlayerProgress(
      athleteId,
      signUps.filter((s) => inSeason(s.session.date, season)),
      clubDays.filter((d) => inSeason(d, season)),
      questExpBySeason.get(season.id) ?? 0,
      i === 0 ? {} : { foundingWindow: 0 }
    );
    // The founding coin belongs to the club's first days only; with no
    // founding window it is never earned, so dropping it costs no EXP.
    if (i > 0) progress.achievements = progress.achievements.filter((a) => a.id !== FOUNDING_ID);
    return { season, progress };
  });

  const lifetimeExp = seasons.reduce((n, s) => n + s.progress.exp.total, 0);
  const cur = currentSeason(now).id;
  return {
    seasons,
    current: seasons.find((s) => s.season.id === cur) ?? seasons[seasons.length - 1],
    lifetimeExp,
    level: levelProgress(lifetimeExp),
  };
}

export async function loadSeasonedProgress(
  athleteId: string,
  questExpBySeason: Map<SeasonId, number>,
  now: Date = new Date()
): Promise<SeasonedProgress> {
  const [signUps, clubDays] = await Promise.all([
    prisma.signUp.findMany({
      where: { athleteId, status: { not: "WITHDRAWN" } },
      select: PROGRESS_SIGNUP_SELECT,
    }),
    loadClubPlayDays(),
  ]);
  return buildSeasonedProgress(athleteId, signUps, clubDays, questExpBySeason, now);
}
