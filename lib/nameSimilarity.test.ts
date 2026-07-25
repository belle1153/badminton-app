import { describe, it, expect } from "vitest";
import { normalizeName, isSimilarName, findSimilarNames } from "./nameSimilarity";

describe("normalizeName", () => {
  it("ignores case, spaces and decorative punctuation", () => {
    expect(normalizeName("P’Note")).toBe("pnote");
    expect(normalizeName("P'Note")).toBe("pnote");
    expect(normalizeName("Tae (Kukkai)")).toBe("taekukkai");
    expect(normalizeName("  BANK-Thaioil ")).toBe("bankthaioil");
  });

  it("keeps Thai letters", () => {
    expect(normalizeName("พี่ เอียด")).toBe("พี่เอียด");
  });
});

describe("isSimilarName — the real duplicates this exists to catch", () => {
  it("flags P’Note against Note (the pair that actually split a player's history)", () => {
    expect(isSimilarName("P’Note", "Note")).toBe(true);
  });

  it("flags a name wrapped in brackets against the bare nickname", () => {
    expect(isSimilarName("Tae (Kukkai)", "KUKKAI")).toBe(true);
  });

  it("flags one-letter typos", () => {
    expect(isSimilarName("Bankki", "Bankkk")).toBe(true);
  });

  it("flags the same name spelled with different punctuation", () => {
    expect(isSimilarName("P'Note", "P’Note")).toBe(true);
  });
});

describe("isSimilarName — must NOT flag genuinely different people", () => {
  it("does not flag unrelated names", () => {
    expect(isSimilarName("Alex", "Dice")).toBe(false);
    expect(isSimilarName("BB", "NW")).toBe(false);
  });

  it("does not let very short names swallow longer ones", () => {
    // "T" inside "Tae"/"Toto" would flag half the roster.
    expect(isSimilarName("T", "Tae")).toBe(false);
    expect(isSimilarName("T", "Toto")).toBe(false);
  });

  it("keeps distinct short names apart", () => {
    expect(isSimilarName("BB", "Bus")).toBe(false);
    expect(isSimilarName("NK", "NW")).toBe(false);
  });

  it("does not flag names that merely share a prefix", () => {
    expect(isSimilarName("Ball", "Bankkk")).toBe(false);
  });

  it("ignores blank input", () => {
    expect(isSimilarName("", "Note")).toBe(false);
    expect(isSimilarName("  ", "Note")).toBe(false);
  });
});

describe("findSimilarNames", () => {
  const roster = [
    { id: "1", name: "Note" },
    { id: "2", name: "Alex" },
    { id: "3", name: "Bankki" },
    { id: "4", name: "Bankkk" },
  ];

  it("returns the close matches only", () => {
    expect(findSimilarNames("P’Note", roster).map((p) => p.name)).toEqual(["Note"]);
  });

  it("returns every close match when there are several", () => {
    expect(findSimilarNames("Bankki", roster).map((p) => p.name).sort()).toEqual([
      "Bankki",
      "Bankkk",
    ]);
  });

  it("puts an exact (normalized) match first", () => {
    const [first] = findSimilarNames("bankki", roster);
    expect(first.name).toBe("Bankki");
  });

  it("returns nothing for a genuinely new name", () => {
    expect(findSimilarNames("Somchai", roster)).toEqual([]);
  });

  it("respects the limit", () => {
    expect(findSimilarNames("Bankki", roster, 1)).toHaveLength(1);
  });
});
