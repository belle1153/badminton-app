import { describe, it, expect } from "vitest";
import { computeStandings } from "./standings";
import type { RubberOutcome, SetScore } from "./types";

/** A rubber won by `side` with the given margin per set (2–0 in sets). */
function rubber(side: "A" | "B" | "DRAW" | null, margin = 6): { outcome: RubberOutcome; sets: SetScore[] } {
  const win: SetScore = [21, 21 - margin];
  const lose: SetScore = [21 - margin, 21];
  if (side === "A") return { outcome: "A", sets: [win, win] };
  if (side === "B") return { outcome: "B", sets: [lose, lose] };
  if (side === "DRAW") return { outcome: "DRAW", sets: [win, lose] };
  return { outcome: null, sets: [win, win] }; // keyed but not finished
}

function tie(teamAId: string, teamBId: string, sides: ("A" | "B" | "DRAW" | null)[], margins: number[] = []) {
  return { teamAId, teamBId, rubbers: sides.map((s, i) => rubber(s, margins[i] ?? 6)) };
}

const order = (rows: { teamId: string }[]) => rows.map((r) => r.teamId);

describe("computeStandings", () => {
  it("counts 2/1/0 per rubber and the won–drawn–lost record", () => {
    const rows = computeStandings(
      [{ id: "red", seed: 1 }, { id: "yellow", seed: 6 }],
      [tie("red", "yellow", ["A", "B", "A", "DRAW", "A"])],
      null
    );
    expect(rows[0]).toMatchObject({ teamId: "red", rank: 1, points: 7, won: 3, drawn: 1, lost: 1 });
    expect(rows[1]).toMatchObject({ teamId: "yellow", rank: 2, points: 3, won: 1, drawn: 1, lost: 3 });
  });

  it("sums set points for and against into the difference", () => {
    const rows = computeStandings(
      [{ id: "a", seed: 1 }, { id: "b", seed: 2 }],
      [tie("a", "b", ["A"], [10])],
      null
    );
    expect(rows[0]).toMatchObject({ pointsFor: 42, pointsAgainst: 22, diff: 20 });
  });

  it("ignores rubbers that are keyed but not finished", () => {
    const rows = computeStandings(
      [{ id: "a", seed: 1 }, { id: "b", seed: 2 }],
      [tie("a", "b", [null, null])],
      null
    );
    expect(rows[0]).toMatchObject({ points: 0, won: 0, pointsFor: 0 });
  });

  it("breaks a points-and-wins tie on head to head (blue beat pink 3–2)", () => {
    const teams = [{ id: "pink", seed: 2 }, { id: "blue", seed: 5 }, { id: "green", seed: 4 }];
    const rows = computeStandings(
      teams,
      [
        tie("pink", "blue", ["B", "B", "B", "A", "A"]),
        // pink's wins are big ones, so set difference alone would put pink first
        tie("pink", "green", ["A", "A", "A", "A", "B"], [20, 20, 20, 20, 1]),
        tie("blue", "green", ["A", "A", "A", "B", "B"]),
      ],
      null
    );
    expect(rows.find((r) => r.teamId === "pink")).toMatchObject({ points: 12, won: 6 });
    expect(rows.find((r) => r.teamId === "blue")).toMatchObject({ points: 12, won: 6 });
    expect(order(rows)).toEqual(["blue", "pink", "green"]);
  });

  it("uses head to head only among the tied group in a three-way tie", () => {
    const teams = ["a", "b", "c", "d"].map((id, i) => ({ id, seed: i + 1 }));
    const rows = computeStandings(
      teams,
      [
        tie("a", "b", ["A", "A", "A", "B", "B"]),
        tie("a", "c", ["A", "A", "A", "B", "B"]),
        tie("b", "c", ["A", "A", "A", "B", "B"]),
        // results against d level a, b and c on points and wins; c's margins are
        // huge so a set-difference or all-games head to head would reorder them
        tie("a", "d", ["A", "B", "B", "B", "B"]),
        tie("b", "d", ["A", "A", "B", "B", "B"]),
        tie("c", "d", ["A", "A", "A", "B", "B"], [20, 20, 20, 1, 1]),
      ],
      null
    );
    expect(rows.filter((r) => r.teamId !== "d").every((r) => r.points === 14 && r.won === 7)).toBe(true);
    expect(order(rows)).toEqual(["d", "a", "b", "c"]);
  });

  it("falls back to the admin's order, then to seed, when everything is level", () => {
    const teams = [{ id: "x", seed: 2 }, { id: "y", seed: 1 }];
    expect(order(computeStandings(teams, [], null))).toEqual(["y", "x"]);
    expect(order(computeStandings(teams, [], ["x", "y"]))).toEqual(["x", "y"]);
  });
});
