import { describe, expect, it } from "vitest";
import { buildPlayerProgress, type ProgressSignUp } from "./playerProgress";
import { buildSeasonedProgress } from "./seasonProgress";
import { levelProgress } from "./levels";

const ME = "me";
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** One sign-up on `date` with `games` finished games partnered with `partner`, won when `won`. */
function day(date: string, games: number, partner = "p1", won = true): ProgressSignUp {
  const at = d(date);
  return {
    timeSlot: "EARLY",
    paidAt: null,
    session: { date: at },
    matchSlots: Array.from({ length: games }, (_, i) => ({
      team: 1,
      match: {
        finishedAt: new Date(at.getTime() + (13 + i) * 3_600_000),
        winnerTeam: won ? 1 : 2,
        players: [
          { team: 1, signUp: { athleteId: ME } },
          { team: 1, signUp: { athleteId: partner } },
          { team: 2, signUp: { athleteId: "x" } },
          { team: 2, signUp: { athleteId: "y" } },
        ],
      },
    })),
  };
}

const ids = (p: { achievements: { id: string; earned: boolean }[] }) =>
  p.achievements.filter((a) => a.earned).map((a) => a.id);

describe("buildSeasonedProgress", () => {
  it("before Season 2 matches the all-time progress exactly", () => {
    const signUps = [day("2026-11-23", 3), day("2026-11-25", 2)];
    const club = [d("2026-11-23"), d("2026-11-25")];
    const all = buildPlayerProgress(ME, signUps, club, 40);
    const s = buildSeasonedProgress(ME, signUps, club, new Map([[1, 40]]), new Date("2026-11-29T12:00:00+07:00"));
    expect(s.seasons).toHaveLength(1);
    expect(s.current.season.id).toBe(1);
    expect(s.lifetimeExp).toBe(all.exp.total);
    expect(s.level).toEqual(all.level);
    expect(s.current.progress.exp).toEqual(all.exp);
  });

  it("splits at 30 Nov: lifetime level, fresh streak, coins re-earnable, no founding coin", () => {
    const signUps = [day("2026-11-23", 3), day("2026-11-25", 2), day("2026-12-02", 2)];
    const club = [d("2026-11-23"), d("2026-11-25"), d("2026-12-02")];
    const s = buildSeasonedProgress(ME, signUps, club, new Map(), new Date("2026-12-03T12:00:00+07:00"));
    const [s1, s2] = s.seasons;
    expect(s.seasons).toHaveLength(2);
    expect(s.current.season.id).toBe(2);
    expect(s.lifetimeExp).toBe(s1.progress.exp.total + s2.progress.exp.total);
    expect(s.level.level).toBe(levelProgress(s.lifetimeExp).level);
    // SS2's only day is the first of the season: no streak carried over.
    expect(s2.progress.exp.streakBonus).toBe(0);
    expect(s1.progress.exp.streakBonus).toBeGreaterThan(0);
    expect(ids(s1.progress)).toContain("first-game");
    expect(ids(s2.progress)).toContain("first-game");
    expect(ids(s1.progress)).toContain("founding-member");
    expect(s2.progress.achievements.map((a) => a.id)).not.toContain("founding-member");
  });

  it("a player with no Season 2 play starts at zero", () => {
    const signUps = [day("2026-11-23", 3)];
    const club = [d("2026-11-23"), d("2026-12-02")];
    const s = buildSeasonedProgress(ME, signUps, club, new Map([[1, 50]]), new Date("2026-12-03T12:00:00+07:00"));
    expect(s.current.progress.exp.total).toBe(0);
    expect(s.current.progress.achievements.every((a) => !a.earned)).toBe(true);
    expect(s.lifetimeExp).toBe(s.seasons[0].progress.exp.total);
    expect(s.seasons[0].progress.exp.total).toBeGreaterThan(50);
  });

  it("quest EXP goes to its own season", () => {
    const signUps = [day("2026-11-23", 1), day("2026-12-02", 1)];
    const club = [d("2026-11-23"), d("2026-12-02")];
    const base = buildSeasonedProgress(ME, signUps, club, new Map(), new Date("2026-12-03T12:00:00+07:00"));
    const s = buildSeasonedProgress(ME, signUps, club, new Map([[1, 30], [2, 70]]), new Date("2026-12-03T12:00:00+07:00"));
    expect(s.seasons[0].progress.exp.total - base.seasons[0].progress.exp.total).toBe(30);
    expect(s.seasons[1].progress.exp.total - base.seasons[1].progress.exp.total).toBe(70);
  });
});
