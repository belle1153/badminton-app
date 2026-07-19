import { deriveCourtState } from "@/lib/queue";
import { type SkillLevel } from "@/lib/matching";

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
    signUp: { id: string; name: string; skillLevel: string; athlete: { id: string } | null };
  }[];
}

interface BoardPendingPair {
  id: string;
  team1Ids: string[];
  team2Ids: string[];
}

/**
 * The per-day court board — current game per court, the คู่เตรียม queue, and
 * finished-game history. Shared by the day's own courts tab
 * (session/[id]/(tabs)/courts) and the multi-day "สนามที่กำลังเล่น" view
 * (app/live) so both render the exact same picture from one place.
 *
 * คู่เตรียม are the admin's persisted PendingPair queue (in order), so players
 * see the same upcoming games the admin actually lined up — not a separate
 * recompute that could disagree. `matchupKeyPrefix` keeps React keys unique
 * when several boards render on the same page (app/live shows one per session).
 */
export function buildCourtBoard(
  signUps: BoardSignUp[],
  matches: BoardMatchRow[],
  openCourts: number[],
  pendingPairs: BoardPendingPair[] = [],
  // athleteId -> updatedAt ms for athletes that HAVE a photo. Avatars render
  // via /api/athletes/[id]/photo?v=… (cached hard) instead of inlined base64 —
  // that inlining made busy court pages weigh megabytes per auto-refresh.
  photoVersions: Map<string, number> = new Map(),
  matchupKeyPrefix = ""
): CourtBoard {
  const photoSrc = (athlete: { id: string } | null) => {
    const v = athlete ? photoVersions.get(athlete.id) : undefined;
    return v != null ? `/api/athletes/${athlete!.id}/photo?v=${v}` : null;
  };
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
        photoUrl: photoSrc(p.signUp.athlete),
      })),
    team2: m.players
      .filter((p) => p.team === 2)
      .map((p) => ({
        id: p.signUp.id,
        name: p.signUp.name,
        skillLevel: p.signUp.skillLevel,
        photoUrl: photoSrc(p.signUp.athlete),
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

  // คู่เตรียม = the admin's persisted queue, in order. Map each pending pair's
  // ids to names so players see the exact games that were lined up.
  const signUpById = new Map(signUps.map((s) => [s.id, s]));
  const nameOf = (pid: string) => signUpById.get(pid)?.name ?? "?";
  const matchups: BoardMatchup[] = pendingPairs.map((p) => ({
    key: `${matchupKeyPrefix}${p.id}`,
    teamA: p.team1Ids.map((pid) => ({ id: pid, name: nameOf(pid) })),
    teamB: p.team2Ids.map((pid) => ({ id: pid, name: nameOf(pid) })),
  }));

  const finished: BoardFinishedMatch[] = matches
    .filter((m) => m.finishedAt != null)
    .map((m) => ({ ...toTeamMatch(m), winnerTeam: m.winnerTeam }))
    .sort((a, b) => a.court - b.court || a.round - b.round);
  const historyCourts = [...new Set(finished.map((m) => m.court))];

  // Waiting = checked-in, free, and not already lined up in a คู่เตรียม.
  const queuedIds = new Set(pendingPairs.flatMap((p) => [...p.team1Ids, ...p.team2Ids]));
  const queueCount = state.queue.filter((q) => !queuedIds.has(q.id)).length;

  return { courts, matchups, finished, historyCourts, queueCount };
}
