import { describe, it, expect } from "vitest";
import { bestFillers, partitionFoursomes, planPendingAdditions } from "./queue";
import { balanceTeams, courtSkillCost, type Player, type SkillLevel } from "./matching";

const P = (id: string, skill: SkillLevel, partner: string | null = null): Player => ({
  id,
  name: id,
  skillLevel: skill,
  fixedPartnerId: partner,
});

const groupOf = (groups: Player[][], id: string) =>
  groups.findIndex((g) => g.some((p) => p.id === id));

const sameTeam = (four: Player[], a: string, b: string) => {
  const { team1, team2 } = balanceTeams(four);
  const inT1 = (id: string) => team1.some((p) => p.id === id);
  return inT1(a) === inT1(b);
};

/** 4 RK + 4 P, with one RK and one P locked together as a คู่ซ้อมแข่ง. */
const rkAndPWithLockedPair = () => [
  P("Ann", "RK", "Hank"),
  P("Ben", "RK"),
  P("Cal", "RK"),
  P("Dan", "RK"),
  P("Eve", "P"),
  P("Fay", "P"),
  P("Gus", "P"),
  P("Hank", "P", "Ann"),
];

describe("partitionFoursomes — fixed pairs (คู่ซ้อมแข่ง)", () => {
  it("never splits a pair, even when skill clustering would rather", () => {
    // Without a hard constraint the partition puts Ann with the RKs and Hank
    // with the Ps — this is the exact bug the club hit.
    const groups = partitionFoursomes(rkAndPWithLockedPair(), []);
    expect(groupOf(groups, "Ann")).toBe(groupOf(groups, "Hank"));
    expect(sameTeam(groups[groupOf(groups, "Ann")], "Ann", "Hank")).toBe(true);
  });

  it("holds two locked pairs at once", () => {
    const groups = partitionFoursomes(
      [
        P("A1", "RK", "A2"),
        P("A2", "P", "A1"),
        P("B1", "BG", "B2"),
        P("B2", "S", "B1"),
        P("c", "RK"),
        P("d", "RK"),
        P("e", "BG"),
        P("f", "BG"),
        P("g", "N"),
        P("h", "N"),
        P("i", "P"),
        P("j", "P"),
      ],
      []
    );
    expect(groupOf(groups, "A1")).toBe(groupOf(groups, "A2"));
    expect(groupOf(groups, "B1")).toBe(groupOf(groups, "B2"));
  });

  it("makes a pair wait together rather than sending half of it down", () => {
    // 6 waiting → only 4 can play. The pair must not be cut by that boundary.
    const groups = partitionFoursomes(
      [P("s1", "RK"), P("s2", "RK"), P("s3", "RK"), P("Pa", "N", "Pb"), P("Pb", "N", "Pa"), P("s4", "RK")],
      []
    );
    const queued = groups.flat().map((p) => p.id);
    expect(queued).toHaveLength(4);
    expect(queued.includes("Pa")).toBe(queued.includes("Pb"));
  });

  it("queue order changes nothing about balance (it only decides who plays first)", () => {
    // Which of three equally-skilled RKs joins the locked pair is a coin toss and
    // may differ with input order — but the resulting balance must not. Queue
    // position feeds the window cut and the play order, never the matchmaking.
    const base = rkAndPWithLockedPair();
    const shuffled = [...base].reverse();
    const totalCost = (gs: Player[][]) => gs.reduce((s, g) => s + courtSkillCost(g), 0);
    expect(totalCost(partitionFoursomes(shuffled, []))).toBe(totalCost(partitionFoursomes(base, [])));
  });

  it("keeps the pair together regardless of queue order", () => {
    const shuffled = [...rkAndPWithLockedPair()].reverse();
    const groups = partitionFoursomes(shuffled, []);
    expect(groupOf(groups, "Ann")).toBe(groupOf(groups, "Hank"));
  });
});

describe("partitionFoursomes — balance", () => {
  it("clusters by tier when nobody is locked", () => {
    const groups = partitionFoursomes(
      [
        P("a", "RK"), P("b", "RK"), P("c", "RK"), P("d", "RK"),
        P("e", "BG"), P("f", "BG"), P("g", "BG"), P("h", "BG"),
        P("i", "P"), P("j", "P"), P("k", "P"), P("l", "P"),
      ],
      []
    );
    expect(groups).toHaveLength(3);
    for (const g of groups) expect(courtSkillCost(g)).toBe(0);
  });

  it("queues whole foursomes only, leaving the remainder waiting", () => {
    const groups = partitionFoursomes(
      [P("a", "N"), P("b", "N"), P("c", "N"), P("d", "N"), P("e", "N"), P("f", "N")],
      []
    );
    expect(groups).toHaveLength(1);
    expect(groups.flat()).toHaveLength(4);
  });

  it("returns nothing when fewer than four are waiting", () => {
    expect(partitionFoursomes([P("a", "N"), P("b", "N"), P("c", "N")], [])).toEqual([]);
  });

  it("avoids replaying a foursome that just played together", () => {
    const players = [
      P("a", "N"), P("b", "N"), P("c", "N"), P("d", "N"),
      P("e", "N"), P("f", "N"), P("g", "N"), P("h", "N"),
    ];
    const justPlayed = new Set(["a", "b", "c", "d"]);
    const groups = partitionFoursomes(players, [justPlayed]);
    const repeated = groups.some((g) => g.filter((p) => justPlayed.has(p.id)).length > 2);
    expect(repeated).toBe(false);
  });

  it("does not reproduce the exact same foursome three rounds running (the club's report)", () => {
    // Same-tier pool so skill never forces a repeat; the only thing steering the
    // split is the repeat penalty. abcd played twice already — round 3 must differ.
    const pool = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => P(id, "N"));
    const abcd = new Set(["a", "b", "c", "d"]);
    const groups = partitionFoursomes(pool, [abcd, abcd]);
    const reran = groups.some((g) => g.every((p) => abcd.has(p.id)));
    expect(reran).toBe(false);
  });

  it("still tolerates a repeat when there's genuinely no alternative", () => {
    // Only four waiting — a rerun is unavoidable and must not be dropped.
    const pool = ["a", "b", "c", "d"].map((id) => P(id, "N"));
    const groups = partitionFoursomes(pool, [new Set(["a", "b", "c", "d"])]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(4);
  });

  it("won't force a wildly-lopsided court just to avoid a repeat", () => {
    // 4 RK + 4 P, and one RK foursome already played. Keeping tiers apart matters
    // more than the repeat: no court should mix RK with P.
    const pool = [
      ...["a", "b", "c", "d"].map((id) => P(id, "RK")),
      ...["e", "f", "g", "h"].map((id) => P(id, "P")),
    ];
    const groups = partitionFoursomes(pool, [new Set(["a", "b", "c", "d"])]);
    for (const g of groups) {
      const tiers = new Set(g.map((p) => p.skillLevel));
      expect(tiers.has("RK") && tiers.has("P")).toBe(false);
    }
  });
});

