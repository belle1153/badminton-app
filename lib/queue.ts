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

/** Every way to choose `k` of `items`. Pools here are one session's players, so
 *  the counts stay tiny (a dozen choose three). */
function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [head, ...rest] = items;
  return [...combinations(rest, k - 1).map((c) => [head, ...c]), ...combinations(rest, k)];
}

/**
 * The `need` players who best complete `base` into a foursome — judged on the
 * same skill cost the matchmaker uses everywhere else, so a short คู่เตรียม is
 * filled with people of the right level rather than whoever is nearest.
 */
function bestFillers(
  base: Player[],
  candidates: Player[],
  need: number,
  finishedSets: Set<string>[],
  mutualPartner: Map<string, string>
): Player[] | null {
  let best: { picked: Player[]; cost: number } | null = null;
  for (const picked of combinations(candidates, need)) {
    const four = [...base, ...picked];
    const cost = foursomeCost(four, finishedSets, mutualPartner);
    if (!best || cost < best.cost) best = { picked, cost };
  }
  return best?.picked ?? null;
}

/**
 * Top up the คู่เตรียม queue (PendingPair) so it stays a stable, ordered FIFO
 * list instead of a preview that reshuffles every render. Existing คู่เตรียม are
 * never touched — once คู่ 1/2/3 are laid out they keep their members and order;
 * booking one just removes it and the rest slide up.
 *
 * Whoever is free and not already queued gets split into skill-tight foursomes
 * and appended. If 1–3 are left over (too few for a court of their own) they
 * still get a คู่เตรียม of their own rather than sitting in limbo: the empty
 * seats are filled with the best-matched players who are mid-game right now, so
 * the row reads "⏳ รอ <name> (สนาม N) จบเกม" and can't go down until they're
 * out. Returns how many new foursomes were queued.
 */
