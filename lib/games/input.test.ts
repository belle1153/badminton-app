import { describe, it, expect } from "vitest";
import { parseSets, parsePairs, duplicateIds, memberConflicts, staleLineupSlots, nextCaptain } from "./input";

describe("parseSets", () => {
  it("accepts up to three pairs of whole numbers 0–99", () => {
    expect(parseSets([[21, 15], [18, 21]])).toEqual([[21, 15], [18, 21]]);
    expect(parseSets([])).toEqual([]);
  });
  it("rejects negatives, fractions, text, too many sets and non-arrays", () => {
    expect(parseSets([[-1, 21]])).toBe(null);
    expect(parseSets([[1.5, 21]])).toBe(null);
    expect(parseSets([["21", 15]])).toBe(null);
    expect(parseSets([[1, 2], [3, 4], [5, 6], [7, 8]])).toBe(null);
    expect(parseSets([[100, 2]])).toBe(null);
    expect(parseSets("21-15")).toBe(null);
  });
});

describe("parsePairs", () => {
  it("takes exactly five pairs, each two ids or blanks", () => {
    expect(parsePairs([["a", "b"], null, ["c", null], [null, null], ["d", "e"]])).toEqual([
      ["a", "b"], [null, null], ["c", null], [null, null], ["d", "e"],
    ]);
  });
  it("rejects the wrong length or shape", () => {
    expect(parsePairs([["a", "b"]])).toBe(null);
    expect(parsePairs([1, 2, 3, 4, 5])).toBe(null);
  });
});

describe("duplicateIds", () => {
  it("finds a player used twice in one lineup", () => {
    expect(duplicateIds([["a", "b"], ["c", "a"], [null, null], [null, null], [null, null]])).toEqual(["a"]);
    expect(duplicateIds([["a", "b"], [null, null], [null, null], [null, null], [null, null]])).toEqual([]);
  });
});

describe("memberConflicts", () => {
  it("names players already on another team of the event", () => {
    const names = new Map([["p1", "ต้น"], ["p2", "บอล"]]);
    expect(memberConflicts(["p1", "p2"], [{ name: "แดง", memberIds: ["p1"] }], names)).toEqual(["ต้น (แดง)"]);
    expect(memberConflicts(["p2"], [{ name: "แดง", memberIds: ["p1"] }], names)).toEqual([]);
  });
});

describe("staleLineupSlots", () => {
  const p = (id: string | null) => (id ? { id } : null);
  const rubber = (id: string, a: (string | null)[], b: (string | null)[], played = {}) => ({
    id,
    a: a.map(p),
    b: b.map(p),
    finished: false,
    sets: [] as [number, number][],
    liveSet: null as number | null,
    ...played,
  });
  const roster = new Set(["n1", "n2", "n3"]);

  it("blanks players no longer on the team from its unplayed pairs, keeping the rest", () => {
    const ties = [
      { teamAId: "T", teamBId: "U", rubbers: [rubber("r1", ["old1", "n1"], ["u1", "u2"]), rubber("r2", ["n2", "n3"], ["u3", "u4"])] },
      { teamAId: "U", teamBId: "T", rubbers: [rubber("r3", ["u1", "u2"], ["old2", "old3"])] },
    ];
    expect(staleLineupSlots(ties, "T", roster)).toEqual([
      { rubberId: "r1", side: "A", ids: [null, "n1"] },
      { rubberId: "r3", side: "B", ids: [null, null] },
    ]);
  });

  it("keeps names on pairs that were played, are being counted or have a score", () => {
    const ties = [
      {
        teamAId: "T",
        teamBId: "U",
        rubbers: [
          rubber("done", ["old1", "old2"], [], { finished: true }),
          rubber("live", ["old1", "old2"], [], { liveSet: 1 }),
          rubber("scored", ["old1", "old2"], [], { sets: [[11, 9]] }),
        ],
      },
    ];
    expect(staleLineupSlots(ties, "T", roster)).toEqual([]);
  });

  it("leaves other teams' lineups and ties without this team alone", () => {
    const ties = [{ teamAId: "U", teamBId: "V", rubbers: [rubber("r1", ["x", "y"], ["z", "w"])] }];
    expect(staleLineupSlots(ties, "T", roster)).toEqual([]);
  });
});

describe("nextCaptain", () => {
  const roster = new Set(["a", "b"]);
  it("takes the captain asked for when they are on the roster, or none", () => {
    expect(nextCaptain("a", "b", roster)).toEqual({ captainId: "b" });
    expect(nextCaptain("a", null, roster)).toEqual({ captainId: null });
  });
  it("refuses a captain who is not on the roster", () => {
    expect(nextCaptain(null, "z", roster)).toEqual({ error: "กัปตันต้องเป็นผู้เล่นในทีม" });
  });
  it("keeps the current captain unless they left the roster", () => {
    expect(nextCaptain("a", undefined, roster)).toEqual({ captainId: "a" });
    expect(nextCaptain("z", undefined, roster)).toEqual({ captainId: null });
    expect(nextCaptain(null, undefined, roster)).toEqual({ captainId: null });
  });
});
