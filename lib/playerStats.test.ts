import { describe, it, expect } from "vitest";
import { computePlayerStats, type GameRecord } from "./playerStats";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** One finished game: `team` is the player's side, `winner` decides the result. */
const game = (
  iso: string,
  team: number,
  winner: number | null,
  teammates: string[] = []
): GameRecord => ({
  date: day(iso),
  team,
  winnerTeam: winner,
  teammates: teammates.map((n) => ({ id: `id-${n}`, name: n })),
});

describe("computePlayerStats — results", () => {
  it("counts wins, losses and draws by the player's own team", () => {
    const s = computePlayerStats([
      game("2026-07-20", 1, 1), // won
      game("2026-07-20", 2, 1), // lost
      game("2026-07-20", 1, null), // draw
    ]);
    expect(s).toMatchObject({ games: 3, wins: 1, losses: 1, draws: 1 });
  });

  it("win rate ignores draws", () => {
    // 2 wins, 1 loss, 1 draw -> 2/3
    const s = computePlayerStats([
      game("2026-07-20", 1, 1),
      game("2026-07-20", 1, 1),
      game("2026-07-20", 2, 1),
      game("2026-07-20", 1, null),
    ]);
    expect(s.winRate).toBe(67);
  });

  it("win rate is null when nothing has been decided", () => {
    expect(computePlayerStats([game("2026-07-20", 1, null)]).winRate).toBeNull();
  });

  it("returns an empty shape for a player with no games", () => {
    expect(computePlayerStats([])).toMatchObject({
      games: 0,
      days: 0,
      partners: 0,
      winRate: null,
      firstPlayed: null,
      lastPlayed: null,
    });
  });
});

describe("computePlayerStats — days played", () => {
  it("counts distinct session dates, not games", () => {
    const s = computePlayerStats([
      game("2026-07-20", 1, 1),
      game("2026-07-20", 1, 1),
      game("2026-07-22", 1, 1),
    ]);
    expect(s.games).toBe(3);
    expect(s.days).toBe(2);
  });

  it("tracks first and last day played", () => {
    const s = computePlayerStats([
      game("2026-07-22", 1, 1),
      game("2026-07-20", 1, 1),
      game("2026-07-27", 1, 1),
    ]);
    expect(s.firstPlayed).toEqual(day("2026-07-20"));
    expect(s.lastPlayed).toEqual(day("2026-07-27"));
  });
});

describe("computePlayerStats — partners", () => {
  it("counts distinct partners and ranks the most frequent first", () => {
    const s = computePlayerStats([
      game("2026-07-20", 1, 1, ["NW"]),
      game("2026-07-20", 1, 1, ["NW"]),
      game("2026-07-22", 1, 1, ["BB"]),
    ]);
    expect(s.partners).toBe(2);
    expect(s.topPartners[0]).toMatchObject({ name: "NW", games: 2 });
    expect(s.topPartners[1]).toMatchObject({ name: "BB", games: 1 });
  });

  it("limits how many partners are returned", () => {
    const s = computePlayerStats(
      [game("2026-07-20", 1, 1, ["A", "B", "C", "D"])],
      undefined,
      2
    );
    expect(s.topPartners).toHaveLength(2);
  });
});

describe("computePlayerStats — date range (seasons / กีฬาสี)", () => {
  const games = [
    game("2026-07-20", 1, 1),
    game("2026-08-05", 1, 1),
    game("2026-09-30", 2, 1),
  ];

  it("without a range, counts everything", () => {
    expect(computePlayerStats(games).games).toBe(3);
  });

  it("`from` is inclusive", () => {
    expect(computePlayerStats(games, { from: day("2026-08-05") }).games).toBe(2);
  });

  it("`to` is exclusive, so adjacent ranges do not double-count", () => {
    const aug = computePlayerStats(games, { from: day("2026-08-01"), to: day("2026-09-01") });
    const sep = computePlayerStats(games, { from: day("2026-09-01"), to: day("2026-10-01") });
    expect(aug.games).toBe(1);
    expect(sep.games).toBe(1);
  });

  it("scopes partners and days to the range too", () => {
    const s = computePlayerStats(
      [game("2026-07-20", 1, 1, ["NW"]), game("2026-08-05", 1, 1, ["BB"])],
      { from: day("2026-08-01") }
    );
    expect(s.days).toBe(1);
    expect(s.partners).toBe(1);
    expect(s.topPartners[0].name).toBe("BB");
  });
});
