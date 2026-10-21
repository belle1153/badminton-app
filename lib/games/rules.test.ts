import { describe, it, expect } from "vitest";
import {
  setsFromColumns,
  rubberOutcome,
  rubberPoints,
  knockoutSetOver,
  isValidKnockoutSet,
  validateResult,
  tieScore,
  lineupKeyed,
} from "./rules";
import { textOn } from "./color";

const cols = (sets: (number | null)[]) => ({
  set1A: sets[0] ?? null, set1B: sets[1] ?? null,
  set2A: sets[2] ?? null, set2B: sets[3] ?? null,
  set3A: sets[4] ?? null, set3B: sets[5] ?? null,
});

describe("setsFromColumns", () => {
  it("keeps consecutive sets where both scores are present", () => {
    expect(setsFromColumns(cols([21, 15, 18, 21]))).toEqual([[21, 15], [18, 21]]);
    expect(setsFromColumns(cols([21, 15, null, 21]))).toEqual([[21, 15]]);
    expect(setsFromColumns(cols([]))).toEqual([]);
  });
});

describe("rubberOutcome — qualifier (2 sets)", () => {
  it("splits sets 1–1 into a draw", () => {
    expect(rubberOutcome("QUALIFIER", [[21, 15], [18, 21]], true)).toBe("DRAW");
  });
  it("gives a 2–0 rubber to the side that won both sets", () => {
    expect(rubberOutcome("QUALIFIER", [[15, 21], [19, 21]], true)).toBe("B");
  });
  it("has no result until both sets are in", () => {
    expect(rubberOutcome("QUALIFIER", [[21, 15]], true)).toBe(null);
  });
  it("has no result until the rubber is finished", () => {
    expect(rubberOutcome("QUALIFIER", [[21, 15], [21, 18]], false)).toBe(null);
  });
  it("counts a level set for nobody", () => {
    expect(rubberOutcome("QUALIFIER", [[15, 15], [21, 18]], true)).toBe("A");
  });
});

describe("rubberOutcome — knockout (best of 3)", () => {
  it("goes to the first side with two sets", () => {
    expect(rubberOutcome("SEMI", [[21, 17], [18, 21], [21, 19]], true)).toBe("A");
  });
  it("has no result while neither side has two sets", () => {
    expect(rubberOutcome("FINAL", [[21, 17], [18, 21]], true)).toBe(null);
  });
});

describe("rubberPoints", () => {
  it("pays 2/1/0 in the qualifier", () => {
    expect(rubberPoints("QUALIFIER", "A")).toEqual([2, 0]);
    expect(rubberPoints("QUALIFIER", "DRAW")).toEqual([1, 1]);
    expect(rubberPoints("QUALIFIER", null)).toEqual([0, 0]);
  });
  it("pays 1/0 in the knockout", () => {
    expect(rubberPoints("FINAL", "B")).toEqual([0, 1]);
  });
});

describe("knockout set rule: 21, deuce at 20–20, cap 30", () => {
  it("ends a set at 21 with a two-point lead", () => {
    expect(knockoutSetOver(21, 19)).toBe(true);
    expect(knockoutSetOver(21, 20)).toBe(false);
    expect(knockoutSetOver(22, 20)).toBe(true);
  });
  it("ends at 30 whatever the lead", () => {
    expect(knockoutSetOver(30, 29)).toBe(true);
    expect(knockoutSetOver(29, 29)).toBe(false);
  });
  it("recognises a valid finished set", () => {
    expect(isValidKnockoutSet(21, 0)).toBe(true);
    expect(isValidKnockoutSet(23, 21)).toBe(true);
    expect(isValidKnockoutSet(30, 28)).toBe(true);
    expect(isValidKnockoutSet(30, 29)).toBe(true);
    expect(isValidKnockoutSet(21, 20)).toBe(false);
    expect(isValidKnockoutSet(25, 21)).toBe(false);
    expect(isValidKnockoutSet(15, 10)).toBe(false);
  });
});

describe("lineupKeyed", () => {
  it("is true only when both players of both pairs are keyed", () => {
    expect(lineupKeyed({ a1Id: "p1", a2Id: "p2", b1Id: "p3", b2Id: "p4" })).toBe(true);
    expect(lineupKeyed({ a1Id: "p1", a2Id: "p2", b1Id: "p3", b2Id: null })).toBe(false);
    expect(lineupKeyed({ a1Id: null, a2Id: null, b1Id: null, b2Id: null })).toBe(false);
  });
});

describe("validateResult", () => {
  it("refuses a qualifier result with one set", () => {
    expect(validateResult("QUALIFIER", [[21, 15]])).toEqual({
      ok: false,
      error: "รอบคัดเลือกต้องใส่แต้มครบ 2 เซต",
    });
  });
  it("accepts a qualifier result played to 21 without deuce, 21–20 included", () => {
    expect(validateResult("QUALIFIER", [[21, 9], [17, 21]])).toEqual({ ok: true, warnings: [] });
    expect(validateResult("QUALIFIER", [[21, 20], [20, 21]])).toEqual({ ok: true, warnings: [] });
  });
  it("saves a qualifier set that does not end at exactly 21 but warns", () => {
    expect(validateResult("QUALIFIER", [[22, 20], [18, 15]])).toEqual({
      ok: true,
      warnings: ["เซต 1 (22–20) ไม่ตรงกติกา 21 แต้มไม่มีดิวส์", "เซต 2 (18–15) ไม่ตรงกติกา 21 แต้มไม่มีดิวส์"],
    });
  });
  it("saves a level qualifier set but warns, since it counts for neither side", () => {
    expect(validateResult("QUALIFIER", [[21, 21], [21, 15]])).toEqual({
      ok: true,
      warnings: ["เซต 1 (21–21) แต้มเท่ากัน ไม่นับให้ฝั่งไหน"],
    });
  });
  it("refuses a knockout result with no side on two sets", () => {
    expect(validateResult("SEMI", [[21, 17], [18, 21]])).toEqual({
      ok: false,
      error: "รอบน็อกเอาต์ต้องมีฝั่งที่ชนะ 2 เซต",
    });
  });
  it("refuses a knockout third set after the rubber was already decided", () => {
    expect(validateResult("SEMI", [[21, 17], [21, 19], [21, 5]])).toEqual({
      ok: false,
      error: "จบ 2 เซตแล้ว ไม่ต้องมีเซต 3",
    });
  });
  it("saves an off-rule knockout set with a warning", () => {
    expect(validateResult("SEMI", [[21, 20], [21, 10]])).toEqual({
      ok: true,
      warnings: ["เซต 1 (21–20) ไม่ตรงกติกา 21 แต้ม"],
    });
  });
});

describe("tieScore", () => {
  it("decides a knockout tie at the third rubber won", () => {
    expect(tieScore("SEMI", ["A", "A", "B", "A", null])).toEqual({
      pointsA: 3, pointsB: 1, winner: "A", decidedAt: 4,
    });
  });
  it("adds up qualifier points with no winner", () => {
    expect(tieScore("QUALIFIER", ["A", "DRAW", "B", "B", "A"])).toEqual({
      pointsA: 5, pointsB: 5, winner: null, decidedAt: null,
    });
  });
});

describe("textOn — readable text over a team colour", () => {
  it("uses dark text on yellow and pink, white on blue and red", () => {
    expect(textOn("#facc15")).toBe("#0b1c30");
    expect(textOn("#f472b6")).toBe("#0b1c30");
    expect(textOn("#1d4ed8")).toBe("#ffffff");
    expect(textOn("#dc2626")).toBe("#ffffff");
  });
});
