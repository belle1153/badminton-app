import { describe, it, expect } from "vitest";
import { resolveKnockout } from "./knockout";
import type { StandingRow } from "./standings";
import type { Side, Stage } from "./types";

const standings = ["r1", "r2", "r3", "r4", "r5", "r6"].map(
  (teamId, i): StandingRow => ({
    teamId, rank: i + 1, points: 0, won: 0, drawn: 0, lost: 0,
    pointsFor: 0, pointsAgainst: 0, diff: 0, h2h: 0,
  })
);

function ko(semi1: Side | null = null, semi2: Side | null = null) {
  const t = (id: string, stage: Stage, slot: number, winner: Side | null = null) => ({
    id, stage, slot, winner, teamAId: null, teamBId: null,
  });
  return [t("s1", "SEMI", 1, semi1), t("s2", "SEMI", 2, semi2), t("f5", "FIFTH", 1), t("t3", "THIRD", 1), t("fi", "FINAL", 1)];
}

describe("resolveKnockout", () => {
  it("pairs 1 v 4, 2 v 3 and 5 v 6, marked projected until the qualifier is done", () => {
    const r = resolveKnockout(ko(), standings, false);
    expect(r.s1).toEqual({ teamAId: "r1", teamBId: "r4", projected: true });
    expect(r.s2).toEqual({ teamAId: "r2", teamBId: "r3", projected: true });
    expect(r.f5).toEqual({ teamAId: "r5", teamBId: "r6", projected: true });
    expect(resolveKnockout(ko(), standings, true).s1.projected).toBe(false);
  });

  it("leaves the final and third place open until the semis are decided", () => {
    const r = resolveKnockout(ko("A", null), standings, true);
    expect(r.fi).toEqual({ teamAId: "r1", teamBId: null, projected: false });
    expect(r.t3).toEqual({ teamAId: "r4", teamBId: null, projected: false });
  });

  it("sends semi winners to the final and losers to third place", () => {
    const r = resolveKnockout(ko("B", "A"), standings, true);
    expect(r.fi).toEqual({ teamAId: "r4", teamBId: "r2", projected: false });
    expect(r.t3).toEqual({ teamAId: "r1", teamBId: "r3", projected: false });
  });
});
