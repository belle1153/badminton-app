import { describe, expect, it } from "vitest";
import { ictTodayMidnight, matchesWhen, parseWhen, weekStart } from "./lineWhen";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("parseWhen", () => {
  it("finds nothing in a bare keyword", () => {
    expect(parseWhen("สรุปค่าใช้จ่าย").specified).toBe(false);
  });

  it("reads a weekday", () => {
    expect(parseWhen("สรุปค่าใช้จ่ายวันจันทร์")).toMatchObject({ weekday: 1, day: null, specified: true });
  });

  it("reads a full date, day first", () => {
    expect(parseWhen("สรุปค่าใช้จ่ายวันที่ 10/08/2026")).toMatchObject({
      day: 10,
      month: 8,
      year: 2026,
    });
  });

  it("converts a Buddhist year", () => {
    expect(parseWhen("สรุปค่าใช้จ่าย 03/08/2569").year).toBe(2026);
  });

  it("reads weekday + date together", () => {
    expect(parseWhen("สรุปค่าใช้จ่ายวันจันทร์ที่ 10")).toMatchObject({
      weekday: 1,
      day: 10,
      month: null,
    });
  });

  it("ignores an out-of-range date", () => {
    expect(parseWhen("สรุปค่าใช้จ่าย 99").specified).toBe(false);
  });
});

describe("matchesWhen", () => {
  const monday = utc(2026, 8, 10); // a Monday

  it("matches on weekday alone", () => {
    expect(matchesWhen(monday, parseWhen("วันจันทร์"))).toBe(true);
    expect(matchesWhen(monday, parseWhen("วันพุธ"))).toBe(false);
  });

  it("matches a full date and rejects the wrong month", () => {
    expect(matchesWhen(monday, parseWhen("10/08/2026"))).toBe(true);
    expect(matchesWhen(monday, parseWhen("10/09/2026"))).toBe(false);
  });

  it("matches a bare date-of-month", () => {
    expect(matchesWhen(monday, parseWhen("วันจันทร์ที่ 10"))).toBe(true);
    expect(matchesWhen(utc(2026, 8, 3), parseWhen("วันจันทร์ที่ 10"))).toBe(false);
  });
});

describe("weekStart", () => {
  it("walks back to Monday", () => {
    expect(weekStart(utc(2026, 8, 13))).toEqual(utc(2026, 8, 10)); // Thu → Mon
    expect(weekStart(utc(2026, 8, 10))).toEqual(utc(2026, 8, 10)); // Mon → itself
  });

  it("treats Sunday as the end of its week, not the start", () => {
    expect(weekStart(utc(2026, 8, 16))).toEqual(utc(2026, 8, 10)); // Sun → that Mon
  });
});

describe("ictTodayMidnight", () => {
  it("rolls over at 00:00 Thailand time, not UTC", () => {
    // 2026-08-10 18:30 UTC = 2026-08-11 01:30 ICT → already the 11th in Thailand.
    expect(ictTodayMidnight(new Date("2026-08-10T18:30:00Z"))).toEqual(utc(2026, 8, 11));
  });
});
