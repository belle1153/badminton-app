import { describe, it, expect } from "vitest";
import { buildCostRows, sessionPrices, type CostAttendee } from "./costing";

const session = {
  date: new Date("2026-07-15T00:00:00.000Z"), // 19:00 ICT = 12:00 UTC
  courtsEarly: 2,
  courtsLate: 3,
  lateOpenedAt: null,
  openCourts: null,
};
/** UTC instant for an ICT hour on the session date. */
const ict = (h: number) => new Date(session.date.getTime() + (h - 7) * 3_600_000);

const A = (
  id: string,
  gamesPlayed: number,
  checkedOutAt: Date | null = ict(21),
  timeSlot: "EARLY" | "LATE" = "EARLY"
): CostAttendee => ({ id, name: id, timeSlot, checkedOutAt, gamesPlayed });

const RATE = 200;
const BALL = 20;
const FEE = 5;

describe("buildCostRows", () => {
  it("charges the ball share by games played — a quarter of a ball each", () => {
    const { rows } = buildCostRows(session, [A("a", 8), A("b", 2), A("c", 0), A("d", 4)], RATE, BALL, FEE, ict(21));
    const by = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(by.a.ballShareBaht).toBe(40); // 8/4 * 20
    expect(by.b.ballShareBaht).toBe(10); // 2/4 * 20 -> ceil
    expect(by.c.ballShareBaht).toBe(0); // played nothing, pays no ball
    expect(by.d.ballShareBaht).toBe(20);
  });

  it("does not tie the court share to games played", () => {
    const { rows } = buildCostRows(session, [A("a", 8), A("c", 0)], RATE, BALL, FEE, ict(21));
    const by = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(by.a.courtBaht).toBe(by.c.courtBaht); // same hours on court
  });

  it("folds the per-head fee into the court figure and never itemises it", () => {
    const { rows: withFee } = buildCostRows(session, [A("a", 4)], RATE, BALL, FEE, ict(21));
    const { rows: noFee } = buildCostRows(session, [A("a", 4)], RATE, BALL, 0, ict(21));
    expect(withFee[0].courtBaht).toBe(noFee[0].courtBaht + FEE);
    expect(withFee[0].totalBaht).toBe(withFee[0].courtBaht + withFee[0].ballShareBaht);
    expect(withFee[0]).not.toHaveProperty("feeBaht");
  });

  it("bills a minimum of 2 hours", () => {
    const { rows } = buildCostRows(session, [A("a", 0, ict(19.5))], RATE, BALL, 0, ict(21));
    expect(rows[0].hours).toBe(2);
  });

  it("rounds up in half-hour steps with a 15-minute grace", () => {
    const at = (h: number, m: number) => new Date(ict(h).getTime() + m * 60_000);
    const hoursFor = (out: Date) =>
      buildCostRows(session, [A("a", 0, out)], RATE, BALL, 0, ict(23)).rows[0].hours;
    expect(hoursFor(at(21, 15))).toBe(2); // within grace -> 21:00
    expect(hoursFor(at(21, 16))).toBe(2.5); // past grace -> 21:30
  });

  it("marks someone still on court as live, with hours not yet settled", () => {
    const { rows } = buildCostRows(session, [A("a", 2, null)], RATE, BALL, FEE, ict(21));
    expect(rows[0].live).toBe(true);
    expect(rows[0].hours).toBeNull();
  });

  it("splits a block's court cost among the people actually in it", () => {
    const alone = buildCostRows(session, [A("a", 0)], RATE, BALL, 0, ict(21)).rows[0].courtBaht;
    const shared = buildCostRows(session, [A("a", 0), A("b", 0)], RATE, BALL, 0, ict(21)).rows[0].courtBaht;
    expect(shared).toBeLessThan(alone);
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
    const p = sessionPrices({ courtRateId: "r2", shuttlecockTypeId: "b2" }, rates, balls);
    expect(p).toEqual({ rate: 250, ballPrice: 25 });
  });

  it("falls back to the first entry when the day never picked one", () => {
    const p = sessionPrices({ courtRateId: null, shuttlecockTypeId: null }, rates, balls);
    expect(p).toEqual({ rate: 200, ballPrice: 20 });
  });

  it("is 0 rather than crashing when the master list is empty", () => {
    expect(sessionPrices({ courtRateId: null, shuttlecockTypeId: null }, [], [])).toEqual({
      rate: 0,
      ballPrice: 0,
    });
  });
});
