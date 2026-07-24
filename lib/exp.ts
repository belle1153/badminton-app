import { computeStreaks } from "./streaks";

/** One day the player actually played, in the shape the EXP engine needs. */
export interface DayPlayed {
  date: Date;
  games: number;
  wins: number;
  checkedOut: boolean;
  /** Distinct teammates that day (athlete ids). */
  partnerIds: string[];
}

export interface ExpBreakdown {
  total: number;
  attendance: number;
  games: number;
  wins: number;
  checkouts: number;
  streakBonus: number;
  newPartnerBonus: number;
}

const PER_DAY = 100;
const PER_GAME = 20;
const PER_WIN = 10;
const PER_CHECKOUT = 20;
const STREAK_BONUS = 25;
/** Bonus stops growing past 4 consecutive club days (i.e. +100/day, capped). */
const STREAK_BONUS_CAP_DAYS = 4;
const NEW_PARTNER_BONUS = 15;
/** Only the first 3 new partners in a day earn the bonus. */
const NEW_PARTNER_DAILY_CAP = 3;

/**
 * `days` must be this player's played days, ascending. `clubPlayDates` is every
 * date, across ALL players, that had at least one finished game — streaks are
 * measured against that shared calendar, so a club day the player missed
 * breaks it, not just a calendar gap.
 */
export function computeExp(days: DayPlayed[], clubPlayDates: Date[]): ExpBreakdown {
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
    checkouts: 0,
    streakBonus: 0,
    newPartnerBonus: 0,
  };

  days.forEach((day, i) => {
    b.attendance += PER_DAY;
    b.games += day.games * PER_GAME;
    b.wins += day.wins * PER_WIN;
    if (day.checkedOut) b.checkouts += PER_CHECKOUT;

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

  b.total = b.attendance + b.games + b.wins + b.checkouts + b.streakBonus + b.newPartnerBonus;
  return b;
}
