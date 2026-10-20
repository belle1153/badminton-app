import { textOn } from "./color";
import { ictDateKey, ictNowMinute } from "./clock";
import { courtsNowNext, type CourtRubber } from "./courts";
import { resolveKnockout } from "./knockout";
import { isKnockout, rubberOutcome, setsFromColumns, tieScore, type SetColumns } from "./rules";
import { parseHHMM, rubberOffsetMinutes, tieLabel } from "./schedule";
import { computeStandings, type StandingRow } from "./standings";
import type { RubberOutcome, SetScore, Side, Stage } from "./types";

/* ------------------------------------------------------------------ input */

export interface RubberRow extends SetColumns {
  id: string;
  order: number;
  court: number;
  a1Id: string | null;
  a2Id: string | null;
  b1Id: string | null;
  b2Id: string | null;
  finishedAt: Date | null;
  liveSet: number | null;
  liveStartedAt: Date | null;
}

export interface GamesRows {
  event: {
    id: string;
    name: string;
    date: Date;
    qualifierRubberMinutes: number;
    knockoutRubberMinutes: number;
    published: boolean;
    rankOverride: string | null;
    teams: {
      id: string;
      seed: number;
      name: string;
      color: string;
      /** Whether a logo exists — the blob itself is never loaded here. */
      hasLogo: boolean;
      updatedAt: Date;
      members: { athleteId: string }[];
    }[];
    ties: {
      id: string;
      stage: Stage;
      round: number | null;
      slot: number;
      startsAt: string;
      courtA: number;
      courtB: number;
      teamAId: string | null;
      teamBId: string | null;
      rubbers: RubberRow[];
    }[];
  };
  athletes: { id: string; name: string; updatedAt: Date; hasPhoto: boolean }[];
}

/* ----------------------------------------------------------------- output */

export interface PlayerRef {
  id: string;
  name: string;
  photoUrl: string | null;
}

export type RubberStatus = "done" | "live" | "next" | "upcoming" | "cancelled";

export interface RubberView {
  id: string;
  order: number;
  court: number;
  a: (PlayerRef | null)[];
  b: (PlayerRef | null)[];
  sets: SetScore[];
  finished: boolean;
  outcome: RubberOutcome;
  status: RubberStatus;
  liveSet: number | null;
  liveStartedAt: string | null;
  startMinute: number;
}

export interface TieView {
  id: string;
  stage: Stage;
  round: number | null;
  slot: number;
  label: string;
  startsAt: string;
  courtA: number;
  courtB: number;
  teamAId: string | null;
  teamBId: string | null;
  projected: boolean;
  pointsA: number;
  pointsB: number;
  winner: Side | null;
  status: "upcoming" | "live" | "done";
  lineupMismatch: boolean;
  rubbers: RubberView[];
}

export interface TeamView {
  id: string;
  seed: number;
  name: string;
  color: string;
  textColor: string;
  logoUrl: string | null;
  members: PlayerRef[];
}

export interface GamesState {
  event: {
    id: string;
    name: string;
    date: string;
    qualifierMinutes: number;
    knockoutMinutes: number;
    published: boolean;
    rankOverride: string[] | null;
  };
  serverNow: string;
  teams: TeamView[];
  ties: TieView[];
  standings: StandingRow[];
  qualifierDone: boolean;
  courts: { court: number; nowRubberId: string | null; nowStarted: boolean; nextRubberId: string | null }[];
}

/* ---------------------------------------------------------------- builder */

/**
 * Turn the stored rows into everything the pages show. Pure: the same rows and
 * clock always give the same snapshot, and nothing derived is ever stored, so
 * an edited result re-scores the tie, the table and the knockout at once.
 */
