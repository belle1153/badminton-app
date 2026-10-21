import { describe, it, expect } from "vitest";
import { buildGamesState, type GamesRows, type RubberRow } from "./state";
import { buildSchedule, DEFAULT_TEAMS } from "./schedule";

const NOW = new Date("2026-11-01T07:25:00Z"); // 14:25 ICT on the event day

function fixture(): GamesRows {
  const teams = DEFAULT_TEAMS.map((t) => ({
    id: `team${t.seed}`,
    seed: t.seed,
    name: t.name,
    color: t.color,
    hasLogo: t.seed === 1,
    updatedAt: new Date(1000),
    members: [0, 1, 2, 3].map((i) => ({ athleteId: `p${t.seed}${i}` })),
  }));
  const ties = buildSchedule(teams).map((t, i) => ({
    id: `tie${i + 1}`,
    stage: t.stage,
    round: t.round,
    slot: t.slot,
    startsAt: t.startsAt,
    courtA: t.courtA,
    courtB: t.courtB,
    teamAId: t.teamAId,
    teamBId: t.teamBId,
    rubbers: t.rubbers.map(
      (r): RubberRow => ({
        id: `tie${i + 1}-r${r.order}`,
        order: r.order,
        court: r.court,
        a1Id: null, a2Id: null, b1Id: null, b2Id: null,
        set1A: null, set1B: null, set2A: null, set2B: null, set3A: null, set3B: null,
        finishedAt: null, liveSet: null, liveStartedAt: null,
      })
    ),
    cards: [] as GamesRows["event"]["ties"][number]["cards"],
  }));
  return {
    event: {
      id: "ev",
      name: "TUA TUENG GAMES 2026",
      date: new Date("2026-11-01T00:00:00Z"),
      qualifierRubberMinutes: 20,
      knockoutRubberMinutes: 30,
      published: true,
      rankOverride: null,
      teams,
      ties,
    },
    athletes: teams.flatMap((t) =>
      t.members.map((m) => ({ id: m.athleteId, name: `N${m.athleteId}`, updatedAt: new Date(5000), hasPhoto: m.athleteId === "p10" }))
    ),
  };
}

const rubberOf = (rows: GamesRows, id: string) =>
  rows.event.ties.flatMap((t) => t.rubbers).find((r) => r.id === id)!;

function finish(rows: GamesRows, id: string, sets: [number, number][]) {
  const r = rubberOf(rows, id);
  [r.set1A, r.set1B] = sets[0] ?? [null, null];
  [r.set2A, r.set2B] = sets[1] ?? [null, null];
  [r.set3A, r.set3B] = sets[2] ?? [null, null];
  r.finishedAt = new Date();
}

function finishQualifier(rows: GamesRows, sets: [number, number][]) {
  for (const t of rows.event.ties) if (t.stage === "QUALIFIER") for (const r of t.rubbers) finish(rows, r.id, sets);
}

