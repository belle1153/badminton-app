import { describe, it, expect } from "vitest";
import {
  buildSchedule,
  rubberCourt,
  rubberOffsetMinutes,
  parseHHMM,
  tieLabel,
  DEFAULT_TEAMS,
  TEAM_SWATCHES,
} from "./schedule";

const teams = [1, 2, 3, 4, 5, 6].map((seed) => ({ id: `t${seed}`, seed }));

describe("buildSchedule — the event's printed timetable", () => {
  const ties = buildSchedule(teams);
  const qualifier = ties.filter((t) => t.stage === "QUALIFIER");

  it("has 15 qualifier ties and 5 knockout ties, each with 5 rubbers", () => {
    expect(qualifier).toHaveLength(15);
    expect(ties.filter((t) => t.stage !== "QUALIFIER")).toHaveLength(5);
    expect(ties.every((t) => t.rubbers.length === 5)).toBe(true);
  });

  it("makes every pair of teams meet exactly once in the qualifier", () => {
    const pairs = qualifier.map((t) => [t.teamAId, t.teamBId].sort().join("-"));
    expect(new Set(pairs).size).toBe(15);
  });

  it("matches the poster: round 2 tie 2 is seed 6 vs seed 4 on courts 3–4 at 15:00", () => {
    const tie = qualifier.find((t) => t.round === 2 && t.slot === 2)!;
    expect(tie).toMatchObject({ teamAId: "t6", teamBId: "t4", courtA: 3, courtB: 4, startsAt: "15:00" });
  });

  it("starts the five rounds on the hour from 14:00", () => {
    expect([1, 2, 3, 4, 5].map((r) => qualifier.find((t) => t.round === r)!.startsAt)).toEqual([
      "14:00", "15:00", "16:00", "17:00", "18:00",
    ]);
  });

  it("lays out the knockout from 19:30 with teams left open", () => {
    const ko = ties.filter((t) => t.stage !== "QUALIFIER");
    expect(ko.map((t) => [t.stage, t.slot, t.startsAt, t.courtA, t.courtB, t.teamAId, t.teamBId])).toEqual([
      ["SEMI", 1, "19:30", 1, 2, null, null],
      ["SEMI", 2, "20:00", 3, 4, null, null],
      ["FIFTH", 1, "20:30", 5, 6, null, null],
      ["THIRD", 1, "21:00", 1, 2, null, null],
      ["FINAL", 1, "21:30", 3, 4, null, null],
    ]);
  });

  it("puts rubbers 1, 3, 5 on the first court and 2, 4 on the second", () => {
    expect(qualifier[0].rubbers.map((r) => r.court)).toEqual([1, 2, 1, 2, 1]);
    expect(rubberCourt(4, 5, 6)).toBe(6);
  });
});

describe("timing helpers", () => {
  it("offsets rubbers 1–2 at the start, 3–4 one slot later, 5 two slots later", () => {
    expect(rubberOffsetMinutes(1, 20)).toBe(0);
    expect(rubberOffsetMinutes(2, 20)).toBe(0);
    expect(rubberOffsetMinutes(3, 20)).toBe(20);
    expect(rubberOffsetMinutes(5, 30)).toBe(60);
  });

  it("parses HH:MM into minutes since midnight", () => {
    expect(parseHHMM("14:00")).toBe(840);
    expect(parseHHMM("21:30")).toBe(1290);
  });
});

describe("labels and defaults", () => {
  it("names ties the way the poster does", () => {
    expect(tieLabel("QUALIFIER", 2, 1)).toBe("รอบ 2 · แมตซ์ 1");
    expect(tieLabel("SEMI", null, 2)).toBe("รองชนะเลิศ 2");
    expect(tieLabel("FIFTH", null, 1)).toBe("ชิงอันดับ 5");
    expect(tieLabel("THIRD", null, 1)).toBe("ชิงอันดับ 3");
    expect(tieLabel("FINAL", null, 1)).toBe("ชิงชนะเลิศ");
  });

  it("ships the poster's six teams in seed order and 12 swatches", () => {
    expect(DEFAULT_TEAMS.map((t) => t.name)).toEqual(["แดง", "ชมพู", "ม่วง", "เขียว", "น้ำเงิน", "เหลือง"]);
    expect(DEFAULT_TEAMS[0].color).toBe("#dc2626");
    expect(TEAM_SWATCHES).toHaveLength(12);
  });
});
