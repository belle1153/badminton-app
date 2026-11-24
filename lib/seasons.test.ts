import { describe, expect, it } from "vitest";
import { currentSeason, inSeason, SEASONS, seasonOf, SEASON_2_START } from "./seasons";

describe("seasons", () => {
  it("splits on 30 Nov 2026", () => {
    expect(seasonOf(new Date(Date.UTC(2026, 10, 29)))).toBe(1);
    expect(seasonOf(new Date(Date.UTC(2026, 10, 30)))).toBe(2);
    expect(SEASON_2_START.toISOString().slice(0, 10)).toBe("2026-11-30");
  });

  it("reads the current season on the Thai calendar day", () => {
    expect(currentSeason(new Date("2026-11-29T23:00:00+07:00")).id).toBe(1);
    expect(currentSeason(new Date("2026-11-30T00:01:00+07:00")).id).toBe(2);
  });

  it("labels and windows", () => {
    expect(SEASONS[0].label).toBe("Season 1");
    expect(SEASONS[1].label).toBe("Season 2");
    expect(inSeason(new Date(Date.UTC(2026, 0, 1)), SEASONS[0])).toBe(true);
    expect(inSeason(new Date(Date.UTC(2026, 11, 1)), SEASONS[0])).toBe(false);
    expect(inSeason(new Date(Date.UTC(2026, 11, 1)), SEASONS[1])).toBe(true);
  });
});
