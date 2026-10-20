import { describe, it, expect } from "vitest";
import { slotClock, ictNowMinute, ictDateKey } from "./clock";
import { buildSchedule, parseHHMM, tieLabel } from "./schedule";

const ties = buildSchedule([1, 2, 3, 4, 5, 6].map((seed) => ({ id: `t${seed}`, seed }))).map((t) => ({
  ...t,
  label: tieLabel(t.stage, t.round, t.slot),
}));
const minutes = { qualifier: 20, knockout: 30 };

describe("slotClock — the big-screen clock (informational only)", () => {
  it("names the round and pair slot and counts down to its end", () => {
    expect(slotClock(ties, minutes, parseHHMM("15:25"))).toEqual({ label: "รอบ 2 · ช่วงคู่ 3–4", remainingSec: 900 });
    expect(slotClock(ties, minutes, parseHHMM("14:45"))).toEqual({ label: "รอบ 1 · ช่วงคู่ 5", remainingSec: 900 });
    expect(slotClock(ties, minutes, parseHHMM("18:00"))).toEqual({ label: "รอบ 5 · ช่วงคู่ 1–2", remainingSec: 1200 });
  });

  it("counts down to the next tie between slots", () => {
    expect(slotClock(ties, minutes, parseHHMM("19:10"))).toEqual({ label: "ถัดไป: รองชนะเลิศ 1 19:30", remainingSec: 1200 });
    expect(slotClock(ties, minutes, parseHHMM("13:50"))).toEqual({ label: "ถัดไป: รอบ 1 14:00", remainingSec: 600 });
  });

  it("goes quiet after the final has started", () => {
    expect(slotClock(ties, minutes, parseHHMM("21:45"))).toBe(null);
  });
});

describe("ICT time helpers", () => {
  it("converts to minutes since midnight in Thailand", () => {
    expect(ictNowMinute(new Date("2026-11-01T08:25:30Z"))).toBe(15 * 60 + 25.5);
  });
  it("gives the Thai calendar date", () => {
    expect(ictDateKey(new Date("2026-11-01T18:30:00Z"))).toBe("2026-11-02");
  });
});
