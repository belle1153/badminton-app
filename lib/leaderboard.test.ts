import { describe, it, expect } from "vitest";
import { rankPlayers, type RankableRow } from "./leaderboard";

const p = (name: string, exp: number, days = 1, games = 1): RankableRow => ({
  athleteId: `id-${name}`,
  name,
  exp,
  days,
  games,
});

describe("rankPlayers", () => {
  it("orders by EXP, highest first", () => {
    const ranked = rankPlayers([p("B", 100), p("A", 300), p("C", 200)]);
    expect(ranked.map((r) => r.name)).toEqual(["A", "C", "B"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("gives tied players the same place", () => {
    const ranked = rankPlayers([p("A", 300), p("B", 300), p("C", 100)]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("skips the places consumed by a tie", () => {
    // Three-way tie for first means the next player is 4th, not 2nd.
    const ranked = rankPlayers([p("A", 300), p("B", 300), p("C", 300), p("D", 50)]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 1, 4]);
  });

  it("breaks equal EXP by days played, then games", () => {
    const ranked = rankPlayers([
      p("fewer-days", 300, 2, 20),
      p("more-days", 300, 5, 10),
    ]);
    expect(ranked[0].name).toBe("more-days");
    // Still the same place — the tiebreak only decides display order.
    expect(ranked.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("falls back to name so the order is stable between loads", () => {
    const ranked = rankPlayers([p("Zed", 300, 1, 1), p("Ann", 300, 1, 1)]);
    expect(ranked.map((r) => r.name)).toEqual(["Ann", "Zed"]);
  });

  it("handles an empty roster", () => {
    expect(rankPlayers([])).toEqual([]);
  });

  it("does not mutate its input", () => {
    const rows = [p("B", 100), p("A", 300)];
    const before = rows.map((r) => r.name);
    rankPlayers(rows);
    expect(rows.map((r) => r.name)).toEqual(before);
  });
});
