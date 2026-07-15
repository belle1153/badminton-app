import { prisma } from "@/lib/db";
import { balanceTeams, courtSkillCost, SKILL_RANK, type Player, type SkillLevel } from "@/lib/matching";
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

/**
 * Top up the คู่เตรียม queue (PendingPair) so it stays a stable, ordered FIFO
 * list instead of a preview that reshuffles every render. Takes the checked-in
 * players who are free right now AND not already sitting in a คู่เตรียม, splits
 * them into skill-tight foursomes (the same partition the auto-preview used),
 * and APPENDS them to the back of the queue. Existing คู่เตรียม are never
 * touched — so once คู่ 1/2/3 are laid out they keep their members and order;
 * booking one just removes it and the rest slide up. Newcomers who check in
 * later are added behind them. Returns how many new foursomes were queued.
 */
export async function syncPendingQueue(sessionId: string): Promise<number> {
  const [session, signups, matches, pendings] = await Promise.all([
    prisma.session.findUnique({ where: { id: sessionId } }),
    prisma.signUp.findMany({ where: { sessionId }, select: SIGNUP_SELECT }),
    prisma.match.findMany({ where: { sessionId }, select: MATCH_SELECT }),
    prisma.pendingPair.findMany({ where: { sessionId } }),
  ]);
  if (!session || session.status === "CLOSED") return 0;

  const state = deriveCourtState(signups as SignUpRow[], matches as MatchRow[]);
  const alreadyQueued = new Set(pendings.flatMap((p) => [...p.team1Ids, ...p.team2Ids]));
  // state.queue = checked-in, not in any unfinished match, front (waited longest)
  // first. Drop anyone already parked in a คู่เตรียม.
  const freeUnqueued = state.queue.filter((q) => !alreadyQueued.has(q.id));
  if (freeUnqueued.length < 4) return 0;

  const byId = new Map((signups as SignUpRow[]).map((s) => [s.id, s]));
  const players: Player[] = freeUnqueued.map((q) => {
    const s = byId.get(q.id)!;
    return { id: s.id, name: s.name, skillLevel: s.skillLevel, fixedPartnerId: s.fixedPartnerId };
  });
  const finishedSets = (matches as MatchRow[])
    .filter((m) => m.finishedAt != null)
    .map((m) => new Set(m.players.map((p) => p.signUpId)));

  const foursomes = partitionFoursomes(players, finishedSets);
  let created = 0;
  for (const four of foursomes) {
    const { team1, team2 } = balanceTeams(four);
    await prisma.pendingPair.create({
      data: {
        sessionId,
        team1Ids: team1.map((p) => p.id),
        team2Ids: team2.map((p) => p.id),
      },
    });
    created++;
  }
  return created;
}

export type FillResult =
  | { ok: true; matchId: string; round: number; court: number; playerIds: string[] }
  | { ok: false; reason: "court_taken" | "not_enough" | "not_open" };

export type BookResult =
  | { ok: true; matchId: string; round: number; court: number }
  | { ok: false; status: number; error: string };

/**
 * Validate a hand-picked 2v2 and create it as a real Match — shared by the
 * "จัดลงสนามเอง" API and by promoting a คู่เตรียม (PendingPair) once every
 * player is free. When `court` is omitted, books onto the lowest-numbered
 * currently-free open court; if none is free, fails with a 409 so the caller
 * can fall back to keeping the foursome pending instead of erroring out.
 */
