import { computeStreaks } from "./streaks";

/** One day the player actually played, in the shape the EXP engine needs. */
export interface DayPlayed {
  date: Date;
  games: number;
  wins: number;
  /** Distinct teammates that day (athlete ids). */
  partnerIds: string[];
}

export interface ExpBreakdown {
  total: number;
  attendance: number;
  games: number;
  wins: number;
  streakBonus: number;
  newPartnerBonus: number;
  /** EXP from earned achievements — see RARITY_EXP in achievementRarity.ts. */
  badges: number;
}

/**
 * Exported so the rules shown to players are generated from the same numbers
 * the engine scores with — a hand-written rules list drifts out of date the
 * moment any of these move, which is exactly what happened to the club's first
 * announcement (it still promised EXP for checking out, months after that was
 * removed).
 */
export const EXP_RATES = {
  perDay: 100,
  perGame: 20,
  perWin: 10,
  streakBonus: 25,
  /** Bonus stops growing past this many consecutive club days. */
  streakCapDays: 4,
  newPartnerBonus: 15,
  /** Only this many new partners in a day earn the bonus. */
  newPartnerDailyCap: 5,
} as const;

const PER_DAY = EXP_RATES.perDay;
const PER_GAME = EXP_RATES.perGame;
const PER_WIN = EXP_RATES.perWin;
const STREAK_BONUS = EXP_RATES.streakBonus;
const STREAK_BONUS_CAP_DAYS = EXP_RATES.streakCapDays;
const NEW_PARTNER_BONUS = EXP_RATES.newPartnerBonus;
const NEW_PARTNER_DAILY_CAP = EXP_RATES.newPartnerDailyCap;

// Checking out deliberately earns nothing: only the admin can do it (the
// endpoint is admin-only, there is no player-facing control), so paying for it
// would hand out EXP for someone else's action and penalise players on days the
// admin didn't get round to it.

/**
 * `days` must be this player's played days, ascending. `clubPlayDates` is every
 * date, across ALL players, that had at least one finished game — streaks are
 * measured against that shared calendar, so a club day the player missed
 * breaks it, not just a calendar gap.
 *
 * `badgeExp` is the total for achievements already earned. It's passed in
 * rather than computed here because achievements depend only on play history,
 * never on EXP, so the caller works them out first and hands over the sum —
 * which keeps this function free of any dependency on the badge list.
 */
export function computeExp(
  days: DayPlayed[],
  clubPlayDates: Date[],
  badgeExp = 0
): ExpBreakdown {
  const streaks = computeStreaks(
    days.map((d) => d.date),
    clubPlayDates
  );
  const seenPartners = new Set<string>();

  const b: ExpBreakdown = {
    total: 0,
    attendance: 0,
    games: 0,
    wins: 0,
    streakBonus: 0,
    newPartnerBonus: 0,
    badges: badgeExp,
  };

  days.forEach((day, i) => {
    b.attendance += PER_DAY;
    b.games += day.games * PER_GAME;
    b.wins += day.wins * PER_WIN;

    const streak = streaks[i];
    if (streak > 1) {
      b.streakBonus += STREAK_BONUS * Math.min(streak - 1, STREAK_BONUS_CAP_DAYS);
    }

    let newToday = 0;
    for (const pid of day.partnerIds) {
      if (seenPartners.has(pid)) continue;
      seenPartners.add(pid);
      if (newToday < NEW_PARTNER_DAILY_CAP) {
        b.newPartnerBonus += NEW_PARTNER_BONUS;
        newToday++;
      }
    }
  });

  b.total = b.attendance + b.games + b.wins + b.streakBonus + b.newPartnerBonus + b.badges;
  return b;
}
