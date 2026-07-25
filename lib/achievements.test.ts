import { describe, it, expect } from "vitest";
import { computeAchievements, type AchievementContext } from "./achievements";

const ctx = (over: Partial<AchievementContext> = {}): AchievementContext => ({
  gamesPlayed: 0,
  wins: 0,
  draws: 0,
  daysPlayed: 0,
  longestStreakDays: 0,
  distinctPartners: 0,
  bestDayGames: 0,
  bestPartnerGames: 0,
  bestDayHours: 0,
  longDays: 0,
  bestDayPartners: 0,
  bestDayWinStreak: 0,
  isFoundingMember: false,
  ...over,
});

const byId = (list: ReturnType<typeof computeAchievements>, id: string) =>
  list.find((a) => a.id === id)!;

describe("computeAchievements", () => {
  it("gives a brand-new player nothing", () => {
    expect(computeAchievements(ctx()).every((a) => !a.earned)).toBe(true);
  });

  it("unlocks at the threshold, not before", () => {
    expect(byId(computeAchievements(ctx({ gamesPlayed: 24 })), "games-25").earned).toBe(false);
    expect(byId(computeAchievements(ctx({ gamesPlayed: 25 })), "games-25").earned).toBe(true);
  });

  it("shows progress while locked and drops it once earned", () => {
    const locked = byId(computeAchievements(ctx({ wins: 7 })), "wins-10");
    expect(locked).toMatchObject({ earned: false, progressLabel: "7/10" });
    const earned = byId(computeAchievements(ctx({ wins: 10 })), "wins-10");
    expect(earned.earned).toBe(true);
    expect(earned.progressLabel).toBeUndefined();
  });

  it("unlocks lower tiers alongside higher ones", () => {
    const all = computeAchievements(ctx({ gamesPlayed: 120 }));
    expect(byId(all, "first-game").earned).toBe(true);
    expect(byId(all, "games-25").earned).toBe(true);
    expect(byId(all, "games-100").earned).toBe(true);
    expect(byId(all, "games-250").earned).toBe(false);
  });

  it("tracks streaks separately from total days", () => {
    // Came 10 times but never twice in a row.
    const all = computeAchievements(ctx({ daysPlayed: 10, longestStreakDays: 1 }));
    expect(byId(all, "days-10").earned).toBe(true);
    expect(byId(all, "streak-3").earned).toBe(false);
  });

  it("awards the founding badge from its flag alone", () => {
    expect(byId(computeAchievements(ctx()), "founding-member").earned).toBe(false);
    expect(byId(computeAchievements(ctx({ isFoundingMember: true })), "founding-member").earned).toBe(
      true
    );
  });

  it("has unique ids and a decent spread of goals", () => {
    const all = computeAchievements(ctx());
    expect(new Set(all.map((a) => a.id)).size).toBe(all.length);
    expect(all.length).toBeGreaterThanOrEqual(20);
  });

  it("rewards nothing the player cannot control themselves", () => {
    // Checking out is admin-only, so no badge may depend on it.
    const ids = computeAchievements(ctx()).map((a) => a.id);
    expect(ids).not.toContain("disciplined");
  });

  it("tracks a favourite partner separately from partner variety", () => {
    const all = computeAchievements(ctx({ distinctPartners: 2, bestPartnerGames: 10 }));
    expect(byId(all, "duo-10").earned).toBe(true);
    expect(byId(all, "partners-10").earned).toBe(false);
  });

  it("tracks the best single day", () => {
    expect(byId(computeAchievements(ctx({ bestDayGames: 6 })), "day-6-games").earned).toBe(true);
    expect(byId(computeAchievements(ctx({ bestDayGames: 6 })), "day-10-games").earned).toBe(false);
  });

  it("counts long days cumulatively, so one 3h day only unlocks the first tier", () => {
    const one = computeAchievements(ctx({ longDays: 1 }));
    expect(byId(one, "long-day-1").earned).toBe(true);
    expect(byId(one, "long-day-5").earned).toBe(false);

    const twenty = computeAchievements(ctx({ longDays: 20 }));
    expect(byId(twenty, "long-day-5").earned).toBe(true);
    expect(byId(twenty, "long-day-20").earned).toBe(true);
  });

  it("ดาวเด่น counts partners within one day, not the lifetime total", () => {
    // Plenty of partners overall, but never more than 2 in a single day.
    const spread = computeAchievements(ctx({ distinctPartners: 30, bestDayPartners: 2 }));
    expect(byId(spread, "star-day").earned).toBe(false);

    expect(byId(computeAchievements(ctx({ bestDayPartners: 5 })), "star-day").earned).toBe(true);
  });

  it("ยอดฝีมือ needs 3 wins in a row, not 3 wins spread out", () => {
    const scattered = computeAchievements(ctx({ wins: 20, bestDayWinStreak: 2 }));
    expect(byId(scattered, "hot-hand").earned).toBe(false);

    expect(byId(computeAchievements(ctx({ bestDayWinStreak: 3 })), "hot-hand").earned).toBe(true);
  });

  it("has the badges the admin asked to drop, gone", () => {
    const ids = computeAchievements(ctx()).map((a) => a.id);
    expect(ids).not.toContain("night-owl");
    expect(ids).not.toContain("court-explorer");
  });

  it("นักการทูต now needs 10 draws, not 5", () => {
    expect(byId(computeAchievements(ctx({ draws: 5 })), "diplomat").earned).toBe(false);
    expect(byId(computeAchievements(ctx({ draws: 10 })), "diplomat").earned).toBe(true);
  });

  it("uses single-codepoint icons, which render consistently across devices", () => {
    // ZWJ sequences (🧑‍🤝‍🧑, ❤️‍🔥) split into their parts on devices without the
    // combined glyph, which is what made the coin grid look inconsistent.
    for (const a of computeAchievements(ctx())) {
      expect(a.icon).not.toContain("‍");
    }
  });
});
