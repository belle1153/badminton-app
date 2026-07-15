import { prisma } from "@/lib/db";
import { balanceTeams, diffPenalty, type Player, type SkillLevel } from "@/lib/matching";
import { openCourtNumbers } from "@/lib/billing";

export interface QueuePlayer {
  id: string; // signUp id
  name: string;
  skillLevel: SkillLevel;
  waitingSince: number; // ms — smaller = waited longer = nearer the front
}

export interface CourtGame {
  id: string;
  round: number; // per-court game number (เกมที่ N ของสนามนั้น)
  playerIds: string[];
}

export interface CourtState {
  /** Game being played right now per court = its lowest-numbered unfinished match. */
  currentByCourt: Map<number, CourtGame>;
  /** Pre-queued games per court (unfinished, after the current one), in order. */
  upcomingByCourt: Map<number, CourtGame[]>;
  /** Free checked-in players, front of the queue first (waited longest). */
  queue: QueuePlayer[];
  /** signUp ids booked in ANY unfinished game (current or upcoming). */
  reservedIds: Set<string>;
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
 * Live picture of a session under the per-court game flow: each court runs its
 * own numbered sequence (สนาม 1 เกม 1, 2, 3...). The current game on a court is
 * its lowest-numbered unfinished match; later unfinished matches are the
 * pre-queued "upcoming" games that slide up when the current one finishes.
 * Anyone booked in an unfinished game is off the waiting queue. Queue order is
 * how long you've waited: last finish time, else check-in time (never played).
 */
export function deriveCourtState(signups: SignUpRow[], matches: MatchRow[]): CourtState {
  // Present pool = whoever is checked in (check-in is the source of truth).
  const pool = signups.filter((s) => s.status !== "WITHDRAWN" && s.checkedInAt != null);

  const unfinishedByCourt = new Map<number, MatchRow[]>();
  for (const m of matches) {
    if (m.finishedAt != null) continue;
    const list = unfinishedByCourt.get(m.court) ?? [];
    list.push(m);
    unfinishedByCourt.set(m.court, list);
  }

  const currentByCourt = new Map<number, CourtGame>();
  const upcomingByCourt = new Map<number, CourtGame[]>();
  const reservedIds = new Set<string>();
  for (const [court, list] of unfinishedByCourt) {
    list.sort((a, b) => a.round - b.round);
    const toGame = (m: MatchRow): CourtGame => ({
      id: m.id,
      round: m.round,
      playerIds: m.players.map((p) => p.signUpId),
    });
    currentByCourt.set(court, toGame(list[0]));
    upcomingByCourt.set(court, list.slice(1).map(toGame));
    for (const m of list) for (const p of m.players) reservedIds.add(p.signUpId);
  }

  // Waiting clock: latest finished-match time, else check-in time.
  const lastFinished = new Map<string, number>();
  for (const m of matches) {
    if (m.finishedAt == null) continue;
    const t = m.finishedAt.getTime();
    for (const p of m.players) {
      lastFinished.set(p.signUpId, Math.max(lastFinished.get(p.signUpId) ?? 0, t));
    }
  }

  const queue: QueuePlayer[] = pool
    .filter((s) => !reservedIds.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      skillLevel: s.skillLevel,
      waitingSince: lastFinished.get(s.id) ?? s.checkedInAt?.getTime() ?? s.createdAt.getTime(),
    }))
    .sort((a, b) => a.waitingSince - b.waitingSince || a.name.localeCompare(b.name));

  return { currentByCourt, upcomingByCourt, queue, reservedIds };
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
  | { ok: false; reason: "court_taken" | "not_enough" | "not_open" };

/**
 * Start the next game on an idle court, picking the four that make the most
 * even game (fun-first balancing) while keeping the queue fair:
 *
 * - The player who has waited longest is ALWAYS in the game.
 * - The other three come from the front window of the queue (up to 8 people),
 *   scored by: team-tier balance (club odds table: diff 0 best, 3 avoid),
 *   how far back in the queue they stand, not repeating >2 players from any
 *   earlier game together, and keeping fixed practice pairs side by side.
 */
export async function fillCourt(sessionId: string, court: number): Promise<FillResult> {
  const [session, signups, matches] = await Promise.all([
    prisma.session.findUnique({ where: { id: sessionId } }),
    prisma.signUp.findMany({ where: { sessionId }, select: SIGNUP_SELECT }),
    prisma.match.findMany({ where: { sessionId }, select: MATCH_SELECT }),
  ]);
  const state = deriveCourtState(signups as SignUpRow[], matches as MatchRow[]);

  if (session && !openCourtNumbers(session).includes(court)) return { ok: false, reason: "not_open" };
  if (state.currentByCourt.has(court)) return { ok: false, reason: "court_taken" };
  if (state.queue.length < 4) return { ok: false, reason: "not_enough" };

  const byId = new Map((signups as SignUpRow[]).map((s) => [s.id, s]));
  const toPlayer = (id: string): Player => {
    const s = byId.get(id)!;
    return { id: s.id, name: s.name, skillLevel: s.skillLevel, fixedPartnerId: s.fixedPartnerId };
  };

  const window = state.queue.slice(0, 8).map((q) => toPlayer(q.id));
  const finishedSets = (matches as MatchRow[])
    .filter((m) => m.finishedAt != null)
    .map((m) => new Set(m.players.map((p) => p.signUpId)));
  const windowIds = new Set(window.map((p) => p.id));

  let best: { four: Player[]; score: number } | null = null;
  // Front player fixed at index 0; choose the other three from the window.
  for (let i = 1; i < window.length - 2; i++)
    for (let j = i + 1; j < window.length - 1; j++)
      for (let k = j + 1; k < window.length; k++) {
        const four = [window[0], window[i], window[j], window[k]];
        const ids = new Set(four.map((p) => p.id));

        let score = i + j + k; // queue-position fairness
        const split = balanceTeams(four);
        // Balance first: even totals, then mirrored line-ups — RK+S+ vs BG+N-
        // is 5v5 on paper but plays badly, so composition mismatch costs too.
        // mismatch × 8 outweighs any queue-position cost in the window, so a
        // mirrored line-up anywhere in the window always beats a lopsided one.
        score += diffPenalty(split.diff) * 4 + split.mismatch * 8;

        // Don't rebuild an old foursome: >2 shared with any finished game.
        for (const fs of finishedSets) {
          let overlap = 0;
          for (const id of ids) if (fs.has(id)) overlap++;
          if (overlap > 2) score += 50;
        }

        // Fixed pair waiting together should go on together.
        for (const p of four) {
          if (p.fixedPartnerId && windowIds.has(p.fixedPartnerId) && !ids.has(p.fixedPartnerId)) {
            score += 20;
          }
        }

        if (!best || score < best.score) best = { four, score };
      }

  const { team1, team2 } = balanceTeams(best!.four);

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