describe("buildGamesState", () => {
  it("counts a result keyed before the lineup, showing the pair as unnamed", () => {
    const rows = fixture();
    finish(rows, "tie1-r1", [[21, 10], [21, 12]]);
    const tie = buildGamesState(rows, NOW).ties.find((t) => t.id === "tie1")!;
    expect(tie.rubbers[0]).toMatchObject({ a: [null, null], b: [null, null], outcome: "A", status: "done" });
    expect(tie).toMatchObject({ pointsA: 2, pointsB: 0 });
  });

  it("cancels the remaining knockout rubbers once a side reaches 3", () => {
    const rows = fixture();
    for (const n of [1, 2, 3]) finish(rows, `tie16-r${n}`, [[21, 10], [21, 12]]);
    const semi = buildGamesState(rows, NOW).ties.find((t) => t.id === "tie16")!;
    expect(semi.stage).toBe("SEMI");
    expect(semi).toMatchObject({ pointsA: 3, pointsB: 0, winner: "A" });
    expect(semi.rubbers.map((r) => r.status)).toEqual(["done", "done", "done", "cancelled", "cancelled"]);
  });

  it("counts a card bonus in the tie score and the table", () => {
    const rows = fixture();
    rows.event.ties[0].cards.push({ teamId: "team1", kind: "DOUBLE_DOWN", order: 1, swapWith: null });
    finish(rows, "tie1-r1", [[21, 10], [21, 12]]); // seed 1 wins pair 1
    const state = buildGamesState(rows, NOW);
    expect(state.ties[0]).toMatchObject({ pointsA: 4, pointsB: 0, bonusA: 2, bonusB: 0 });
    expect(state.standings.find((s) => s.teamId === "team1")).toMatchObject({ points: 4 });
  });

  it("keeps a card secret until its pair is finished, unless revealing for admins", () => {
    const rows = fixture();
    rows.event.ties[0].cards.push({ teamId: "team6", kind: "STEAL", order: 2, swapWith: null });
    expect(buildGamesState(rows, NOW).ties[0].cards).toEqual([]);
    expect(buildGamesState(rows, NOW, { revealCards: true }).ties[0].cards).toEqual([{ side: "B", kind: "STEAL", order: 2, swapWith: null }]);
    finish(rows, "tie1-r2", [[10, 21], [12, 21]]);
    const state = buildGamesState(rows, NOW);
    expect(state.ties[0].cards).toEqual([{ side: "B", kind: "STEAL", order: 2, swapWith: null }]);
    expect(state.ties[0]).toMatchObject({ pointsA: -1, pointsB: 3 });
  });

  it("names no knockout teams while any qualifier rubber is still open", () => {
    const rows = fixture();
    finishQualifier(rows, [[21, 15], [15, 21]]);
    const last = rows.event.ties.find((t) => t.id === "tie15")!.rubbers[4];
    [last.set1A, last.set1B, last.set2A, last.set2B, last.finishedAt] = [null, null, null, null, null];
    const state = buildGamesState(rows, NOW);
    expect(state.qualifierDone).toBe(false);
    expect(state.ties.find((t) => t.id === "tie16")).toMatchObject({ teamAId: null, teamBId: null });
  });

  it("fills the knockout from the final table once all 15 qualifier ties are done", () => {
    const rows = fixture();
    finishQualifier(rows, [[21, 15], [15, 21]]); // all draws: level on everything, so seed order
    const state = buildGamesState(rows, NOW);
    expect(state.qualifierDone).toBe(true);
    expect(state.ties.find((t) => t.id === "tie16")).toMatchObject({ teamAId: "team1", teamBId: "team4", projected: false });
  });

  it("flags a knockout lineup that no longer matches the resolved team", () => {
    const rows = fixture();
    finishQualifier(rows, [[21, 15], [15, 21]]); // seed order: semi 1 is seed 1 vs seed 4
    rubberOf(rows, "tie16-r1").a1Id = "p20"; // a seed-2 player on the seed-1 side
    const semi = buildGamesState(rows, NOW).ties.find((t) => t.id === "tie16")!;
    expect(semi).toMatchObject({ teamAId: "team1", teamBId: "team4", lineupMismatch: true });
  });

  it("serves photos and logos as versioned URLs, never inline", () => {
    const rows = fixture();
    rubberOf(rows, "tie1-r1").a1Id = "p10";
    rubberOf(rows, "tie1-r1").a2Id = "p11";
    const state = buildGamesState(rows, NOW);
    expect(state.ties[0].rubbers[0].a).toEqual([
      { id: "p10", name: "Np10", photoUrl: "/api/athletes/p10/photo?v=5000" },
      { id: "p11", name: "Np11", photoUrl: null },
    ]);
    expect(state.teams[0].logoUrl).toBe("/api/games/teams/team1/logo?v=1000");
    expect(state.teams[1].logoUrl).toBe(null);
    expect(state.teams[5].textColor).toBe("#0b1c30");
  });

  it("puts the next rubber on court after a result and marks it live", () => {
    const rows = fixture();
    finish(rows, "tie1-r1", [[21, 10], [21, 12]]);
    const state = buildGamesState(rows, new Date("2026-11-01T07:25:00Z")); // 14:25
    expect(state.courts.find((c) => c.court === 1)).toMatchObject({ nowRubberId: "tie1-r3", nowStarted: true, nextRubberId: "tie1-r5" });
    expect(state.ties[0].rubbers[2].status).toBe("live");
    expect(state.ties[0].rubbers[4].status).toBe("next");
    expect(state.ties[0].status).toBe("live");
  });

  it("marks nothing as playing on a day before the event, whatever the time", () => {
    const state = buildGamesState(fixture(), new Date("2026-10-25T08:00:00Z")); // 15:00 ICT, a week early
    expect(state.courts.every((c) => !c.nowStarted)).toBe(true);
    expect(state.ties.every((t) => t.status === "upcoming")).toBe(true);
  });

  it("treats every scheduled start as passed after the event day", () => {
    const state = buildGamesState(fixture(), new Date("2026-11-03T01:00:00Z")); // 08:00 ICT, two days later
    expect(state.courts.every((c) => c.nowStarted || c.nowRubberId == null)).toBe(true);
  });

  it("reports the qualifier as unfinished and dates in ICT", () => {
    const state = buildGamesState(fixture(), NOW);
    expect(state.qualifierDone).toBe(false);
    expect(state.event.date).toBe("2026-11-01");
    expect(state.standings).toHaveLength(6);
  });
});
