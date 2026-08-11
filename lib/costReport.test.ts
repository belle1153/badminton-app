import { describe, expect, it } from "vitest";
import {
  costAttendees,
  finishedGameCount,
  toExportRows,
  xlsxFileName,
  xlsxSheetRows,
  type CostSignUpLike,
} from "./costReport";
import { type CostRow } from "./costing";

const slot = (matchId: string, finished: boolean) => ({
  matchId,
  match: { finishedAt: finished ? new Date() : null },
});

const signUp = (over: Partial<CostSignUpLike>): CostSignUpLike => ({
  id: "s1",
  name: "Alex",
  timeSlot: "EARLY",
  checkedInAt: new Date(),
  checkedOutAt: null,
  matchSlots: [],
  ...over,
});

describe("costAttendees", () => {
  it("counts only finished games", () => {
    const [a] = costAttendees([signUp({ matchSlots: [slot("m1", true), slot("m2", false)] })]);
    expect(a.gamesPlayed).toBe(1);
  });

  it("marks someone with no check-in and no checkout as a no-show", () => {
    const [a] = costAttendees([signUp({ checkedInAt: null })]);
    expect(a.noShow).toBe(true);
  });

  it("does not call a checked-out player a no-show", () => {
    const [a] = costAttendees([signUp({ checkedInAt: null, checkedOutAt: new Date() })]);
    expect(a.noShow).toBe(false);
  });
});

describe("finishedGameCount", () => {
  it("counts each game once no matter how many players were in it", () => {
    const players = [
      signUp({ id: "a", matchSlots: [slot("m1", true), slot("m2", true)] }),
      signUp({ id: "b", matchSlots: [slot("m1", true)] }),
      signUp({ id: "c", matchSlots: [slot("m3", false)] }),
    ];
    expect(finishedGameCount(players)).toBe(2);
  });
});

const row = (over: Partial<CostRow>): CostRow => ({
  id: "x",
  name: "Alex",
  slot: "19.00",
  timeSlot: "EARLY",
  out: null,
  hours: 2,
  games: 3,
  courtBaht: 66,
  ballShareBaht: 73.5,
  totalBaht: 140,
  live: false,
  noShow: false,
  ...over,
});

describe("toExportRows", () => {
  it("tags a no-show in the name and the checkout column", () => {
    const [r] = toExportRows([row({ noShow: true, hours: null })]);
    expect(r.name).toBe("Alex (ไม่มา)");
    expect(r.out).toBe("ไม่มา");
    expect(r.hours).toBe("—");
  });

  it("says ยังเล่นอยู่ for someone still on court", () => {
    expect(toExportRows([row({ live: true })])[0].out).toBe("ยังเล่นอยู่");
  });
});

describe("xlsxSheetRows", () => {
  const sheet = xlsxSheetRows(toExportRows([row({}), row({ totalBaht: 100, games: 1 })]));

  it("is header + body + totals", () => {
    expect(sheet).toHaveLength(4);
    expect(sheet[0][0]).toBe("ชื่อ");
  });

  it("sums the money columns on the last row", () => {
    expect(sheet[3][0]).toBe("รวม 2 คน");
    expect(sheet[3][4]).toBe(4); // games
    expect(sheet[3][7]).toBe(240); // total baht
  });
});

describe("xlsxFileName", () => {
  it("keeps Thai, drops punctuation, and stamps the time", () => {
    const name = xlsxFileName("แหลมฉบัง", "วันจันทร์ที่ 3 สิงหาคม 2569", new Date(2026, 7, 3, 9, 5, 7));
    expect(name).toMatch(/^cost-.+-090507\.xlsx$/);
    expect(name).toContain("แหลมฉบัง");
    expect(name).not.toContain(" ");
  });
});
