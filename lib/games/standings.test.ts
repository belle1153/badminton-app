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

  it("breaks a points tie on point difference first, even against head to head", () => {
    const teams = [{ id: "pink", seed: 2 }, { id: "blue", seed: 5 }, { id: "green", seed: 4 }];
    const rows = computeStandings(
      teams,
      [
        tie("pink", "blue", ["B", "B", "B", "A", "A"]), // blue wins head to head 3–2
        tie("pink", "green", ["A", "A", "A", "A", "B"], [20, 20, 20, 20, 1]), // but pink wins big
        tie("blue", "green", ["A", "A", "A", "B", "B"]),
      ],
      null
    );
    expect(rows.find((r) => r.teamId === "pink")).toMatchObject({ points: 12, diff: 146 });
    expect(rows.find((r) => r.teamId === "blue")).toMatchObject({ points: 12, diff: 24 });
    expect(order(rows)).toEqual(["pink", "blue", "green"]);
  });

  it("then puts the team that won more rubbers head to head first", () => {
    const teams = [{ id: "y", seed: 1 }, { id: "x", seed: 2 }, { id: "q", seed: 3 }];
    const rows = computeStandings(
      teams,
      [
        tie("x", "y", ["A", "A", "A", "B", "B"]), // x beats y 3–2
        tie("x", "q", ["A", "A", "A", "A", "B"]),
        tie("y", "q", ["A", "A", "A", "A", "A"]),
      ],
      null
    );
    expect(rows.find((r) => r.teamId === "x")).toMatchObject({ points: 14, diff: 48, h2h: 3 });
    expect(rows.find((r) => r.teamId === "y")).toMatchObject({ points: 14, diff: 48, h2h: 2 });
    expect(order(rows)).toEqual(["x", "y", "q"]);
  });

  it("then on the point difference of the head-to-head tie", () => {
    const teams = [{ id: "y", seed: 1 }, { id: "x", seed: 2 }, { id: "q", seed: 3 }];
    const rows = computeStandings(
      teams,
      [
        // 2 rubbers each and a draw, but x's wins were by far more
        tie("x", "y", ["A", "A", "B", "B", "DRAW"], [10, 10, 2, 2, 6]),
        tie("x", "q", ["A", "A", "A", "A", "A"], [1, 1, 1, 1, 1]),
        tie("y", "q", ["A", "A", "A", "A", "A"], [8, 8, 7, 7, 7]),
      ],
      null
    );
    expect(rows.find((r) => r.teamId === "x")).toMatchObject({ points: 15, diff: 42, h2h: 2, h2hDiff: 32 });
    expect(rows.find((r) => r.teamId === "y")).toMatchObject({ points: 15, diff: 42, h2h: 2, h2hDiff: -32 });
    expect(order(rows)).toEqual(["x", "y", "q"]);
  });

  it("counts head to head only among the teams still level in a three-way tie", () => {
    const teams = [{ id: "c", seed: 1 }, { id: "b", seed: 2 }, { id: "a", seed: 3 }, { id: "d", seed: 4 }];
    const rows = computeStandings(
      teams,
      [
        tie("a", "b", ["A", "A", "A", "B", "B"]),
        tie("a", "c", ["A", "A", "A", "B", "B"]),
        tie("b", "c", ["A", "A", "A", "B", "B"]),
        // results against d level a, b and c on points and difference (7 rubbers won
        // each, so counting every game would not separate them)
        tie("a", "d", ["A", "B", "B", "B", "B"]),
        tie("b", "d", ["A", "A", "B", "B", "B"]),
        tie("c", "d", ["A", "A", "A", "B", "B"]),
      ],
      null
    );
    expect(rows.filter((r) => r.teamId !== "d").every((r) => r.points === 14 && r.diff === -12 && r.won === 7)).toBe(true);
    expect(order(rows)).toEqual(["d", "a", "b", "c"]);
  });

  it("falls back to the admin's order, then to seed, when everything is level", () => {
    const teams = [{ id: "x", seed: 2 }, { id: "y", seed: 1 }];
    expect(order(computeStandings(teams, [], null))).toEqual(["y", "x"]);
    expect(order(computeStandings(teams, [], ["x", "y"]))).toEqual(["x", "y"]);
  });
});
