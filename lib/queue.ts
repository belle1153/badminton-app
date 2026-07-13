import { prisma } from "@/lib/db";
import { generateMatches, type Player, type SkillLevel } from "@/lib/matching";

export interface QueuePlayer {
  id: string; // signUp id
  name: string;
  skillLevel: SkillLevel;
  waitingSince: number; // ms — smaller = waited longer = nearer the front
}

export interface CourtState {
  /** Active (unfinished) match per court, keyed by court number. */
  activeByCourt: Map<number, { id: string; round: number; playerIds: string[] }>;
  /** Free checked-in players, front of the queue first (waited longest). */
  queue: QueuePlayer[];
  /** signUp ids currently on a court. */
  playingIds: Set<string>;
}

interface SignUpRow {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  fixedPartnerId: string | null;
  checkedInAt: Date | null;
  createdAt: Date;
  status: string;
}

interface MatchRow {
  id: string;
  round: number;
  court: number;
  finishedAt: Date | null;
  players: { signUpId: string }[];
}

/**
 * Reconstructs the live picture of a session from its sign-ups and matches:
 * who is on court right now, and who is waiting (in order). A player is on the
 * queue when they have checked in and are not in any active match; the queue is
 * ordered by how long they have been waiting — a player's clock is the finish
 * time of their most recent game, or their check-in time if they haven't played
 * yet. So people who never played sit at the front, and whoever just finished
 * drops to the back.
 */
export function deriveCourtState(signups: SignUpRow[], matches: MatchRow[]): CourtState {
  // Present pool = whoever is checked in. Check-in is the single source of
  // truth for "here", so un-checking a waiting player removes them from the
  // queue (that's how the admin's "เคลียร์คิว" clears people out).
  const pool = signups.filter((s) => s.status !== "WITHDRAWN" && s.checkedInAt != null);

  // A court's current game is its highest-round match; the court is occupied
  // only while that game is unfinished. Older unfinished matches left over from
  // an earlier batched round are superseded — ignore them so finishing the
  // latest game actually frees the court.
  const latestByCourt = new Map<number, MatchRow>();
  for (const m of matches) {
    const cur = latestByCourt.get(m.court);
    if (!cur || m.round > cur.round) latestByCourt.set(m.court, m);
  }
  const activeByCourt = new Map<number, { id: string; round: number; playerIds: string[] }>();
  for (const [court, m] of latestByCourt) {
    if (m.finishedAt == null) {
      activeByCourt.set(court, { id: m.id, round: m.round, playerIds: m.players.map((p) => p.signUpId) });
    }
  }

  const playingIds = new Set<string>();
  for (const a of activeByCourt.values()) for (const id of a.playerIds) playingIds.add(id);

  // Each player's "waiting since" = latest finished-match time, else check-in
  // (falling back to sign-up time when they were never formally checked in).
  const lastFinished = new Map<string, number>();
  for (const m of matches) {
    if (m.finishedAt == null) continue;
    const t = m.finishedAt.getTime();
    for (const p of m.players) {
      lastFinished.set(p.signUpId, Math.max(lastFinished.get(p.signUpId) ?? 0, t));
    }
  }

  const queue: QueuePlayer[] = pool
    .filter((s) => !playingIds.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      skillLevel: s.skillLevel,
      waitingSince: lastFinished.get(s.id) ?? s.checkedInAt?.getTime() ?? s.createdAt.getTime(),
    }))
    .sort((a, b) => a.waitingSince - b.waitingSince || a.name.localeCompare(b.name));

  return { activeByCourt, queue, playingIds };
}

const MATCH_SELECT = {
  id: true,
  round: true,
  court: true,
  finishedAt: true,
  players: { select: { signUpId: true } },
} as const;

const SIGNUP_SELECT = {
  id: true,
  name: true,
  skillLevel: true,
  fixedPartnerId: true,
  checkedInAt: true,
  createdAt: true,
  status: true,
} as const;

/** Load a session's live court state from the database. */
export async function loadCourtState(sessionId: string): Promise<CourtState> {
  const [signups, matches] = await Promise.all([
    prisma.signUp.findMany({ where: { sessionId }, select: SIGNUP_SELECT }),
    prisma.match.findMany({ where: { sessionId }, select: MATCH_SELECT }),
  ]);
  return deriveCourtState(signups as SignUpRow[], matches as MatchRow[]);
}

export type FillResult =
  | { ok: true; matchId: string; round: number; court: number; playerIds: string[] }
  | { ok: false; reason: "court_taken" | "not_enough" };

/**
 * Pull the next four from the queue onto a court and start a game with
 * skill-balanced teams. The new game's round is one past that court's highest
 * round, so it becomes the court's current match.
 */
export async function fillCourt(sessionId: string, court: number): Promise<FillResult> {
  const [signups, matches] = await Promise.all([
    prisma.signUp.findMany({ where: { sessionId }, select: SIGNUP_SELECT }),
    prisma.match.findMany({ where: { sessionId }, select: MATCH_SELECT }),
  ]);
  const state = deriveCourtState(signups as SignUpRow[], matches as MatchRow[]);

  if (state.activeByCourt.has(court)) return { ok: false, reason: "court_taken" };
  if (state.queue.length < 4) return { ok: false, reason: "not_enough" };

  const nextFour = state.queue.slice(0, 4);
  const byId = new Map((signups as SignUpRow[]).map((s) => [s.id, s]));
  const players: Player[] = nextFour.map((q) => {
    const s = byId.get(q.id)!;
    return { id: s.id, name: s.name, skillLevel: s.skillLevel, fixedPartnerId: s.fixedPartnerId };
  });

  const { matches: built } = generateMatches(players, [court]);
  const match = built[0];
  // Fallback (shouldn't happen with 4 players): straight split.
  const team1 = match ? match.team1 : players.slice(0, 2);
  const team2 = match ? match.team2 : players.slice(2, 4);

  const maxRoundForCourt = (matches as MatchRow[])
    .filter((m) => m.court === court)
    .reduce((max, m) => Math.max(max, m.round), 0);
  const round = maxRoundForCourt + 1;

  const created = await prisma.match.create({
    data: {
      sessionId,
      round,
      court,
      players: {
        create: [
          ...team1.map((p) => ({ signUpId: p.id, team: 1 })),
          ...team2.map((p) => ({ signUpId: p.id, team: 2 })),
        ],
      },
    },
  });

  return {
    ok: true,
    matchId: created.id,
    round,
    court,
    playerIds: [...team1, ...team2].map((p) => p.id),
  };
}