export async function bookFoursome(
  sessionId: string,
  team1: string[],
  team2: string[],
  court?: number
): Promise<BookResult> {
  const playerIds = [...team1, ...team2];
  if (team1.length !== 2 || team2.length !== 2 || new Set(playerIds).size !== 4) {
    return { ok: false, status: 400, error: "ต้องเลือกผู้เล่น 4 คนไม่ซ้ำกัน (ทีมละ 2 คน)" };
  }

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return { ok: false, status: 404, error: "ไม่พบรอบนี้" };
  if (session.status === "CLOSED") return { ok: false, status: 400, error: "รอบนี้ปิดแล้ว" };

  const allMatches = await prisma.match.findMany({
    where: { sessionId },
    include: { players: true },
  });

  // One pending game per person: nobody picked here may already be in an
  // unfinished match (current or upcoming) on any court.
  const booked = new Set(
    allMatches.filter((m) => m.finishedAt == null).flatMap((m) => m.players.map((p) => p.signUpId))
  );

  const signUps = await prisma.signUp.findMany({ where: { id: { in: playerIds } } });
  for (const pid of playerIds) {
    const s = signUps.find((x) => x.id === pid);
    if (!s || s.sessionId !== sessionId || s.status === "WITHDRAWN") {
      return { ok: false, status: 400, error: "มีผู้เล่นที่เลือกไม่ถูกต้อง" };
    }
    // Only people actually present may be put on a court — a not-checked-in
    // player (ยังไม่มา) must never end up in a game, no matter which path books
    // it (auto-fill, จัดคู่เตรียมเอง, or promoting a คู่เตรียม).
    if (s.checkedInAt == null) {
      return { ok: false, status: 400, error: `${s.name} ยังไม่เช็คอิน (ยังไม่มา)` };
    }
    if (booked.has(pid)) {
      return {
        ok: false,
        status: 400,
        error: `${s.name} มีเกมค้างอยู่แล้ว (กำลังเล่นหรือถูกจองคิวไว้)`,
      };
    }
  }

  const busyCourts = new Set(allMatches.filter((m) => m.finishedAt == null).map((m) => m.court));
  let finalCourt = court;
  if (finalCourt == null) {
    const free = openCourtNumbers(session)
      .filter((c) => !busyCourts.has(c))
      .sort((a, b) => a - b);
    if (free.length === 0) return { ok: false, status: 409, error: "ยังไม่มีสนามว่าง" };
    finalCourt = free[0];
  } else {
    if (!Number.isInteger(finalCourt) || finalCourt < 1 || finalCourt > 6) {
      return { ok: false, status: 400, error: "สนามไม่ถูกต้อง" };
    }
    // Courts run one game at a time: refuse if this court is already playing.
    if (busyCourts.has(finalCourt)) {
      return {
        ok: false,
        status: 400,
        error: `สนาม ${finalCourt} กำลังเล่นอยู่ — รอสนามว่างก่อนครับ`,
      };
    }
  }

  // Next game number for this court.
  const round =
    allMatches.filter((m) => m.court === finalCourt).reduce((max, m) => Math.max(max, m.round), 0) + 1;

  const created = await prisma.match.create({
    data: {
      sessionId,
      round,
      court: finalCourt,
      players: {
        create: [
          ...team1.map((pid) => ({ signUpId: pid, team: 1 })),
          ...team2.map((pid) => ({ signUpId: pid, team: 2 })),
        ],
      },
    },
  });

  return { ok: true, matchId: created.id, round, court: finalCourt };
}

/** Cost of one foursome: skill spread dominates; avoid replaying a finished
 *  game (>2 shared); keep a fixed pair whose partner is waiting together. */
function foursomeCost(four: Player[], finishedSets: Set<string>[], windowIds: Set<string>): number {
  let c = courtSkillCost(four) * 1000;
  const ids = new Set(four.map((p) => p.id));
  for (const fs of finishedSets) {
    let overlap = 0;
    for (const id of ids) if (fs.has(id)) overlap++;
    if (overlap > 2) c += 300;
  }
  for (const p of four) {
    if (p.fixedPartnerId && windowIds.has(p.fixedPartnerId) && !ids.has(p.fixedPartnerId)) c += 40;
  }
  return c;
}

/**
 * Partition the front of the queue into skill-tight foursomes, GLOBALLY (not
 * one court at a time). Filling greedily per court breaks up natural clusters —
 * e.g. it will pull one BG into an RK court and leave a lone strong player with
 * three weak ones. Partitioning the whole front window keeps same-tier players
 * together (4 BG on one court, 4 RK on another, the two odd ones paired so their
 * teams still mirror), which is what actually plays balanced.
 *
 * Heuristic: seed by sorting on skill rank and chunking, then hill-climb with
 * 1-for-1 swaps between foursomes until no swap lowers the total cost. Foursomes
 * come back ordered by their longest-waiting member, so the first is what fills
 * the next free court.
 */