describe("planPendingAdditions — the four finishers must not lock back in together", () => {
  const four = ["a", "b", "c", "d"].map((id) => P(id, "N"));
  const played = new Set(["a", "b", "c", "d"]);

  it("holds an exact-rerun four back while other คู่เตรียม can feed the courts", () => {
    const plan = planPendingAdditions(four, [played], 2);
    expect(plan.toQueue).toEqual([]);
    expect(plan.leftover).toEqual([]); // held, not leftover — no earmark pair for them
  });

  it("re-queues them rather than leaving courts idle when no คู่เตรียม is left", () => {
    const plan = planPendingAdditions(four, [played], 0);
    expect(plan.toQueue).toHaveLength(1);
  });

  it("queues them when the admin forces it (explicit จัดคู่เตรียมจากคิว press)", () => {
    const plan = planPendingAdditions(four, [played], 2, true);
    expect(plan.toQueue).toHaveLength(1);
  });

  it("mixes two finished foursomes instead of re-queuing either intact", () => {
    const eight = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => P(id, "N"));
    const g1 = new Set(["a", "b", "c", "d"]);
    const g2 = new Set(["e", "f", "g", "h"]);
    const plan = planPendingAdditions(eight, [g1, g2], 1);
    expect(plan.toQueue).toHaveLength(2);
    for (const g of plan.toQueue) {
      expect(g.every((p) => g1.has(p.id))).toBe(false);
      expect(g.every((p) => g2.has(p.id))).toBe(false);
    }
  });

  it("still hands the sub-four tail to the earmark path as leftover", () => {
    const six = ["a", "b", "c", "d", "e", "f"].map((id) => P(id, "N"));
    const plan = planPendingAdditions(six, [], 0);
    expect(plan.toQueue).toHaveLength(1);
    expect(plan.leftover).toHaveLength(2);
  });
});

describe("planPendingAdditions — queue cap and the club's skill line", () => {
  it("queues only up to the given capacity; the rest wait (not leftover)", () => {
    const eight = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => P(id, "N"));
    const plan = planPendingAdditions(eight, [], 0, false, 1);
    expect(plan.toQueue).toHaveLength(1);
    expect(plan.leftover).toEqual([]); // capped-out players wait, no earmark pair
  });

  it("holds a court that crosses the club line (RK with S) for better company", () => {
    const mixed = [P("a", "RK"), P("b", "RK"), P("c", "S"), P("d", "S_PLUS")];
    const plan = planPendingAdditions(mixed, [], 1);
    expect(plan.toQueue).toEqual([]);
  });

  it("takes the bad mix anyway when the queue is empty — a game beats an idle court", () => {
    const mixed = [P("a", "RK"), P("b", "RK"), P("c", "S"), P("d", "S_PLUS")];
    expect(planPendingAdditions(mixed, [], 0).toQueue).toHaveLength(1);
  });

  it("lets a คู่ซ้อมแข่ง span tiers — that mix is the admin's own arrangement", () => {
    const withPair = [P("a", "RK", "b"), P("b", "P", "a"), P("c", "RK"), P("d", "P")];
    const plan = planPendingAdditions(withPair, [], 1);
    expect(plan.toQueue).toHaveLength(1);
  });
});

describe("bestFillers — never earmarks a court the club wouldn't arrange", () => {
  it("skips fillers that would cross the club line", () => {
    const base = [P("s", "S"), P("sp", "S_PLUS")];
    const candidates = [P("rk", "RK"), P("p", "P"), P("n", "N"), P("s2", "S")];
    const picked = bestFillers(base, candidates, 2, [], new Map());
    expect(picked).not.toBeNull();
    expect(picked!.some((x) => x.id === "rk")).toBe(false);
  });

  it("returns null (leave them waiting) when no sane filler exists", () => {
    const base = [P("rk", "RK")];
    const candidates = [P("s", "S"), P("sp", "S_PLUS"), P("p", "P")];
    expect(bestFillers(base, candidates, 3, [], new Map())).toBeNull();
  });
});
