import { describe, expect, it } from "vitest";
import { summarize, type PlayerTotals } from "./missionSummary";

const p = (name: string, o: Partial<PlayerTotals>): PlayerTotals => ({
  athleteId: name, name, games: 0, days: 0, wins: 0, losses: 0, draws: 0, withdrawals: 0, coins: 0, ...o,
});
const cat = (players: PlayerTotals[], id: string) => summarize(players).find((c) => c.id === id)!;

describe("summarize", () => {
  it("keeps the top three places and lets ties share one", () => {
    const rows = cat(
      [p("a", { games: 10 }), p("b", { games: 9 }), p("c", { games: 9 }), p("d", { games: 8 }), p("e", { games: 7 })],
      "games"
    ).rows;
    expect(rows.map((r) => [r.name, r.rank])).toEqual([["a", 1], ["b", 2], ["c", 2]]);
  });

  it("counts only players with 70+ games for win rate, losses and draws", () => {
    const players = [
      p("few", { games: 69, wins: 69 }),
      p("reg", { games: 80, wins: 40, losses: 20, draws: 20 }),
    ];
    expect(cat(players, "winRate").rows.map((r) => [r.name, r.value])).toEqual([["reg", 66.7]]);
    expect(cat(players, "losses").rows.map((r) => r.name)).toEqual(["reg"]);
    expect(cat(players, "draws").rows.map((r) => r.name)).toEqual(["reg"]);
  });

  it("leaves out zeros", () => {
    expect(cat([p("a", { withdrawals: 0 })], "withdrawals").rows).toEqual([]);
  });
});
