import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { deriveCourtState } from "@/lib/queue";
import { type SkillLevel } from "@/lib/matching";
import CourtCountEditor from "../CourtCountEditor";
import MatchControls from "../MatchControls";
import LiveCourts, { type LiveMatch, type FinishedGame } from "../LiveCourts";

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
    return {
      id: m.id,
      court,
      round: m.round,
      team1: m.players.filter((p) => p.team === 1).map((p) => ({ id: p.signUp.id, name: p.signUp.name })),
      team2: m.players.filter((p) => p.team === 2).map((p) => ({ id: p.signUp.id, name: p.signUp.name })),
    };
  };

  const liveMatches: LiveMatch[] = [...state.currentByCourt.entries()].map(([court, g]) =>
    toLive(g, court)
  );
  const upcomingMatches: LiveMatch[] = [...state.upcomingByCourt.entries()].flatMap(([court, list]) =>
    list.map((g) => toLive(g, court))
  );
  const liveQueue = state.queue.map((q) => ({ id: q.id, name: q.name }));

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
          courts={session.courtsLate}
          activeMatches={liveMatches}
          upcomingMatches={upcomingMatches}
          queue={liveQueue}
          recentFinished={recentFinished}
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
        sessionCourts={session.courtsLate}
        hasMatches={matches.length > 0}
      />
    </>
  );
}
