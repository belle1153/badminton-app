import { describe, it, expect } from "vitest";
import { cardBonus, cardEffectText, cardProblem, type PlayedCard } from "./cards";
import type { RubberOutcome } from "./types";

const outcomes = (...o: RubberOutcome[]) => (order: number) => o[order - 1] ?? null;
const card = (side: "A" | "B", kind: PlayedCard["kind"], order: number): PlayedCard => ({ side, kind, order, swapWith: null });

describe("cardBonus", () => {
  it("DOUBLE DOWN adds 2 when that pair wins, nothing on a draw or a loss", () => {
    expect(cardBonus("QUALIFIER", [card("A", "DOUBLE_DOWN", 2)], outcomes("B", "A"))).toEqual([2, 0]);
    expect(cardBonus("QUALIFIER", [card("A", "DOUBLE_DOWN", 2)], outcomes("A", "DRAW"))).toEqual([0, 0]);
    expect(cardBonus("QUALIFIER", [card("A", "DOUBLE_DOWN", 2)], outcomes("A", "B"))).toEqual([0, 0]);
  });

  it("STEAL takes 1 from the opponent when that pair wins, nothing on a draw or a loss", () => {
    expect(cardBonus("QUALIFIER", [card("B", "STEAL", 1)], outcomes("B"))).toEqual([-1, 1]);
    expect(cardBonus("QUALIFIER", [card("B", "STEAL", 1)], outcomes("DRAW"))).toEqual([0, 0]);
    expect(cardBonus("QUALIFIER", [card("B", "STEAL", 1)], outcomes("A"))).toEqual([0, 0]);
  });

  it("adds up both teams' cards, and ignores an unfinished pair and SUBSTITUTION", () => {
    const cards = [card("A", "DOUBLE_DOWN", 1), card("B", "STEAL", 3), { side: "A" as const, kind: "SUBSTITUTION" as const, order: 4, swapWith: 5 }];
    expect(cardBonus("QUALIFIER", cards, outcomes("A", "A", "B", "A", null))).toEqual([1, 1]);
    expect(cardBonus("QUALIFIER", [card("A", "DOUBLE_DOWN", 5)], outcomes("A", "A", "A", "A", null))).toEqual([0, 0]);
  });

  it("gives nothing outside the qualifier", () => {
    expect(cardBonus("SEMI", [card("A", "DOUBLE_DOWN", 1)], outcomes("A"))).toEqual([0, 0]);
  });
});

describe("cardEffectText", () => {
  it("says what the card did once its pair has a result", () => {
    expect(cardEffectText(card("A", "DOUBLE_DOWN", 1), "A", "แดง", "เหลือง")).toBe("แดง +2");
    expect(cardEffectText(card("B", "STEAL", 1), "B", "แดง", "เหลือง")).toBe("เหลือง +1 · แดง −1");
    expect(cardEffectText(card("A", "DOUBLE_DOWN", 1), "DRAW", "แดง", "เหลือง")).toBe("แดง · ไม่มีผล");
    expect(cardEffectText(card("B", "STEAL", 2), "A", "แดง", "เหลือง")).toBe("เหลือง · ไม่มีผล");
    expect(cardEffectText({ side: "A", kind: "SUBSTITUTION", order: 1, swapWith: 3 }, "B", "แดง", "เหลือง")).toBe("แดง สลับคู่ 1 ↔ คู่ 3");
  });
});

describe("cardProblem", () => {
  const base = { stage: "QUALIFIER" as const, kind: "DOUBLE_DOWN" as const, order: 2, swapWith: null, usedElsewhere: [] };

  it("accepts a card the team still has", () => {
    expect(cardProblem(base)).toBe(null);
    expect(cardProblem({ ...base, kind: "SUBSTITUTION", order: 1, swapWith: 3 })).toBe(null);
  });

  it("refuses cards outside the qualifier", () => {
    expect(cardProblem({ ...base, stage: "SEMI" })).toBe("ใช้การ์ดได้เฉพาะรอบคัดเลือก");
  });

  it("needs a pair from 1 to 5, and two different pairs to swap", () => {
    expect(cardProblem({ ...base, order: 6 })).toBe("เลือกคู่ 1–5");
    expect(cardProblem({ ...base, kind: "SUBSTITUTION", order: 2, swapWith: 2 })).toBe("เลือก 2 คู่ที่จะสลับ (คนละคู่)");
    expect(cardProblem({ ...base, kind: "SUBSTITUTION", order: 2, swapWith: null })).toBe("เลือก 2 คู่ที่จะสลับ (คนละคู่)");
  });

  it("refuses a card the team already played in another round", () => {
    expect(cardProblem({ ...base, usedElsewhere: [{ kind: "DOUBLE_DOWN", label: "รอบ 2" }] })).toBe("ใช้การ์ด DOUBLE DOWN ไปแล้วในรอบ 2");
    expect(cardProblem({ ...base, kind: "STEAL", usedElsewhere: [{ kind: "DOUBLE_DOWN", label: "รอบ 2" }] })).toBe(null);
  });
});
