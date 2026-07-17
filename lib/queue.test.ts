import { describe, it, expect } from "vitest";
import { partitionFoursomes } from "./queue";
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
