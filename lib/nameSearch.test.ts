import { describe, it, expect } from "vitest";
import { rankNameMatches } from "./nameSearch";

const n = (name: string) => ({ name });

describe("rankNameMatches — the real bug: searching \"T\" never showed \"T\"", () => {
  // The exact 21 real names that matched a plain `contains "T"` query, with
  // take:10 cutting alphabetically right before the athlete named "T" (12th).
  const roster = [
    "Aof Thana", "Aoff Metas", "Bank (Thaioil)", "First", "Mam (Wut)", "Mint",
    "Note", "Oat (Jessada)", "Oatin", "Pang (Toto)", "R-Nont", "T",
    "Tae (Kukkai)", "Tam", "Tao", "Tao (Benxiz)", "Tiger", "Toey", "Toto",
    "Wut (Mam)", "Wut (Wan)",
  ].map(n);

  it("puts the exact match first, so it survives the take-10 limit", () => {
    const top10 = rankNameMatches("T", roster, 10);
    expect(top10.map((r) => r.name)).toContain("T");
    expect(top10[0].name).toBe("T");
  });

  it("is case-insensitive for the exact match too", () => {
    expect(rankNameMatches("t", roster, 10)[0].name).toBe("T");
  });
});

describe("rankNameMatches — tiering", () => {
  it("ranks exact, then prefix, then plain contains", () => {
    const candidates = [n("Banana"), n("Ban"), n("Urban")].reverse();
    const ranked = rankNameMatches("Ban", candidates);
    expect(ranked.map((r) => r.name)).toEqual(["Ban", "Banana", "Urban"]);
  });

  it("breaks ties within a tier alphabetically", () => {
    const candidates = [n("Toto"), n("Tao"), n("Tam")];
    const ranked = rankNameMatches("Ta", candidates); // all prefix matches
    expect(ranked.map((r) => r.name)).toEqual(["Tam", "Tao", "Toto"]);
  });

  it("respects the limit after ranking, not before", () => {
    const candidates = [n("Zt"), n("Yt"), n("T"), n("Xt")];
    expect(rankNameMatches("t", candidates, 2).map((r) => r.name)).toEqual([
      "T",
      "Xt", // first alphabetically among the remaining contains-matches
    ]);
  });

  it("does not mutate the input array", () => {
    const candidates = [n("B"), n("A")];
    const copy = [...candidates];
    rankNameMatches("a", candidates);
    expect(candidates).toEqual(copy);
  });
});
