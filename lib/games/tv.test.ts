import { describe, it, expect } from "vitest";
import { tvTies, type TvTieLike } from "./tv";
import { buildSchedule, DEFAULT_TEAMS } from "./schedule";

type Status = TvTieLike["status"];

const NOW = new Date("2026-11-21T12:00:00Z");
/** An ISO time `min` minutes before NOW. */
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();

/**
 * The 20 ties of an event, every one with the given status unless overridden by id;
 * `finishedAt` is when its last pair finished (a done tie with none counts as long ago).
 */
function ties(statusOf: (i: number) => Status = () => "upcoming", finishedAt: (i: number) => string | null = () => null) {
  const teams = DEFAULT_TEAMS.map((t) => ({ id: `team${t.seed}`, seed: t.seed }));
  return buildSchedule(teams).map((t, i) => ({
    id: `tie${i + 1}`,
    stage: t.stage,
    round: t.round,
    slot: t.slot,
    startsAt: t.startsAt,
    status: statusOf(i),
    rubbers: [{ finishedAt: ago(60) }, { finishedAt: finishedAt(i) }],
  }));
}

const ids = (list: { id: string }[]) => list.map((t) => t.id);

describe("tvTies", () => {
  it("shows the qualifier round in play", () => {
    const all = ties((i) => (i < 3 ? "done" : i < 6 ? "live" : "upcoming"));
    expect(ids(tvTies(all, NOW))).toEqual(["tie4", "tie5", "tie6"]);
  });

  it("shows the next round between rounds, and round 1 before the start", () => {
    expect(ids(tvTies(ties((i) => (i < 3 ? "done" : "upcoming")), NOW))).toEqual(["tie4", "tie5", "tie6"]);
    expect(ids(tvTies(ties(), NOW))).toEqual(["tie1", "tie2", "tie3"]);
  });

  it("keeps a qualifier round up for five minutes after its last pair finishes", () => {
    const status = (i: number) => (i < 3 ? "done" : i < 6 ? "live" : "upcoming");
    const lastAt = (min: number) => (i: number) => (i === 1 ? ago(min) : i < 3 ? ago(20) : null);
    expect(ids(tvTies(ties(status, lastAt(4)), NOW))).toEqual(["tie1", "tie2", "tie3"]);
    expect(ids(tvTies(ties(status, lastAt(6)), NOW))).toEqual(["tie4", "tie5", "tie6"]);
  });

  it("keeps the last qualifier round up before switching to the knockout", () => {
    const status = (i: number) => (i < 15 ? "done" : "upcoming");
    expect(ids(tvTies(ties(status, (i) => (i === 14 ? ago(2) : null)), NOW))).toEqual(["tie13", "tie14", "tie15"]);
    expect(ids(tvTies(ties(status, (i) => (i === 14 ? ago(9) : null)), NOW))).toEqual(["tie16", "tie17", "tie18"]);
  });

  it("in the knockout shows the ties in play and the next ones, up to three", () => {
    const all = ties((i) => (i < 15 ? "done" : i === 15 ? "live" : "upcoming"));
    expect(ids(tvTies(all, NOW))).toEqual(["tie16", "tie17", "tie18"]);
  });

  it("keeps a knockout tie up for five minutes after it is decided", () => {
    const status = (i: number) => (i < 16 ? "done" : "upcoming");
    expect(ids(tvTies(ties(status, (i) => (i === 15 ? ago(3) : null)), NOW))).toEqual(["tie16", "tie17", "tie18"]);
    expect(ids(tvTies(ties(status, (i) => (i === 15 ? ago(5) : null)), NOW))).toEqual(["tie17", "tie18", "tie19"]);
  });

  it("after the last tie keeps showing the last three knockout ties", () => {
    expect(ids(tvTies(ties(() => "done"), NOW))).toEqual(["tie18", "tie19", "tie20"]);
  });
});
