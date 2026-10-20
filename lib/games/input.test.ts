import { describe, it, expect } from "vitest";
import { parseSets, parsePairs, duplicateIds, memberConflicts } from "./input";

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
