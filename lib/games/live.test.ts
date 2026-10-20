import { describe, it, expect } from "vitest";
import { applyTap, closeSet } from "./live";

describe("applyTap — knockout live count (21, deuce, cap 30)", () => {
  it("closes the set at 21–19 and opens the next one", () => {
    expect(applyTap("SEMI", [[20, 19]], 1, "A", 1)).toEqual({ sets: [[21, 19], [0, 0]], liveSet: 2, rubberOver: false });
  });

  it("closes at 30 even on a one-point lead", () => {
    expect(applyTap("FINAL", [[29, 29]], 1, "B", 1)).toEqual({ sets: [[29, 30], [0, 0]], liveSet: 2, rubberOver: false });
  });

  it("keeps playing at 21–20", () => {
    expect(applyTap("SEMI", [[20, 20]], 1, "A", 1)).toEqual({ sets: [[21, 20]], liveSet: 1, rubberOver: false });
  });

  it("ends the rubber when a side takes its second set", () => {
    expect(applyTap("SEMI", [[21, 15], [20, 15]], 2, "A", 1)).toEqual({ sets: [[21, 15], [21, 15]], liveSet: 2, rubberOver: true });
  });

  it("starts the current set at 0–0 when it does not exist yet", () => {
    expect(applyTap("SEMI", [], 1, "B", 1)).toEqual({ sets: [[0, 1]], liveSet: 1, rubberOver: false });
  });
});

describe("applyTap — minus one", () => {
  it("never goes below zero", () => {
    expect(applyTap("SEMI", [[0, 3]], 1, "A", -1)).toEqual({ sets: [[0, 3]], liveSet: 1, rubberOver: false });
  });

  it("only touches the current set, never a closed one", () => {
    expect(applyTap("SEMI", [[21, 15], [4, 2]], 2, "A", -1)).toEqual({ sets: [[21, 15], [3, 2]], liveSet: 2, rubberOver: false });
  });
});

describe("qualifier live count (2 sets, ended by hand)", () => {
  it("does not close a set on points", () => {
    expect(applyTap("QUALIFIER", [[20, 15]], 1, "A", 1)).toEqual({ sets: [[21, 15]], liveSet: 1, rubberOver: false });
  });

  it("closes set 1 into set 2, then ends the rubber after set 2", () => {
    const first = closeSet([[18, 12]], 1);
    expect(first).toEqual({ sets: [[18, 12], [0, 0]], liveSet: 2, rubberOver: false });
    expect(closeSet([[18, 12], [9, 14]], 2)).toEqual({ sets: [[18, 12], [9, 14]], liveSet: 2, rubberOver: true });
  });
});
