import { describe, it, expect } from "vitest";
import { buildCostRows, sessionFees, sessionPrices, NO_SHOW_FEE, type CostAttendee } from "./costing";

const A = (
  id: string,
  gamesPlayed: number,
  opts: Partial<CostAttendee> = {}
): CostAttendee => ({
  id,
  name: id,
  timeSlot: "EARLY",
  checkedOutAt: new Date("2026-07-15T15:00:00.000Z"),
  gamesPlayed,
  ...opts,
});

const ENTRY = 95;
const GAME = 25;

describe("buildCostRows", () => {
  it("bills a flat entry fee plus the per-game fee", () => {
    const { rows } = buildCostRows([A("a", 4), A("b", 0)], ENTRY, GAME);
    const by = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(by.a.entryBaht).toBe(95);
    expect(by.a.gameBaht).toBe(100); // 4 × 25
    expect(by.a.totalBaht).toBe(195);
    // Played nothing but still owes the entry fee.
    expect(by.b.gameBaht).toBe(0);
    expect(by.b.totalBaht).toBe(95);
  });

  it("bills a confirmed no-show the flat fine only, not entry/game", () => {
    const { rows } = buildCostRows([A("came", 4), A("missed", 0, { noShow: true })], ENTRY, GAME);
    const by = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(by.missed.noShow).toBe(true);
    expect(by.missed.entryBaht).toBe(0);
    expect(by.missed.gameBaht).toBe(0);
    expect(by.missed.totalBaht).toBe(NO_SHOW_FEE);
  });

  it("groups no-shows first, then 1 ทุ่ม before 2 ทุ่ม, then by name", () => {
    const { rows } = buildCostRows(
      [
        A("Zoe", 1, { timeSlot: "EARLY" }),
        A("Ann", 1, { timeSlot: "LATE" }),
        A("Bob", 1, { timeSlot: "EARLY" }),
        A("Gus", 0, { noShow: true }),
      ],
      ENTRY,
      GAME
    );
    expect(rows.map((r) => r.name)).toEqual(["Gus", "Bob", "Zoe", "Ann"]);
  });

  it("marks someone still on court as live (game count can still grow)", () => {
    const { rows } = buildCostRows([A("a", 2, { checkedOutAt: null })], ENTRY, GAME);
    expect(rows[0].live).toBe(true);
  });

  it("passes the paid flag through", () => {
    const { rows } = buildCostRows([A("a", 1, { paid: true }), A("b", 1)], ENTRY, GAME);
    const by = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(by.a.paid).toBe(true);
    expect(by.b.paid).toBe(false);
  });

  it("shows the slot start time from the block they played", () => {
    const { rows } = buildCostRows([A("a", 1, { timeSlot: "EARLY" }), A("b", 1, { timeSlot: "LATE" })], ENTRY, GAME);
    const by = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(by.a.slot).toBe("19.00");
    expect(by.b.slot).toBe("20.00");
  });
});

describe("sessionFees", () => {
  const settings = { entryFee: 95, gameFee: 25 };

  it("uses the club's current settings for an open day", () => {
    const s = { status: "OPEN", entryFee: null, gameFee: null };
    expect(sessionFees(s, settings)).toEqual({ entryFee: 95, gameFee: 25 });
  });

  it("reads back the frozen fees on a closed day, not the current ones", () => {
    const s = { status: "CLOSED", entryFee: 80, gameFee: 20 };
    expect(sessionFees(s, { entryFee: 95, gameFee: 25 })).toEqual({ entryFee: 80, gameFee: 20 });
  });

  it("falls back to 0 when there are no settings and nothing frozen", () => {
    expect(sessionFees({ status: "OPEN", entryFee: null, gameFee: null }, null)).toEqual({
      entryFee: 0,
      gameFee: 0,
    });
  });
});

describe("sessionPrices", () => {
  const rates = [
    { id: "r1", pricePerHour: 200 },
    { id: "r2", pricePerHour: 250 },
  ];
  const balls = [
    { id: "b1", pricePerPiece: 20 },
    { id: "b2", pricePerPiece: 25 },
  ];

  it("bills the day's chosen rate and ball, not the first in the master list", () => {
    expect(sessionPrices({ courtRateId: "r2", shuttlecockTypeId: "b2" }, rates, balls)).toEqual({
      rate: 250,
      ballPrice: 25,
    });
  });

  it("falls back to the first entry when the day never picked one", () => {
    expect(sessionPrices({ courtRateId: null, shuttlecockTypeId: null }, rates, balls)).toEqual({
      rate: 200,
      ballPrice: 20,
    });
  });

  it("is 0 rather than crashing when the master list is empty", () => {
    expect(sessionPrices({ courtRateId: null, shuttlecockTypeId: null }, [], [])).toEqual({
      rate: 0,
      ballPrice: 0,
    });
  });
});
