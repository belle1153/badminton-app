import { describe, it, expect } from "vitest";
import { longestWinRun, hoursOnCourt, type DayGameResult } from "./dayStats";

const g = (minute: number, won: boolean): DayGameResult => ({
  finishedAt: new Date(Date.UTC(2026, 6, 20, 12, minute)),
  won,
});

describe("longestWinRun", () => {
  it("counts the longest consecutive run, not the total wins", () => {
    // W W L W -> best run is 2, even though the day has 3 wins in total
    expect(longestWinRun([g(10, true), g(20, true), g(30, false), g(40, true)])).toBe(2);
  });

  it("finds a run that ends the day", () => {
    expect(longestWinRun([g(10, false), g(20, true), g(30, true), g(40, true)])).toBe(3);
  });

  it("orders by finish time before counting", () => {
    // Supplied out of order; the three wins are actually consecutive.
    const shuffled = [g(40, false), g(20, true), g(10, true), g(30, true)];
    expect(longestWinRun(shuffled)).toBe(3);
  });

  it("returns 0 when nothing was won", () => {
    expect(longestWinRun([g(10, false), g(20, false)])).toBe(0);
  });

  it("returns 0 for an empty day", () => {
    expect(longestWinRun([])).toBe(0);
  });

  it("does not mutate its input", () => {
    const games = [g(30, true), g(10, true)];
    const before = games.map((x) => x.finishedAt.getTime());
    longestWinRun(games);
    expect(games.map((x) => x.finishedAt.getTime())).toEqual(before);
  });
});

describe("hoursOnCourt", () => {
  const start = new Date(Date.UTC(2026, 6, 20, 12)); // 19:00 ICT

  it("measures from block start to the last finished game", () => {
    const end = new Date(Date.UTC(2026, 6, 20, 15)); // 22:00 ICT
    expect(hoursOnCourt(start, end)).toBe(3);
  });

  it("handles part hours", () => {
    const end = new Date(Date.UTC(2026, 6, 20, 14, 30));
    expect(hoursOnCourt(start, end)).toBe(2.5);
  });

  it("never goes negative when a game finished before the block started", () => {
    const end = new Date(Date.UTC(2026, 6, 20, 11));
    expect(hoursOnCourt(start, end)).toBe(0);
  });
});