export function buildGamesState(rows: GamesRows, now: Date): GamesState {
  const ev = rows.event;
  const athletes = new Map(rows.athletes.map((a) => [a.id, a]));
  const player = (id: string | null): PlayerRef | null => {
    if (!id) return null;
    const a = athletes.get(id);
    if (!a) return { id, name: "?", photoUrl: null };
    return { id, name: a.name, photoUrl: a.hasPhoto ? `/api/athletes/${id}/photo?v=${a.updatedAt.getTime()}` : null };
  };

  const teams: TeamView[] = [...ev.teams]
    .sort((a, b) => a.seed - b.seed)
    .map((t) => ({
      id: t.id,
      seed: t.seed,
      name: t.name,
      color: t.color,
      textColor: textOn(t.color),
      logoUrl: t.hasLogo ? `/api/games/teams/${t.id}/logo?v=${t.updatedAt.getTime()}` : null,
      members: t.members.map((m) => player(m.athleteId)!).sort((a, b) => a.name.localeCompare(b.name, "th")),
    }));
  const memberSets = new Map(ev.teams.map((t) => [t.id, new Set(t.members.map((m) => m.athleteId))]));

  const minutesFor = (stage: Stage) => (isKnockout(stage) ? ev.knockoutRubberMinutes : ev.qualifierRubberMinutes);

  // 1. Per-rubber results.
  const scored = ev.ties.map((t) => {
    const rubbers = [...t.rubbers]
      .sort((a, b) => a.order - b.order)
      .map((r) => {
        const sets = setsFromColumns(r);
        const finished = r.finishedAt != null;
        return { row: r, sets, finished, outcome: rubberOutcome(t.stage, sets, finished) };
      });
    return { tie: t, rubbers, score: tieScore(t.stage, rubbers.map((r) => r.outcome)) };
  });

  // 2. Qualifier table.
  const qualifier = scored.filter((s) => s.tie.stage === "QUALIFIER");
  const rankOverride = ev.rankOverride ? ev.rankOverride.split(",").filter(Boolean) : null;
  const standings = computeStandings(
    ev.teams.map((t) => ({ id: t.id, seed: t.seed })),
    qualifier
      .filter((s) => s.tie.teamAId && s.tie.teamBId)
      .map((s) => ({
        teamAId: s.tie.teamAId!,
        teamBId: s.tie.teamBId!,
        rubbers: s.rubbers.map((r) => ({ outcome: r.outcome, sets: r.sets })),
      })),
    rankOverride
  );
  const qualifierDone = qualifier.length > 0 && qualifier.every((s) => s.rubbers.every((r) => r.outcome != null));

  // 3. Knockout pairings.
  const knockout = resolveKnockout(
    scored
      .filter((s) => isKnockout(s.tie.stage))
      .map((s) => ({ id: s.tie.id, stage: s.tie.stage, slot: s.tie.slot, winner: s.score.winner, teamAId: null, teamBId: null })),
    standings,
    qualifierDone
  );

  // 4. Courts.
  const courtInput: CourtRubber[] = scored.flatMap((s) =>
    s.rubbers.map((r) => ({
      id: r.row.id,
      court: r.row.court,
      order: r.row.order,
      startMinute: parseHHMM(s.tie.startsAt) + rubberOffsetMinutes(r.row.order, minutesFor(s.tie.stage)),
      finished: r.finished,
      cancelled: isCancelled(s.score.decidedAt, r.row.order, r.finished),
    }))
  );
  // The timetable is in clock times of the event day: before that day nothing
  // has started, after it everything has.
  const today = ictDateKey(now);
  const eventDay = ev.date.toISOString().slice(0, 10);
  const nowMinute = today < eventDay ? -Infinity : today > eventDay ? Infinity : ictNowMinute(now);
  const courts = courtsNowNext(courtInput, nowMinute);
  const liveIds = new Set(courts.filter((c) => c.nowStarted && c.nowId).map((c) => c.nowId!));
  const nextIds = new Set(
    courts.flatMap((c) => [c.nextId, c.nowStarted ? null : c.nowId]).filter((x): x is string => x != null)
  );
  const startMinute = new Map(courtInput.map((c) => [c.id, c.startMinute]));

  // 5. Views.
  const ties: TieView[] = scored.map(({ tie, rubbers, score }) => {
    const sides = knockout[tie.id];
    const teamAId = sides ? sides.teamAId : tie.teamAId;
    const teamBId = sides ? sides.teamBId : tie.teamBId;

    const rubberViews: RubberView[] = rubbers.map(({ row, sets, finished, outcome }) => {
      const cancelled = isCancelled(score.decidedAt, row.order, finished);
      const status: RubberStatus = finished
        ? "done"
        : cancelled
          ? "cancelled"
          : row.liveSet != null || liveIds.has(row.id)
            ? "live"
            : nextIds.has(row.id)
              ? "next"
              : "upcoming";
      return {
        id: row.id,
        order: row.order,
        court: row.court,
        a: [player(row.a1Id), player(row.a2Id)],
        b: [player(row.b1Id), player(row.b2Id)],
        sets,
        finished,
        outcome,
        status,
        liveSet: row.liveSet,
        liveStartedAt: row.liveStartedAt ? row.liveStartedAt.toISOString() : null,
        startMinute: startMinute.get(row.id) ?? 0,
      };
    });

    const allDone = isKnockout(tie.stage) ? score.winner != null : rubberViews.every((r) => r.status === "done");
    const anyActive = rubberViews.some((r) => r.status === "done" || r.status === "live");

    const outside = (ids: (string | null)[], teamId: string | null) =>
      ids.some((id) => id != null && (teamId == null || !memberSets.get(teamId)?.has(id)));
    const lineupMismatch = rubbers.some(
      ({ row }) => outside([row.a1Id, row.a2Id], teamAId) || outside([row.b1Id, row.b2Id], teamBId)
    );

    return {
      id: tie.id,
      stage: tie.stage,
      round: tie.round,
      slot: tie.slot,
      label: tieLabel(tie.stage, tie.round, tie.slot),
      startsAt: tie.startsAt,
      courtA: tie.courtA,
      courtB: tie.courtB,
      teamAId,
      teamBId,
      projected: sides?.projected ?? false,
      pointsA: score.pointsA,
      pointsB: score.pointsB,
      winner: score.winner,
      status: allDone ? "done" : anyActive ? "live" : "upcoming",
      lineupMismatch,
      rubbers: rubberViews,
    };
  });

  return {
    event: {
      id: ev.id,
      name: ev.name,
      date: ev.date.toISOString().slice(0, 10),
      qualifierMinutes: ev.qualifierRubberMinutes,
      knockoutMinutes: ev.knockoutRubberMinutes,
      published: ev.published,
      rankOverride,
    },
    serverNow: now.toISOString(),
    teams,
    ties: ties.sort(
      (a, b) => parseHHMM(a.startsAt) - parseHHMM(b.startsAt) || a.slot - b.slot
    ),
    standings,
    qualifierDone,
    courts: courts.map((c) => ({
      court: c.court,
      nowRubberId: c.nowId,
      nowStarted: c.nowStarted,
      nextRubberId: c.nextId,
    })),
  };
}

/** A knockout rubber after the deciding one is not played, unless it already has a result. */
function isCancelled(decidedAt: number | null, order: number, finished: boolean): boolean {
  return decidedAt != null && order > decidedAt && !finished;
}
