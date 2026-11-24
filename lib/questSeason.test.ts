import { describe, expect, it } from "vitest";
import { questForSeason, scoreQuestExpBySeason } from "./questProgress";
import { SEASONS } from "./seasons";
import type { QuestDef } from "./quests";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const [S1, S2] = SEASONS;

const quest = (over: Partial<QuestDef> = {}): QuestDef => ({
  id: "q",
  title: "q",
  kind: "fastest-signup-daily",
  icon: "🎯",
  startDate: d("2026-11-23"),
  endDate: d("2026-12-07"),
  target: 3,
  expReward: 20,
  active: true,
  ...over,
});

/** A session on `date` where ME signed up first and played a finished game. */
const session = (date: string) => ({
  date: d(date),
  signUps: [
    {
      athleteId: "me",
      name: "me",
      addedByAdmin: false,
      checkedInAt: d(date),
      createdAt: new Date(d(date).getTime() - 2 * 86_400_000),
      matchSlots: [{ match: { finishedAt: d(date) } }],
    },
  ],
});

describe("questForSeason", () => {
  it("clips a per-day quest to each season", () => {
    expect(questForSeason(quest(), S1)).toMatchObject({ startDate: d("2026-11-23"), endDate: d("2026-11-30") });
    expect(questForSeason(quest(), S2)).toMatchObject({ startDate: d("2026-11-30"), endDate: d("2026-12-07") });
  });

  it("a quest wholly inside Season 1 is not in Season 2", () => {
    const q = quest({ startDate: d("2026-11-01"), endDate: d("2026-11-15") });
    expect(questForSeason(q, S2)).toBeNull();
    expect(questForSeason(q, S1)).toEqual(q);
  });

  it("a one-off quest crossing the boundary goes whole to the season it ends in", () => {
    const q = quest({ kind: "days-played", target: 2 });
    expect(questForSeason(q, S1)).toBeNull();
    expect(questForSeason(q, S2)).toEqual(q);
    const ends = quest({ kind: "days-played", startDate: d("2026-11-23"), endDate: d("2026-11-30") });
    expect(questForSeason(ends, S1)).toEqual(ends);
    expect(questForSeason(ends, S2)).toBeNull();
  });
});

describe("scoreQuestExpBySeason", () => {
  const now = new Date("2026-12-10T12:00:00+07:00");
  const sessions = [session("2026-11-25"), session("2026-12-02")];
  const club = [d("2026-11-25"), d("2026-12-02")];

  it("a per-day quest pays each half its own days", () => {
    const m = scoreQuestExpBySeason("me", [quest()], sessions, club, now);
    expect(m.get(1)).toBe(20);
    expect(m.get(2)).toBe(20);
  });

  it("a one-off quest needing days from both halves still completes, once, in Season 2", () => {
    const m = scoreQuestExpBySeason("me", [quest({ kind: "days-played", target: 2, expReward: 100 })], sessions, club, now);
    expect(m.get(1) ?? 0).toBe(0);
    expect(m.get(2)).toBe(100);
  });

  it("before Season 2 everything counts in Season 1", () => {
    const m = scoreQuestExpBySeason("me", [quest({ endDate: d("2026-11-28") })], [sessions[0]], [club[0]], new Date("2026-11-28T12:00:00+07:00"));
    expect(m.get(1)).toBe(20);
    expect(m.has(2)).toBe(false);
  });
});
