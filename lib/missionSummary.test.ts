import { describe, expect, it } from "vitest";
import { summarize, type PlayerTotals } from "./missionSummary";

const p = (name: string, o: Partial<PlayerTotals>): PlayerTotals => ({
  athleteId: name, name, games: 0, days: 0, wins: 0, losses: 0, draws: 0, coins: 0, ...o,
});
const cat = (players: PlayerTotals[], id: string) => summarize(players).find((c) => c.id === id)!;

describe("summarize", () => {
  it("has the seven categories in the organisers' order", () => {
    expect(summarize([]).map((c) => c.id)).toEqual(["games", "days", "winRate", "wins", "losses", "draws", "coins"]);
  });

  it("lets ties share a place and still fills third after a shared second", () => {
    const rows = cat(
      [p("a", { coins: 29 }), p("b", { coins: 28 }), p("c", { coins: 28 }), p("d", { coins: 27 }), p("e", { coins: 27 }), p("f", { coins: 26 })],
      "coins"
    ).rows;
    expect(rows.map((r) => [r.name, r.rank])).toEqual([["a", 1], ["b", 2], ["c", 2], ["d", 3], ["e", 3]]);
  });

  it("limits only win rate to players with 70+ games", () => {
    const players = [
      p("few", { games: 69, wins: 69, losses: 60, draws: 60 }),
      p("reg", { games: 80, wins: 40, losses: 20, draws: 20 }),
    ];
    expect(cat(players, "winRate").rows.map((r) => [r.name, r.value])).toEqual([["reg", 66.7]]);
    expect(cat(players, "wins").rows.map((r) => r.name)).toEqual(["few", "reg"]);
    expect(cat(players, "losses").rows.map((r) => r.name)).toEqual(["few", "reg"]);
    expect(cat(players, "draws").rows.map((r) => r.name)).toEqual(["few", "reg"]);
  });

  it("leaves out zeros", () => {
    expect(cat([p("a", { wins: 0 })], "wins").rows).toEqual([]);
  });
});
