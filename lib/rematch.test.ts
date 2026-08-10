import { describe, expect, it } from "vitest";
import { buildPairHistory, foursomeRepeats, pairKey } from "./rematch";

describe("pairKey", () => {
  it("is order-independent", () => {
    expect(pairKey("a", "b")).toBe(pairKey("b", "a"));
  });
});

describe("buildPairHistory", () => {
  it("counts partners and opponents from finished games", () => {
    const h = buildPairHistory([
      { team1: ["a", "b"], team2: ["c", "d"] },
      { team1: ["a", "b"], team2: ["e", "f"] },
    ]);
    expect(h.partner[pairKey("a", "b")]).toBe(2);
    expect(h.opponent[pairKey("a", "c")]).toBe(1);
    expect(h.partner[pairKey("a", "c")]).toBeUndefined();
  });

  it("is empty when nothing has been played", () => {
    expect(buildPairHistory([])).toEqual({ partner: {}, opponent: {} });
  });
});

describe("foursomeRepeats", () => {
  const history = buildPairHistory([
    { team1: ["a", "b"], team2: ["c", "d"] },
    { team1: ["a", "b"], team2: ["e", "f"] },
  ]);

  it("flags a repeated partnership with its count", () => {
    const r = foursomeRepeats(["a", "b"], ["x", "y"], history);
    expect(r.partners).toEqual([{ ids: ["a", "b"], count: 2 }]);
    expect(r.opponents).toEqual([]);
  });

  it("flags a repeated match-up", () => {
    const r = foursomeRepeats(["a", "x"], ["c", "y"], history);
    expect(r.partners).toEqual([]);
    expect(r.opponents).toEqual([{ ids: ["a", "c"], count: 1 }]);
  });

  it("says nothing about a fresh foursome", () => {
    const r = foursomeRepeats(["a", "c"], ["x", "y"], history);
    expect(r).toEqual({ partners: [], opponents: [] });
  });

  it("sorts the worst repeat first", () => {
    const h = buildPairHistory([
      { team1: ["a", "b"], team2: ["c", "d"] },
      { team1: ["a", "b"], team2: ["c", "d"] },
      { team1: ["a", "c"], team2: ["b", "d"] },
    ]);
    const r = foursomeRepeats(["a", "b"], ["c", "d"], h);
    expect(r.partners[0]).toEqual({ ids: ["a", "b"], count: 2 });
    // a and d met in all three games (twice as cd's opponents, once as bd's).
    expect(r.opponents[0]).toEqual({ ids: ["a", "d"], count: 3 });
  });
});
