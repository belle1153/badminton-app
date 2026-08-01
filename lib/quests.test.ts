import { describe, it, expect } from "vitest";
import {
  evaluateQuest,
  activeQuests,
  startedQuests,
  visibleQuests,
  overlappingQuests,
  questStatus,
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
  signupPlaces: [],
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

describe("fastest-signup-daily — one definition, many payouts", () => {
  const q = quest({ kind: "fastest-signup-daily", target: 10, expReward: 200 });

  it("pays the reward once for every day the player placed", () => {
    // Signed up on five days, inside the top 10 on three of them.
    const p = evaluateQuest(q, facts({ signupPlaces: [1, 4, 11, 9, 15] }), []);
    expect(p.completed).toBe(true);
    expect(p.current).toBe(3);
    expect(p.earnedExp).toBe(600);
    expect(p.progressLabel).toBe("ติดอันดับ 3 วัน");
  });

  it("pays nothing when they never made the cut", () => {
    const p = evaluateQuest(q, facts({ signupPlaces: [11, 20] }), []);
    expect(p.completed).toBe(false);
    expect(p.earnedExp).toBe(0);
  });

  it("keeps growing as more days are added — this is the point of the rule", () => {
    const once = evaluateQuest(q, facts({ signupPlaces: [1] }), []).earnedExp;
    const twice = evaluateQuest(q, facts({ signupPlaces: [1, 2] }), []).earnedExp;
    expect(twice).toBe(once * 2);
  });

  it("draws no progress bar — the count has no ceiling to fill", () => {
    expect(evaluateQuest(q, facts({ signupPlaces: [1] }), []).target).toBeNull();
  });

  it("never completes when the admin left the placing empty", () => {
    const noTarget = quest({ kind: "fastest-signup-daily", target: null });
    const p = evaluateQuest(noTarget, facts({ signupPlaces: [1, 2, 3] }), []);
    expect(p.completed).toBe(false);
    expect(p.earnedExp).toBe(0);
  });

  it("differs from the once-only rule on the same facts", () => {
    // The bug that prompted this: a month-long "top 10 each day" quest paid out
    // once and then went dead for the rest of the window.
    const daily = evaluateQuest(q, facts({ signupPlaces: [1, 2, 3] }), []);
    const once = evaluateQuest(
      quest({ kind: "fastest-signup", target: 10, expReward: 200 }),
      facts({ signupPlaces: [1, 2, 3], bestSignupPlace: 1 }),
      []
    );
    expect(once.earnedExp).toBe(200);
    expect(daily.earnedExp).toBe(600);
  });
});

describe("earnedExp on the once-only rules", () => {
  it("is the full reward when complete and nothing when not", () => {
    const q = quest({ kind: "days-played", target: 2, expReward: 150 });
    expect(evaluateQuest(q, facts({ daysPlayed: [d("2026-08-01")] }), []).earnedExp).toBe(0);
    expect(
      evaluateQuest(q, facts({ daysPlayed: [d("2026-08-01"), d("2026-08-03")] }), []).earnedExp
    ).toBe(150);
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

describe("startedQuests — EXP already earned is never taken back", () => {
  const list = [
    quest({ id: "ended", startDate: d("2026-07-26"), endDate: d("2026-07-31") }),
    quest({ id: "running", startDate: d("2026-07-31"), endDate: d("2026-08-31") }),
    quest({ id: "upcoming", startDate: d("2026-09-01"), endDate: d("2026-10-01") }),
    quest({ id: "disabled", startDate: d("2026-07-01"), endDate: d("2026-08-01"), active: false }),
  ];
  const now = d("2026-07-31");

  it("includes quests whose window has closed", () => {
    // First bug this exists for: EXP was counted from activeQuests, so the
    // moment a quest's window shut, the reward a player had already earned
    // vanished from their total — and could drop their level.
    expect(startedQuests(list, now).map((q) => q.id)).toContain("ended");
  });

  it("includes quests the admin switched off", () => {
    // Second bug, same symptom: `active` is a visibility flag. Switching an old
    // quest off to tidy the admin list must not claw EXP back off the club.
    // Deleting the quest is what cancels it.
    expect(startedQuests(list, now).map((q) => q.id)).toContain("disabled");
  });

  it("still excludes quests that have not begun", () => {
    expect(startedQuests(list, now).map((q) => q.id)).not.toContain("upcoming");
  });

  it("is a superset of activeQuests", () => {
    const active = activeQuests(list, now).map((q) => q.id);
    const started = startedQuests(list, now).map((q) => q.id);
    for (const id of active) expect(started).toContain(id);
  });
});

describe("visibleQuests", () => {
  it("hides switched-off quests from the player's list", () => {
    const scored = [quest({ id: "shown" }), quest({ id: "hidden", active: false })];
    expect(visibleQuests(scored).map((q) => q.id)).toEqual(["shown"]);
  });

  it("is display-only — it must never be what EXP is summed over", () => {
    // The pairing the profile relies on: score everything started, render only
    // the visible subset.
    const scored = startedQuests(
      [
        quest({ id: "hidden", startDate: d("2026-07-01"), endDate: d("2026-08-01"), active: false }),
        quest({ id: "shown", startDate: d("2026-07-01"), endDate: d("2026-08-01") }),
      ],
      d("2026-07-31")
    );
    expect(scored).toHaveLength(2);
    expect(visibleQuests(scored)).toHaveLength(1);
  });
});

describe("overlappingQuests — guarding against a double payout", () => {
  const aug = quest({ id: "aug", startDate: d("2026-08-01"), endDate: d("2026-09-01") });
  const sep = quest({ id: "sep", startDate: d("2026-09-01"), endDate: d("2026-10-01") });
  const week = quest({ id: "week", startDate: d("2026-08-10"), endDate: d("2026-08-17") });
  const list = [aug, sep, week];

  it("finds a quest the new window sits inside", () => {
    const hits = overlappingQuests(list, d("2026-08-05"), d("2026-08-08"));
    expect(hits.map((q) => q.id)).toEqual(["aug"]);
  });

  it("finds every quest a long window crosses", () => {
    const hits = overlappingQuests(list, d("2026-08-01"), d("2026-09-15"));
    expect(hits.map((q) => q.id).sort()).toEqual(["aug", "sep", "week"]);
  });

  it("does not flag months that merely touch — ends are exclusive", () => {
    // 1 Sep is aug's exclusive end and sep's inclusive start; tiling months are
    // the normal case and must not look like a clash.
    expect(overlappingQuests([aug], d("2026-09-01"), d("2026-10-01"))).toEqual([]);
    expect(overlappingQuests([sep], d("2026-08-01"), d("2026-09-01"))).toEqual([]);
  });

  it("ignores the quest being edited, which always overlaps itself", () => {
    expect(overlappingQuests(list, d("2026-08-01"), d("2026-09-01"), "aug").map((q) => q.id)).toEqual(
      ["week"]
    );
  });

  it("returns nothing when the window is clear", () => {
    expect(overlappingQuests(list, d("2026-06-01"), d("2026-07-01"))).toEqual([]);
  });
});

describe("questStatus", () => {
  const q = quest({ startDate: d("2026-08-01"), endDate: d("2026-09-01") });

  it("reports the window's state around its edges", () => {
    expect(questStatus(q, d("2026-07-31"))).toBe("upcoming");
    expect(questStatus(q, d("2026-08-01"))).toBe("active");
    expect(questStatus(q, d("2026-08-31"))).toBe("active");
    expect(questStatus(q, d("2026-09-01"))).toBe("ended"); // endDate is exclusive
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
        facts({
          daysPlayed: [d("2026-08-01")],
          gamesPlayed: 5,
          checkinDays: 2,
          bestSignupPlace: 1,
          signupPlaces: [1],
        }),
        [d("2026-08-01")]
      );
      expect(p.completed).toBe(true);
      // Winnable also means it actually pays — a rule that completes for 0 EXP
      // would be just as useless as one nobody can finish.
      expect(p.earnedExp).toBeGreaterThan(0);
    }
  });
});
