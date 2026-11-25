import { describe, expect, it } from "vitest";
import {
  isStandardStart,
  normalizeStartTime,
  parseStartTime,
  slotClock,
  slotLabel,
  slotStartAt,
} from "./sessionTime";
import { activeCourtCount, blockStart } from "./billing";
import { buildCostRows } from "./costing";

const day = new Date("2026-12-09T00:00:00.000Z"); // UTC midnight of the ICT play day

describe("start time parsing", () => {
  it("reads the ways an admin writes a time", () => {
    expect(parseStartTime("19:00")).toBe(19 * 60);
    expect(parseStartTime("19.30")).toBe(19 * 60 + 30);
    expect(parseStartTime("7:05")).toBe(7 * 60 + 5);
    expect(parseStartTime("20:00 น.")).toBe(20 * 60);
    expect(parseStartTime("25:00")).toBeNull();
    expect(parseStartTime("")).toBeNull();
    expect(normalizeStartTime("9.5")).toBeNull();
    expect(normalizeStartTime("7:05")).toBe("07:05");
  });
});

describe("a usual 19:00 day is unchanged", () => {
  it("names a 19:00 day by clock time too, 19:00 น. / 20:00 น.", () => {
    expect(isStandardStart("19:00")).toBe(true);
    expect(slotLabel("19:00", "EARLY")).toBe("19:00 น.");
    expect(slotLabel("19:00", "LATE")).toBe("20:00 น.");
    expect(slotClock("19:00", "EARLY")).toBe("19.00");
    expect(slotClock("19:00", "LATE")).toBe("20.00");
  });

  it("starts the blocks at 19:00 and 20:00 ICT, as before", () => {
    expect(blockStart(day, "EARLY", "19:00").toISOString()).toBe("2026-12-09T12:00:00.000Z");
    expect(blockStart(day, "LATE", "19:00").toISOString()).toBe("2026-12-09T13:00:00.000Z");
    // Callers that don't know the start time still get 19:00.
    expect(blockStart(day, "EARLY").toISOString()).toBe("2026-12-09T12:00:00.000Z");
  });
});

describe("a day that starts at 19:30", () => {
  it("names the blocks by their clock time, the second an hour later", () => {
    expect(slotLabel("19:30", "EARLY")).toBe("19:30 น.");
    expect(slotLabel("19:30", "LATE")).toBe("20:30 น.");
    expect(slotClock("19:30", "LATE")).toBe("20.30");
    expect(slotStartAt(day, "19:30", "EARLY").toISOString()).toBe("2026-12-09T12:30:00.000Z");
    expect(slotStartAt(day, "19:30", "LATE").toISOString()).toBe("2026-12-09T13:30:00.000Z");
  });

  it("opens the second block's courts at 20:30, not 20:00", () => {
    const s = { courtsEarly: 2, courtsLate: 4, date: day, lateOpenedAt: null, startTime: "19:30" };
    expect(activeCourtCount(s, new Date("2026-12-09T13:15:00.000Z"))).toBe(2); // 20:15
    expect(activeCourtCount(s, new Date("2026-12-09T13:30:00.000Z"))).toBe(4); // 20:30
  });

  it("shows the real block start on the bill", () => {
    const { rows } = buildCostRows(
      [
        { id: "a", name: "A", timeSlot: "EARLY", gamesPlayed: 2, checkedOutAt: null },
        { id: "b", name: "B", timeSlot: "LATE", gamesPlayed: 1, checkedOutAt: null },
      ],
      95,
      25,
      "19:30"
    );
    expect(rows.map((r) => r.slot).sort()).toEqual(["19.30", "20.30"]);
  });
});
