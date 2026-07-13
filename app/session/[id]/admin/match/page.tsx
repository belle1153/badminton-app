import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { deriveCourtState } from "@/lib/queue";
import { type SkillLevel } from "@/lib/matching";
import CourtCountEditor from "../CourtCountEditor";
import MatchControls from "../MatchControls";
import LiveCourts, { type LiveMatch, type FinishedGame } from "../LiveCourts";
import MatchEditor from "../MatchEditor";

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
    orderBy: [{ round: "asc" }, { court: "asc" }],
  });

  const confirmedSignUps = session.signUps.filter((s) => s.status === "CONFIRMED");

  // Pool eligible for placing into matches: everyone confirmed, plus
  // waitlisted people who checked in.
  const swappablePool = session.signUps
    .filter((s) => s.status === "CONFIRMED" || (s.status === "WAITLIST" && s.checkedInAt != null))
    .map((s) => ({ id: s.id, name: s.name, skillLevel: s.skillLevel, waitlist: s.status === "WAITLIST" }));

  const roundsMap = new Map<number, typeof matches>();
  for (const m of matches) {
    const list = roundsMap.get(m.round) ?? [];
    list.push(m);
    roundsMap.set(m.round, list);
  }
  const rounds = [...roundsMap.entries()].sort((a, b) => a[0] - b[0]);

  const editorRounds = rounds.map(([round, roundMatches]) => {
    const roundMatchInfos = roundMatches.map((m) => ({
      id: m.id,
      court: m.court,
      team1: m.players
        .filter((p) => p.team === 1)
        .map((p) => ({ id: p.signUp.id, name: p.signUp.name, skillLevel: p.signUp.skillLevel })),
      team2: m.players
        .filter((p) => p.team === 2)
        .map((p) => ({ id: p.signUp.id, name: p.signUp.name, skillLevel: p.signUp.skillLevel })),
    }));
    const playingIds = new Set(roundMatchInfos.flatMap((m) => [...m.team1, ...m.team2].map((p) => p.id)));
    const substitutes = swappablePool.filter((s) => !playingIds.has(s.id));
    const usedCourts = new Set(roundMatchInfos.map((m) => m.court));
    const emptyCourts = [1, 2, 3, 4, 5, 6].filter((c) => !usedCourts.has(c));
    return { round, matches: roundMatchInfos, substitutes, emptyCourts };
  });

  const everPlayedIds = new Set(matches.flatMap((m) => m.players.map((p) => p.signUpId)));
  const neverPlayed = swappablePool.filter((s) => !everPlayedIds.has(s.id));

  // Live board: current game per court (latest match, active only if
  // unfinished), waiting queue, and recently finished games with winners.
  const latestByCourt = new Map<number, (typeof matches)[number]>();
  for (const m of matches) {
    const cur = latestByCourt.get(m.court);
    if (!cur || m.round > cur.round) latestByCourt.set(m.court, m);
  }
  const liveMatches: LiveMatch[] = [...latestByCourt.values()]
    .filter((m) => m.finishedAt == null)
    .map((m) => ({
      id: m.id,
      court: m.court,
      round: m.round,
      team1: m.players.filter((p) => p.team === 1).map((p) => ({ id: p.signUp.id, name: p.signUp.name })),
      team2: m.players.filter((p) => p.team === 2).map((p) => ({ id: p.signUp.id, name: p.signUp.name })),
    }));

  const liveState = deriveCourtState(
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
  const liveQueue = liveState.queue.map((q) => ({ id: q.id, name: q.name }));

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
        winnerNames: m.winnerTeam === 1 ? t1 : t2,
        loserNames: m.winnerTeam === 1 ? t2 : t1,
      };
    });

  return (
    <>
      {session.status === "OPEN" && (
        <CourtCountEditor sessionId={id} courtsEarly={session.courtsEarly} courtsLate={session.courtsLate} />
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

      {session.status === "OPEN" && (
        <LiveCourts
          sessionId={id}
          courts={session.courtsLate}
          activeMatches={liveMatches}
          queue={liveQueue}
          recentFinished={recentFinished}
        />
      )}

      {editorRounds.length > 0 && session.status === "OPEN" && (
        <MatchEditor sessionId={id} rounds={editorRounds} neverPlayed={neverPlayed} />
      )}

      {rounds.length > 0 && session.status === "CLOSED" && (
        <section>
          <h2 className="font-semibold mb-2">ประวัติรอบ</h2>
          <div className="flex flex-col gap-4">
            {rounds.map(([round, roundMatches]) => (
              <div key={round}>
                <h3 className="text-sm font-medium text-gray-600 mb-1">รอบที่ {round}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {roundMatches.map((m) => (
                    <div key={m.id} className="rounded-md border border-gray-200 p-2 text-sm">
                      <div className="text-xs text-gray-400 mb-1">สนาม {m.court}</div>
                      <div>{m.players.filter((p) => p.team === 1).map((p) => p.signUp.name).join(" + ")}</div>
                      <div className="text-gray-400 text-xs my-0.5">vs</div>
                      <div>{m.players.filter((p) => p.team === 2).map((p) => p.signUp.name).join(" + ")}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
