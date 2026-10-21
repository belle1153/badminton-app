import { describe, it, expect } from "vitest";
import { tvTies, type TvTieLike } from "./tv";
import { buildSchedule, DEFAULT_TEAMS } from "./schedule";

type Status = TvTieLike["status"];

/** The 20 ties of an event, every one with the given status unless overridden by id. */
function ties(statusOf: (i: number) => Status = () => "upcoming") {
  const teams = DEFAULT_TEAMS.map((t) => ({ id: `team${t.seed}`, seed: t.seed }));
  return buildSchedule(teams).map((t, i) => ({ id: `tie${i + 1}`, stage: t.stage, round: t.round, slot: t.slot, startsAt: t.startsAt, status: statusOf(i) }));
}

const ids = (list: { id: string }[]) => list.map((t) => t.id);

describe("tvTies", () => {
  it("shows the qualifier round in play", () => {
    const all = ties((i) => (i < 3 ? "done" : i < 6 ? "live" : "upcoming"));
    expect(ids(tvTies(all))).toEqual(["tie4", "tie5", "tie6"]);
  });

  it("shows the next round between rounds, and round 1 before the start", () => {
    expect(ids(tvTies(ties((i) => (i < 3 ? "done" : "upcoming"))))).toEqual(["tie4", "tie5", "tie6"]);
    expect(ids(tvTies(ties()))).toEqual(["tie1", "tie2", "tie3"]);
  });

  it("in the knockout shows the ties in play and the next ones, up to three", () => {
    const all = ties((i) => (i < 15 ? "done" : i === 15 ? "live" : "upcoming"));
    expect(ids(tvTies(all))).toEqual(["tie16", "tie17", "tie18"]);
  });

  it("after the last tie keeps showing the last three knockout ties", () => {
    expect(ids(tvTies(ties(() => "done")))).toEqual(["tie18", "tie19", "tie20"]);
  });
});
