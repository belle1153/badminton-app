import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { deriveCourtState, readyPendingCount } from "@/lib/queue";
import { openCourtNumbers } from "@/lib/billing";
import { type SkillLevel } from "@/lib/matching";
import CourtCountEditor from "../CourtCountEditor";
import MatchControls from "../MatchControls";
import LiveCourts, { type LiveMatch, type FinishedGame } from "../LiveCourts";
import UpcomingPlanner from "../UpcomingPlanner";

export const dynamic = "force-dynamic";

export default async function SessionMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await isAdmin())) return null; // layout renders the PIN gate

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      signUps: {
        where: { status: { not: "WITHDRAWN" } },
        orderBy: [{ status: "asc" }, { slotNumber: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!session) return null;

  const matches = await prisma.match.findMany({
    where: { sessionId: id },
    include: { players: { include: { signUp: true } } },
    orderBy: [{ court: "asc" }, { round: "asc" }],
  });

  const confirmedSignUps = session.signUps.filter((s) => s.status === "CONFIRMED");

  const state = deriveCourtState(
    session.signUps.map((s) => ({
      id: s.id,
      name: s.name,
      skillLevel: s.skillLevel as SkillLevel,
      fixedPartnerId: s.fixedPartnerId,
      checkedInAt: s.checkedInAt,
      createdAt: s.createdAt,
      status: s.status,
    })),
    matches.map((m) => ({
      id: m.id,
      round: m.round,
      court: m.court,
      finishedAt: m.finishedAt,
      players: m.players.map((p) => ({ signUpId: p.signUpId })),
    }))
  );

  const matchById = new Map(matches.map((m) => [m.id, m]));
  const toLive = (game: { id: string; round: number }, court: number): LiveMatch => {
    const m = matchById.get(game.id)!;
    const toP = (p: (typeof m.players)[number]) => ({
      id: p.signUp.id,
      name: p.signUp.name,
      skillLevel: p.signUp.skillLevel,
    });
    return {
      id: m.id,
      court,
      round: m.round,
      team1: m.players.filter((p) => p.team === 1).map(toP),
      team2: m.players.filter((p) => p.team === 2).map(toP),
      startedAt: m.createdAt.toISOString(),
    };
  };

  // Court a person is playing on RIGHT NOW (for the swap pool tag / pull).
  const currentCourtBySignUp = new Map<string, number>();
  for (const [court, g] of state.currentByCourt) for (const pid of g.playerIds) currentCourtBySignUp.set(pid, court);

  // Swap pool for editing live games: everyone checked in. Free players first
  // (A-Z), then people mid-game (A-Z) so the admin can pull someone off a court
  // that's about to finish into another game — the two just swap courts.
  const substitutes = session.signUps
    .filter((s) => s.status === "CONFIRMED" || (s.status === "WAITLIST" && s.checkedInAt != null))
    .map((s) => ({
      id: s.id,
      name: s.name,
      skillLevel: s.skillLevel,
      waitlist: s.status === "WAITLIST",
      busyCourt: currentCourtBySignUp.get(s.id) ?? null,
    }))
    .sort(
      (a, b) =>
        (a.busyCourt == null ? 0 : 1) - (b.busyCourt == null ? 0 : 1) ||
        a.name.localeCompare(b.name, "th")
    );

  const liveMatches: LiveMatch[] = [...state.currentByCourt.entries()].map(([court, g]) =>
    toLive(g, court)
  );
  const upcomingMatches: LiveMatch[] = [...state.upcomingByCourt.entries()].flatMap(([court, list]) =>
    list.map((g) => toLive(g, court))
  );

  const signUpById = new Map(session.signUps.map((s) => [s.id, s]));
  const openCts = openCourtNumbers(session);
  const freeCts = openCts.filter((c) => !state.currentByCourt.has(c));

  // Every checked-in person, tagged with the court they're currently playing
  // on (if any) — the pool for คู่เตรียม's ✎ swap and "จัดคู่เตรียมเอง", so the
  // admin can earmark someone still mid-game for the next foursome.
  const busyCourtBySignUp = new Map<string, number>();
  for (const [court, g] of state.currentByCourt) for (const pid of g.playerIds) busyCourtBySignUp.set(pid, court);
  for (const [court, list] of state.upcomingByCourt)
    for (const g of list) for (const pid of g.playerIds) if (!busyCourtBySignUp.has(pid)) busyCourtBySignUp.set(pid, court);

  const candidates = session.signUps
    .filter((s) => s.checkedInAt != null && (s.status === "CONFIRMED" || s.status === "WAITLIST"))
    .map((s) => ({
      id: s.id,
      name: s.name,
      skillLevel: s.skillLevel as SkillLevel,
      busyCourt: busyCourtBySignUp.get(s.id) ?? null,
    }))
    // Free (not mid-game) players first, then A-Z — easy to pick from when
    // editing a คู่เตรียม.
    .sort(
      (a, b) =>
        (a.busyCourt == null ? 0 : 1) - (b.busyCourt == null ? 0 : 1) ||
        a.name.localeCompare(b.name, "th")
    );

  // คู่เตรียม is now a persisted, ordered FIFO queue (PendingPair). Render it in
  // order; each player carries their skill + the court they're mid-game on.
  const pendingPairRows = await prisma.pendingPair.findMany({
    where: { sessionId: id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const toLite = (pid: string) => {
    const s = signUpById.get(pid);
    return s
      ? {
          id: s.id,
          name: s.name,
          skillLevel: s.skillLevel as SkillLevel,
          busyCourt: busyCourtBySignUp.get(s.id) ?? null,
          present: s.checkedInAt != null,
        }
      : { id: pid, name: "(ไม่พบชื่อ)", skillLevel: "RK" as SkillLevel, busyCourt: null, present: false };
  };
  const pendingPairs = pendingPairRows.map((p) => ({
    id: p.id,
    team1: p.team1Ids.map(toLite),
    team2: p.team2Ids.map(toLite),
  }));

  // Free (checked-in, not playing) players who aren't parked in a คู่เตรียม yet
  // — the client uses this signature to top the queue up when it changes.
  const queuedIds = new Set(pendingPairRows.flatMap((p) => [...p.team1Ids, ...p.team2Ids]));
  const freeUnqueuedIds = state.queue.map((q) => q.id).filter((qid) => !queuedIds.has(qid));
  const freeUnqueuedSignature = [...freeUnqueuedIds].sort().join(",");

  // The admin "คิวรอลงสนาม" list = genuinely-waiting players, i.e. those not yet
  // lined up in a คู่เตรียม — the ones "จัดคู่เตรียมจากคิว" would pick up.
  const liveQueue = state.queue
    .filter((q) => !queuedIds.has(q.id))
    .map((q) => ({ id: q.id, name: q.name }));

  // Courts are filled from คู่เตรียม — this is what the fill buttons act on.
  const readyCount = await readyPendingCount(id);

  const recentFinished: FinishedGame[] = matches
    .filter((m) => m.finishedAt != null)
    .sort((a, b) => b.finishedAt!.getTime() - a.finishedAt!.getTime())
    .slice(0, 6)
    .map((m) => {
      const t1 = m.players.filter((p) => p.team === 1).map((p) => p.signUp.name);
      const t2 = m.players.filter((p) => p.team === 2).map((p) => p.signUp.name);
      return {
        id: m.id,
        court: m.court,
        winnerNames: m.winnerTeam === 2 ? t2 : t1,
        loserNames: m.winnerTeam === 2 ? t1 : t2,
        draw: m.winnerTeam == null,
      };
    });

  return (
    <>
      {session.status === "OPEN" && (
        <CourtCountEditor sessionId={id} courtsEarly={session.courtsEarly} courtsLate={session.courtsLate} />
      )}

      {session.status === "OPEN" && (
        <LiveCourts
          sessionId={id}
          openCourts={openCourtNumbers(session)}
          maxCourts={Math.max(
            6,
            [...liveMatches, ...upcomingMatches].reduce((max, m) => Math.max(max, m.court), 0)
          )}
          courtsLimit={session.courtsLate}
          isAuto={session.openCourts == null}
          activeMatches={liveMatches}
          queue={liveQueue}
          readyPendingCount={readyCount}
          recentFinished={recentFinished}
          substitutes={substitutes}
        />
      )}

      {session.status === "OPEN" && (
        <UpcomingPlanner
          sessionId={id}
          candidates={candidates}
          pendingPairs={pendingPairs}
          freeCourts={freeCts}
          freeUnqueuedSignature={freeUnqueuedSignature}
        />
      )}

      <MatchControls
        sessionId={id}
        status={session.status}
        confirmedSignUps={confirmedSignUps.map((s) => ({
          id: s.id,
          name: s.name,
          skillLevel: s.skillLevel,
          fixedPartnerId: s.fixedPartnerId,
          checkedIn: s.checkedInAt != null,
        }))}
        hasMatches={matches.length > 0}
      />
    </>
  );
}
