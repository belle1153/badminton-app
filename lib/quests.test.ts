import { describe, it, expect } from "vitest";
import {
  evaluateQuest,
  activeQuests,
  inRange,
  QUEST_KINDS,
  type QuestDef,
  type QuestPlayerFacts,
} from "./quests";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const quest = (over: Partial<QuestDef> = {}): QuestDef => ({
  id: "q1",
  title: "เหรียญสิงหา",
  kind: "perfect-attendance",
  icon: "🎯",
  startDate: d("2026-08-01"),
  endDate: d("2026-09-01"),
  target: null,
  expReward: 200,
  active: true,
  ...over,
});

const facts = (over: Partial<QuestPlayerFacts> = {}): QuestPlayerFacts => ({
  daysPlayed: [],
  gamesPlayed: 0,
  checkinDays: 0,
  bestSignupPlace: null,
  ...over,
});

describe("inRange", () => {
  it("includes the start date and excludes the end date", () => {
    const q = quest();
    expect(inRange(d("2026-08-01"), q)).toBe(true);
    expect(inRange(d("2026-08-31"), q)).toBe(true);
    expect(inRange(d("2026-09-01"), q)).toBe(false);
    expect(inRange(d("2026-07-31"), q)).toBe(false);
  });

  it("lets consecutive months tile without double-counting a day", () => {
    const aug = quest({ startDate: d("2026-08-01"), endDate: d("2026-09-01") });
    const sep = quest({ startDate: d("2026-09-01"), endDate: d("2026-10-01") });
    const boundary = d("2026-09-01");
    expect(inRange(boundary, aug)).toBe(false);
    expect(inRange(boundary, sep)).toBe(true);
  });
});

describe("perfect-attendance", () => {
  const clubDays = [d("2026-08-03"), d("2026-08-05"), d("2026-08-10")];

  it("completes only when every club day was played", () => {
    const all = evaluateQuest(quest(), facts({ daysPlayed: clubDays }), clubDays);
    expect(all.completed).toBe(true);
    expect(all.progressLabel).toBe("3/3");
  });

  it("does not complete when one day was missed", () => {
    const p = evaluateQuest(
      quest(),
      facts({ daysPlayed: [clubDays[0], clubDays[2]] }),
      clubDays
    );
    expect(p.completed).toBe(false);
    expect(p.progressLabel).toBe("2/3");
  });

  it("is measured against club days, so a week the club skipped costs nobody", () => {
    // The player attended both days the club actually ran; the gap between them
    // is irrelevant.
    const sparse = [d("2026-08-03"), d("2026-08-24")];
    expect(evaluateQuest(quest(), facts({ daysPlayed: sparse }), sparse).completed).toBe(true);
  });

  it("nobody completes a window the club has not played yet", () => {
    const p = evaluateQuest(quest(), facts(), []);
    expect(p.completed).toBe(false);
  });
});

describe("days-played / games-played", () => {
  it("completes at the target, not before", () => {
    const q = quest({ kind: "days-played", target: 3 });
    expect(evaluateQuest(q, facts({ daysPlayed: [d("2026-08-01"), d("2026-08-03")] }), []).completed).toBe(false);
    expect(
      evaluateQuest(q, facts({ daysPlayed: [d("2026-08-01"), d("2026-08-03"), d("2026-08-05")] }), [])
        .completed
    ).toBe(true);
  });

  it("counts games for games-played", () => {
    const q = quest({ kind: "games-played", target: 20 });
    expect(evaluateQuest(q, facts({ gamesPlayed: 19 }), []).progressLabel).toBe("19/20");
    expect(evaluateQuest(q, facts({ gamesPlayed: 20 }), []).completed).toBe(true);
  });

  it("never completes when the admin left the target empty", () => {
    const q = quest({ kind: "days-played", target: null });
    expect(evaluateQuest(q, facts({ daysPlayed: [d("2026-08-01")] }), []).completed).toBe(false);
  });
});

describe("fastest-signup", () => {
  const q = quest({ kind: "fastest-signup", target: 3 });

  it("completes when the player placed within the target", () => {
    expect(evaluateQuest(q, facts({ bestSignupPlace: 1 }), []).completed).toBe(true);
    expect(evaluateQuest(q, facts({ bestSignupPlace: 3 }), []).completed).toBe(true);
  });

  it("does not complete on a worse placing", () => {
    expect(evaluateQuest(q, facts({ bestSignupPlace: 4 }), []).completed).toBe(false);
  });

  it("handles a player who never placed", () => {
    const p = evaluateQuest(q, facts({ bestSignupPlace: null }), []);
    expect(p.completed).toBe(false);
    expect(p.progressLabel).toBe("ยังไม่ติดอันดับ");
  });
});

describe("unknown kinds", () => {
  it("never marks anyone complete", () => {
    const p = evaluateQuest(quest({ kind: "retired-rule" }), facts({ gamesPlayed: 999 }), []);
    expect(p.completed).toBe(false);
  });
});

describe("activeQuests", () => {
  it("keeps only active quests whose window covers now", () => {
    const list = [
      quest({ id: "past", startDate: d("2026-07-01"), endDate: d("2026-08-01") }),
      quest({ id: "now" }),
      quest({ id: "future", startDate: d("2026-09-01"), endDate: d("2026-10-01") }),
      quest({ id: "disabled", active: false }),
    ];
    expect(activeQuests(list, d("2026-08-15")).map((q) => q.id)).toEqual(["now"]);
  });
});

describe("QUEST_KINDS", () => {
  it("every rule evaluateQuest understands is offered to the admin", () => {
    const kinds = QUEST_KINDS.map((k) => k.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    // A kind the admin can pick but evaluateQuest ignores would be unwinnable.
    for (const k of kinds) {
      const p = evaluateQuest(
        quest({ kind: k, target: 1 }),
        facts({ daysPlayed: [d("2026-08-01")], gamesPlayed: 5, checkinDays: 2, bestSignupPlace: 1 }),
        [d("2026-08-01")]
      );
      expect(p.completed).toBe(true);
    }
  });
});
