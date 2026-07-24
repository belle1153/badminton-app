import { describe, it, expect } from "vitest";
import { computeAchievements, type AchievementContext } from "./achievements";

const ctx = (over: Partial<AchievementContext> = {}): AchievementContext => ({
  gamesPlayed: 0,
  wins: 0,
  draws: 0,
  daysPlayed: 0,
  longestStreakDays: 0,
  distinctPartners: 0,
  nightGames: 0,
  bestDayGames: 0,
  bestPartnerGames: 0,
  distinctCourts: 0,
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
});