export function partitionFoursomes(window: Player[], finishedSets: Set<string>[] = []): Player[][] {
  const n = Math.floor(window.length / 4);
  if (n === 0) return [];
  const players = window.slice(0, n * 4);
  const queueIndex = new Map(players.map((p, i) => [p.id, i]));
  const windowIds = new Set(players.map((p) => p.id));
  const cost = (g: Player[]) => foursomeCost(g, finishedSets, windowIds);

  const sorted = [...players].sort((a, b) => SKILL_RANK[a.skillLevel] - SKILL_RANK[b.skillLevel]);
  const groups: Player[][] = [];
  for (let g = 0; g < n; g++) groups.push(sorted.slice(g * 4, g * 4 + 4));

  // Swap sets of indices to try between two groups. Size 1 alone can get stuck
  // (e.g. can't turn {2BG,2N}+{2RK,2BG} into {4BG}+{2RK,2N} one at a time), so
  // also try 2-for-2 swaps.
  const combos1 = [[0], [1], [2], [3]];
  const combos2 = [
    [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
  ];
  let improved = true;
  while (improved) {
    improved = false;
    for (let g1 = 0; g1 < n; g1++)
      for (let g2 = g1 + 1; g2 < n; g2++) {
        for (const combos of [combos1, combos2])
          for (const s1 of combos)
            for (const s2 of combos) {
              const before = cost(groups[g1]) + cost(groups[g2]);
              const a = [...groups[g1]];
              const b = [...groups[g2]];
              for (let t = 0; t < s1.length; t++) {
                const tmp = a[s1[t]];
                a[s1[t]] = b[s2[t]];
                b[s2[t]] = tmp;
              }
              if (cost(a) + cost(b) < before) {
                groups[g1] = a;
                groups[g2] = b;
                improved = true;
              }
            }
      }
  }

  groups.sort(
    (a, b) =>
      Math.min(...a.map((p) => queueIndex.get(p.id)!)) -
      Math.min(...b.map((p) => queueIndex.get(p.id)!))
  );
  return groups;
}

/**
 * The next games the queue will produce (คู่เตรียม), up to `max`. Uses the same
 * global partition fillCourt draws from, so the preview matches what runs.
 */
export function previewFoursomes(
  queue: Player[],
  finishedSets: Set<string>[],
  max: number
): Player[][] {
  const n = Math.min(max, Math.floor(queue.length / 4));
  if (n === 0) return [];
  return partitionFoursomes(queue.slice(0, n * 4), finishedSets);
}

/**
 * Start the next game on an idle court with the four pickFoursome chooses:
 * closest skill first, then queue fairness, then team balance. The person who
 * has waited longest is always in the game.
 */
export async function fillCourt(sessionId: string, court: number): Promise<FillResult> {
  const [session, signups, matches, pendings] = await Promise.all([
    prisma.session.findUnique({ where: { id: sessionId } }),
    prisma.signUp.findMany({ where: { sessionId }, select: SIGNUP_SELECT }),
    prisma.match.findMany({ where: { sessionId }, select: MATCH_SELECT }),
    prisma.pendingPair.findMany({ where: { sessionId }, select: { team1Ids: true, team2Ids: true } }),
  ]);
  const state = deriveCourtState(signups as SignUpRow[], matches as MatchRow[]);

  if (session && !openCourtNumbers(session).includes(court)) return { ok: false, reason: "not_open" };
  if (state.currentByCourt.has(court)) return { ok: false, reason: "court_taken" };

  // Don't auto-pull anyone already lined up in a คู่เตรียม — they leave the free
  // queue when their prepared game is booked, not by a random fill.
  const queuedInPending = new Set(pendings.flatMap((p) => [...p.team1Ids, ...p.team2Ids]));
  const freeQueue = state.queue.filter((q) => !queuedInPending.has(q.id));
  if (freeQueue.length < 4) return { ok: false, reason: "not_enough" };

  const byId = new Map((signups as SignUpRow[]).map((s) => [s.id, s]));
  const toPlayer = (id: string): Player => {
    const s = byId.get(id)!;
    return { id: s.id, name: s.name, skillLevel: s.skillLevel, fixedPartnerId: s.fixedPartnerId };
  };

  const windowPlayers = freeQueue.map((q) => toPlayer(q.id));
  const finishedSets = (matches as MatchRow[])
    .filter((m) => m.finishedAt != null)
    .map((m) => new Set(m.players.map((p) => p.signUpId)));

  // Fill this court with the front cluster of the global partition, so a single
  // fill and the คู่เตรียม preview stay consistent and well balanced.
  const four = partitionFoursomes(windowPlayers, finishedSets)[0];
  if (!four) return { ok: false, reason: "not_enough" };
  const { team1, team2 } = balanceTeams(four);

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
