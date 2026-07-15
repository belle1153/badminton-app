import { deriveCourtState, previewFoursomes } from "@/lib/queue";
import { balanceTeams, type Player, type SkillLevel } from "@/lib/matching";

export interface BoardPlayer {
  id: string;
  name: string;
  skillLevel: string;
  photoUrl: string | null;
}

export interface BoardTeamMatch {
  id: string;
  round: number;
  court: number;
  active: boolean;
  team1: BoardPlayer[];
  team2: BoardPlayer[];
}

export interface BoardFinishedMatch extends BoardTeamMatch {
  winnerTeam: number | null;
}

export interface BoardCourt {
  court: number;
  match: BoardTeamMatch | null;
}

export interface BoardMatchup {
  key: string;
  teamA: { id: string; name: string }[];
  teamB: { id: string; name: string }[];
}

export interface CourtBoard {
  courts: BoardCourt[];
  matchups: BoardMatchup[];
  finished: BoardFinishedMatch[];
  historyCourts: number[];
  queueCount: number;
}

interface BoardSignUp {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  fixedPartnerId: string | null;
  checkedInAt: Date | null;
  createdAt: Date;
  status: string;
}

interface BoardMatchRow {
  id: string;
  round: number;
  court: number;
  finishedAt: Date | null;
  winnerTeam: number | null;
  players: {
    team: number;
    signUp: { id: string; name: string; skillLevel: string; athlete: { photoUrl: string | null } | null };
  }[];
}

/**
 * The per-day court board — current game per court, คู่เตรียม preview (next
 * balanced foursomes from the queue), and finished-game history. Shared by
 * the day's own courts tab (session/[id]/(tabs)/courts) and the multi-day
 * "สนามที่กำลังเล่น" view (app/live) so both render the exact same picture
 * from one place instead of two copies of the same computation.
 *
 * `matchupKeyPrefix` keeps React keys unique when several boards render on
 * the same page (app/live shows one board per open session).
 */
export function buildCourtBoard(
  signUps: BoardSignUp[],
  matches: BoardMatchRow[],
  openCourts: number[],
  matchupKeyPrefix = ""
): CourtBoard {
  const state = deriveCourtState(
    signUps,
    matches.map((m) => ({
      id: m.id,
      round: m.round,
      court: m.court,
      finishedAt: m.finishedAt,
      players: m.players.map((p) => ({ signUpId: p.signUp.id })),
    }))
  );

  const matchById = new Map(matches.map((m) => [m.id, m]));
  const activeIds = new Set([...state.currentByCourt.values()].map((g) => g.id));

  const toTeamMatch = (m: BoardMatchRow): BoardTeamMatch => ({
    id: m.id,
    round: m.round,
    court: m.court,
    active: activeIds.has(m.id),
    team1: m.players
      .filter((p) => p.team === 1)
      .map((p) => ({
        id: p.signUp.id,
        name: p.signUp.name,
        skillLevel: p.signUp.skillLevel,
        photoUrl: p.signUp.athlete?.photoUrl ?? null,
      })),
    team2: m.players
      .filter((p) => p.team === 2)
      .map((p) => ({
        id: p.signUp.id,
        name: p.signUp.name,
        skillLevel: p.signUp.skillLevel,
        photoUrl: p.signUp.athlete?.photoUrl ?? null,
      })),
  });

  // Show the courts open right now (admin's open set, or the clock default),
  // plus any court that still has a live/queued game so it's never hidden.
  const occupied = new Set<number>([...state.currentByCourt.keys(), ...state.upcomingByCourt.keys()]);
  const courtNums = [...new Set([...openCourts, ...occupied])].sort((a, b) => a - b);
  const courts: BoardCourt[] = courtNums.map((court) => {
    const cur = state.currentByCourt.get(court);
    return { court, match: cur ? toTeamMatch(matchById.get(cur.id)!) : null };
  });

  // คู่เตรียม: split the front of the waiting queue (wait order) into balanced
  // matchups, using the SAME picker fillCourt uses so the preview matches
  // what actually runs (closest skill, then queue).
  const signUpById = new Map(signUps.map((s) => [s.id, s]));
  const queuePlayers: Player[] = state.queue.map((q) => {
    const s = signUpById.get(q.id)!;
    return { id: s.id, name: s.name, skillLevel: s.skillLevel as SkillLevel, fixedPartnerId: s.fixedPartnerId };
  });
  const finishedSets = matches
    .filter((m) => m.finishedAt != null)
    .map((m) => new Set(m.players.map((p) => p.signUp.id)));
  const matchups: BoardMatchup[] = previewFoursomes(queuePlayers, finishedSets, 3).map((four, i) => {
    const { team1, team2 } = balanceTeams(four);
    return {
      key: `${matchupKeyPrefix}${i}`,
      teamA: team1.map((p) => ({ id: p.id, name: p.name })),
      teamB: team2.map((p) => ({ id: p.id, name: p.name })),
    };
  });

  const finished: BoardFinishedMatch[] = matches
    .filter((m) => m.finishedAt != null)
    .map((m) => ({ ...toTeamMatch(m), winnerTeam: m.winnerTeam }))
    .sort((a, b) => a.court - b.court || a.round - b.round);
  const historyCourts = [...new Set(finished.map((m) => m.court))];

  return { courts, matchups, finished, historyCourts, queueCount: queuePlayers.length };
}
