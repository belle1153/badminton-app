import { describe, it, expect } from "vitest";
import { courtsNowNext } from "./courts";

// One qualifier tie on courts 1–2 starting 15:00 (900), 20-minute rubbers,
// followed by the next round's tie on the same courts at 16:00 (960).
const base = [
  { id: "r1", court: 1, order: 1, startMinute: 900 },
  { id: "r2", court: 2, order: 2, startMinute: 900 },
  { id: "r3", court: 1, order: 3, startMinute: 920 },
  { id: "r4", court: 2, order: 4, startMinute: 920 },
  { id: "r5", court: 1, order: 5, startMinute: 940 },
  { id: "n1", court: 1, order: 1, startMinute: 960 },
  { id: "n2", court: 2, order: 2, startMinute: 960 },
].map((r) => ({ ...r, finished: false, cancelled: false }));

const withFinished = (ids: string[]) => base.map((r) => ({ ...r, finished: ids.includes(r.id) }));

describe("courtsNowNext", () => {
  it("puts the first rubber without a result on court, the one after it next", () => {
    const courts = courtsNowNext(withFinished(["r1", "r2"]), 925);
    expect(courts).toEqual([
      { court: 1, nowId: "r3", nowStarted: true, nextId: "r5" },
      { court: 2, nowId: "r4", nowStarted: true, nextId: "n2" },
    ]);
  });

  it("moves on the moment a result is keyed", () => {
    expect(courtsNowNext(withFinished(["r1", "r2", "r3"]), 925)[0]).toMatchObject({ nowId: "r5", nextId: "n1" });
  });

  it("marks a rubber whose time has not come yet as not started", () => {
    expect(courtsNowNext(withFinished([]), 890)[0]).toMatchObject({ nowId: "r1", nowStarted: false });
  });

  it("skips cancelled knockout rubbers", () => {
    const rows = base.map((r) => ({ ...r, finished: r.id === "r1", cancelled: r.id === "r3" }));
    expect(courtsNowNext(rows, 925)[0]).toMatchObject({ nowId: "r5", nextId: "n1" });
  });

  it("leaves a court empty once everything on it is done", () => {
    const rows = base.map((r) => ({ ...r, finished: true }));
    expect(courtsNowNext(rows, 1000)[0]).toEqual({ court: 1, nowId: null, nowStarted: false, nextId: null });
  });
});
