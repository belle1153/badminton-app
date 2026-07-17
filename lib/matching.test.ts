import { describe, it, expect } from "vitest";
import { balanceTeams, courtSkillCost, type Player, type SkillLevel } from "./matching";

const P = (id: string, skill: SkillLevel, partner: string | null = null): Player => ({
  id,
  name: id,
  skillLevel: skill,
  fixedPartnerId: partner,
});

const teamOf = (teams: { team1: Player[]; team2: Player[] }, id: string) =>
  teams.team1.some((p) => p.id === id) ? 1 : 2;

describe("balanceTeams", () => {
  it("keeps a mutual fixed pair (คู่ซ้อมแข่ง) on the same team, even at opposite skill ends", () => {
    const four = [P("Ann", "RK", "Hank"), P("Cal", "RK"), P("Dan", "RK"), P("Hank", "P", "Ann")];
    const teams = balanceTeams(four);
    expect(teamOf(teams, "Ann")).toBe(teamOf(teams, "Hank"));
  });

  it("ignores a one-sided fixedPartnerId — a pair must be mutual", () => {
    // Ann claims Hank, Hank doesn't claim back: nothing to honour, so the split
    // is free to be the most balanced one.
    const four = [P("Ann", "RK", "Hank"), P("Cal", "RK"), P("Dan", "P"), P("Hank", "P")];
    const teams = balanceTeams(four);
    expect(teams.diff).toBe(0);
  });

  it("splits four equals evenly", () => {
    const teams = balanceTeams([P("a", "N"), P("b", "N"), P("c", "N"), P("d", "N")]);
    expect(teams.diff).toBe(0);
  });

  it("prefers a mirrored line-up when one exists (N-+S+ vs N-+P, not N-+N- vs S++P)", () => {
    // N-+N- vs S++P also has a tie-break case; the mirrored split (3,4) vs (3,4)
    // is the one that actually plays evenly.
    const teams = balanceTeams([P("a", "N_MINUS"), P("b", "S_PLUS"), P("c", "N_MINUS"), P("d", "P")]);
    expect(teams.diff).toBe(0);
    expect(teams.mismatch).toBe(0);
    expect(teamOf(teams, "a")).not.toBe(teamOf(teams, "c")); // the two N- are split up
  });

  it("takes the evenest split even when no line-up mirrors (RK+S+ vs BG+N- is 5v5)", () => {
    const teams = balanceTeams([P("a", "RK"), P("b", "S_PLUS"), P("c", "BG"), P("d", "N_MINUS")]);
    expect(teams.diff).toBe(0);
    expect(teams.mismatch).toBe(2); // no mirrored option exists among these four
  });
});

describe("courtSkillCost", () => {
  it("is 0 when everyone is in the same tier", () => {
    expect(courtSkillCost([P("a", "N"), P("b", "N_MINUS"), P("c", "N_PLUS"), P("d", "N")])).toBe(0);
  });

  it("grows as the skill spread widens", () => {
    const tight = courtSkillCost([P("a", "BG"), P("b", "BG"), P("c", "BG_PLUS"), P("d", "BG")]);
    const wide = courtSkillCost([P("a", "RK"), P("b", "RK"), P("c", "P"), P("d", "P")]);
    expect(tight).toBeLessThan(wide);
  });
});
