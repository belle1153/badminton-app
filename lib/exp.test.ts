import { describe, it, expect } from "vitest";
import { computeExp, type DayPlayed } from "./exp";
import { computeStreaks, longestStreak } from "./streaks";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const day = (iso: string, over: Partial<DayPlayed> = {}): DayPlayed => ({
  date: d(iso),
  games: 0,
  wins: 0,
  partnerIds: [],
  ...over,
});

const CLUB = [d("2026-07-20"), d("2026-07-22"), d("2026-07-27"), d("2026-07-29")];

describe("computeStreaks — measured against the club's calendar", () => {
  it("counts consecutive club days", () => {
    expect(computeStreaks([d("2026-07-20"), d("2026-07-22")], CLUB)).toEqual([1, 2]);
  });

  it("a missed club day breaks the streak", () => {
    // played 20th and 27th, skipped the 22nd
    expect(computeStreaks([d("2026-07-20"), d("2026-07-27")], CLUB)).toEqual([1, 1]);
  });

  it("reports the best run, not the latest", () => {
    const dates = [d("2026-07-20"), d("2026-07-22"), d("2026-07-29")];
    expect(computeStreaks(dates, CLUB)).toEqual([1, 2, 1]);
    expect(longestStreak(dates, CLUB)).toBe(2);
  });

  it("no play days means no streak", () => {
    expect(longestStreak([], CLUB)).toBe(0);
  });
});

describe("computeExp — the point values", () => {
  it("awards 100 per day attended", () => {
    expect(computeExp([day("2026-07-20")], CLUB).attendance).toBe(100);
  });

  it("awards 20 per game and 10 per win", () => {
    const b = computeExp([day("2026-07-20", { games: 5, wins: 2 })], CLUB);
    expect(b.games).toBe(100);
    expect(b.wins).toBe(20);
  });

  it("pays nothing for checking out — only the admin can do that", () => {
    // The checkout endpoint is admin-only, so rewarding it would hand out EXP
    // for someone else's action.
    const b = computeExp([day("2026-07-20", { games: 5, wins: 2 })], CLUB);
    expect(b).not.toHaveProperty("checkouts");
    expect(b.total).toBe(220); // 100 attendance + 100 games + 20 wins, nothing else
  });

  it("totals every component", () => {
    const b = computeExp([day("2026-07-20", { games: 5, wins: 2 })], CLUB);
    expect(b.total).toBe(
      b.attendance + b.games + b.wins + b.streakBonus + b.newPartnerBonus + b.badges
    );
  });
});

describe("computeExp — badge EXP", () => {
  it("adds the badge total to the overall total", () => {
    const plain = computeExp([day("2026-07-20", { games: 5 })], CLUB);
    const withBadges = computeExp([day("2026-07-20", { games: 5 })], CLUB, 150);
    expect(withBadges.badges).toBe(150);
    expect(withBadges.total).toBe(plain.total + 150);
  });

  it("defaults to zero, so callers that don't pass badges are unaffected", () => {
    expect(computeExp([day("2026-07-20")], CLUB).badges).toBe(0);
  });

  it("leaves the play-derived components alone", () => {
    const b = computeExp([day("2026-07-20", { games: 5, wins: 2 })], CLUB, 500);
    expect(b.attendance).toBe(100);
    expect(b.games).toBe(100);
    expect(b.wins).toBe(20);
  });
});

describe("computeExp — streak bonus", () => {
  it("pays nothing on an isolated day", () => {
    expect(computeExp([day("2026-07-20")], CLUB).streakBonus).toBe(0);
  });

  it("pays 25 per extra consecutive day", () => {
    const b = computeExp([day("2026-07-20"), day("2026-07-22")], CLUB);
    expect(b.streakBonus).toBe(25);
  });

  it("caps the per-day bonus at 4 extra days", () => {
    const long = [
      d("2026-07-01"), d("2026-07-03"), d("2026-07-06"), d("2026-07-08"),
      d("2026-07-10"), d("2026-07-13"), d("2026-07-15"),
    ];
    const days = long.map((x) => day(x.toISOString().slice(0, 10)));
    const b = computeExp(days, long);
    // streaks are 1..7; bonus = 25 * min(streak-1, 4) = 0+25+50+75+100+100+100
    expect(b.streakBonus).toBe(450);
  });
});

describe("computeExp — new-partner bonus", () => {
  it("pays 15 for each first-time partner", () => {
    const b = computeExp([day("2026-07-20", { partnerIds: ["a", "b"] })], CLUB);
    expect(b.newPartnerBonus).toBe(30);
  });

  it("caps at 5 new partners per day", () => {
    const b = computeExp(
      [day("2026-07-20", { partnerIds: ["a", "b", "c", "d", "e", "f", "g"] })],
      CLUB
    );
    expect(b.newPartnerBonus).toBe(75);
  });

  it("does not pay again for someone already partnered with", () => {
    const b = computeExp(
      [day("2026-07-20", { partnerIds: ["a"] }), day("2026-07-22", { partnerIds: ["a"] })],
      CLUB
    );
    expect(b.newPartnerBonus).toBe(15);
  });
});

describe("computeExp — realistic shape", () => {
  it("a realistic single day stays under the level-2 threshold of 400", () => {
    // The heaviest real day observed was 6 games; assume every partner is new.
    const b = computeExp(
      [day("2026-07-20", { games: 6, wins: 3, partnerIds: ["a", "b", "c", "d", "e"] })],
      CLUB
    );
    expect(b.total).toBeLessThan(400);
  });

  it("coming back a second day clears level 2", () => {
    const oneDay = { games: 5, wins: 2, partnerIds: ["a", "b"] };
    const b = computeExp([day("2026-07-20", oneDay), day("2026-07-22", oneDay)], CLUB);
    expect(b.total).toBeGreaterThanOrEqual(400);
  });

  it("returns zeroes for a player who has never played", () => {
    expect(computeExp([], CLUB).total).toBe(0);
  });
});