export async function syncPendingQueue(sessionId: string): Promise<number> {
  const [session, signups, matches, pendings] = await Promise.all([
    prisma.session.findUnique({ where: { id: sessionId } }),
    prisma.signUp.findMany({ where: { sessionId }, select: SIGNUP_SELECT }),
    prisma.match.findMany({ where: { sessionId }, select: MATCH_SELECT }),
    prisma.pendingPair.findMany({ where: { sessionId } }),
  ]);
  if (!session || session.status === "CLOSED") return 0;

  const rows = signups as SignUpRow[];
  const state = deriveCourtState(rows, matches as MatchRow[]);
  const alreadyQueued = new Set(pendings.flatMap((p) => [...p.team1Ids, ...p.team2Ids]));

  const byId = new Map(rows.map((s) => [s.id, s]));
  const toPlayer = (s: SignUpRow): Player => ({
    id: s.id,
    name: s.name,
    skillLevel: s.skillLevel,
    fixedPartnerId: s.fixedPartnerId,
  });
  // state.queue = checked-in, not in any unfinished match, longest wait first.
  const freeUnqueued = state.queue
    .filter((q) => !alreadyQueued.has(q.id))
    .map((q) => toPlayer(byId.get(q.id)!));
  if (freeUnqueued.length === 0) return 0;

  const finishedSets = (matches as MatchRow[])
    .filter((m) => m.finishedAt != null)
    .map((m) => new Set(m.players.map((p) => p.signUpId)));

  const queue = async (four: Player[]) => {
    const { team1, team2 } = balanceTeams(four);
    await prisma.pendingPair.create({
      data: { sessionId, team1Ids: team1.map((p) => p.id), team2Ids: team2.map((p) => p.id) },
    });
  };

  let created = 0;
  const foursomes = partitionFoursomes(freeUnqueued, finishedSets);
  for (const four of foursomes) {
    await queue(four);
    created++;
  }

  // 1–3 free players can't fill a court by themselves — hold the court for them
  // and reserve the remaining seats from the people still playing.
  const placed = new Set(foursomes.flat().map((p) => p.id));
  const leftover = freeUnqueued.filter((p) => !placed.has(p.id));
  if (leftover.length > 0 && leftover.length < 4) {
    const allPairs = mutualPairs(rows.map(toPlayer));
    // Don't earmark half of a คู่ซ้อมแข่ง: a fixed pair has to move as a unit,
    // and picking one seat at a time can't honour that.
    const busy = rows
      .filter(
        (s) =>
          state.reservedIds.has(s.id) &&
          s.checkedInAt != null &&
          s.status !== "WITHDRAWN" &&
          !alreadyQueued.has(s.id) &&
          !allPairs.has(s.id)
      )
      .map(toPlayer);
    const fillers = bestFillers(leftover, busy, 4 - leftover.length, finishedSets, allPairs);
    if (fillers) {
      await queue([...leftover, ...fillers]);
      created++;
    }
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

/**
 * Splitting a คู่ซ้อมแข่ง is not a preference, it's forbidden: a fixed pair plays
 * together every game. Skill spread is scored at courtSkillCost × 1000 and tops
 * out around 300k, so this has to sit well above that or "just a bit tighter on
 * skill" would buy the pair apart (which is exactly what a 40-point nudge did).
 */
const SPLIT_FIXED_PAIR = 1_000_000;

/** Cost of one foursome: a fixed pair may never be split; then skill spread
 *  dominates; then avoid replaying a finished game (>2 shared). `mutualPartner`
 *  only holds pairs where BOTH are in the window — a partner who isn't waiting
 *  can't be played with, so there's nothing to keep together. */
function foursomeCost(
  four: Player[],
  finishedSets: Set<string>[],
  mutualPartner: Map<string, string>
): number {
  let c = courtSkillCost(four) * 1000;
  const ids = new Set(four.map((p) => p.id));
  for (const fs of finishedSets) {
    let overlap = 0;
    for (const id of ids) if (fs.has(id)) overlap++;
    if (overlap > 2) c += 300;
  }
  for (const p of four) {
    const partner = mutualPartner.get(p.id);
    if (partner && !ids.has(partner)) c += SPLIT_FIXED_PAIR;
  }
  return c;
}

/**
 * Mutual คู่ซ้อมแข่ง among these players. Only pairs where each side names the
 * other count (the same rule balanceTeams uses), so half-set data can't quietly
 * pin someone to a partner who doesn't claim them back.
 */
function mutualPairs(players: Player[]): Map<string, string> {
  const byId = new Map(players.map((p) => [p.id, p]));
  const pairs = new Map<string, string>();
  for (const p of players) {
    const partner = p.fixedPartnerId ? byId.get(p.fixedPartnerId) : undefined;
    if (partner && partner.fixedPartnerId === p.id) pairs.set(p.id, partner.id);
  }
  return pairs;
}

/**
 * Queue order broken into units: a mutual fixed pair is ONE unit of two that can
 * never be taken apart — the rest are units of one. A unit keeps the queue
 * position of whichever of its members waited longer.
 */
function toUnits(players: Player[], pairs: Map<string, string>): Player[][] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const units: Player[][] = [];
  const placed = new Set<string>();
  for (const p of players) {
    if (placed.has(p.id)) continue;
    placed.add(p.id);
    const partnerId = pairs.get(p.id);
    const partner = partnerId ? byId.get(partnerId) : undefined;
    if (partner && !placed.has(partner.id)) {
      placed.add(partner.id);
      units.push([p, partner]);
    } else {
      units.push([p]);
    }
  }
  return units;
}

/**
 * The players who actually get queued this round: whole units in wait order, up
 * to a multiple of four. A fixed pair that won't fit in the slots left is passed
 * over — it waits as a pair rather than sending half of it down — and any short
 * tail is dropped a whole unit at a time, so the cut can never split a pair.
 */
function fillWindow(units: Player[][], capacity: number, pairs: Map<string, string>): Player[] {
  const players: Player[] = [];
  for (const u of units) {
    if (players.length + u.length <= capacity) players.push(...u);
    if (players.length === capacity) break;
  }
  while (players.length % 4 !== 0) {
    const last = players[players.length - 1];
    const partnerId = pairs.get(last.id);
    if (partnerId && players[players.length - 2]?.id === partnerId) players.splice(-2);
    else players.pop();
  }
  return players;
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
  if (window.length < 4) return [];
  const windowPairs = mutualPairs(window);
  const players = fillWindow(
    toUnits(window, windowPairs),
    Math.floor(window.length / 4) * 4,
    windowPairs
  );
  const n = players.length / 4;
  if (n === 0) return [];
  const queueIndex = new Map(players.map((p, i) => [p.id, i]));
  const mutualPartner = mutualPairs(players);
  const cost = (g: Player[]) => foursomeCost(g, finishedSets, mutualPartner);

  // Seed by skill so same-tier players cluster — but sort a fixed pair as ONE
  // block (by its average rank) instead of two loose players, or the chunking
  // below would deal them into different foursomes and leave the hill-climb to
  // undo it. Anything still split after this the swap loop fixes, since
  // SPLIT_FIXED_PAIR outweighs every skill gain.
  const units: Player[][] = [];
  const seeded = new Set<string>();
  const byId = new Map(players.map((p) => [p.id, p]));
  for (const p of players) {
    if (seeded.has(p.id)) continue;
    const partnerId = mutualPartner.get(p.id);
    const partner = partnerId ? byId.get(partnerId) : undefined;
    seeded.add(p.id);
    if (partner && !seeded.has(partner.id)) {
      seeded.add(partner.id);
      units.push([p, partner]);
    } else {
      units.push([p]);
    }
  }
  const unitRank = (u: Player[]) =>
    u.reduce((s, p) => s + SKILL_RANK[p.skillLevel], 0) / u.length;
  units.sort((a, b) => unitRank(a) - unitRank(b));
  const sorted = units.flat();

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
