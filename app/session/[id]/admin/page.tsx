import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import PinGate from "@/app/admin/PinGate";
import AdminPanel from "./AdminPanel";
import MatchEditor from "./MatchEditor";
import CheckInList from "./CheckInList";
import RegistrationToggle from "./RegistrationToggle";
import CourtCountEditor from "./CourtCountEditor";
import LiveCourts, { type LiveMatch, type FinishedGame } from "./LiveCourts";
import { deriveCourtState } from "@/lib/queue";
import { type SkillLevel } from "@/lib/matching";

export default async function SessionAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!(await isAdmin())) {
    return <PinGate />;
  }

  const [session, courtRates, shuttlecockTypes, matches] = await Promise.all([
    prisma.session.findUnique({
      where: { id },
      include: {
        signUps: {
          where: { status: { not: "WITHDRAWN" } },
          orderBy: [{ status: "asc" }, { slotNumber: "asc" }, { createdAt: "asc" }],
        },
      },
    }),
    prisma.courtRate.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.shuttlecockType.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.match.findMany({
      where: { sessionId: id },
      include: { players: { include: { signUp: true } } },
      orderBy: [{ round: "asc" }, { court: "asc" }],
    }),
  ]);

  if (!session) notFound();

  const roundsMap = new Map<number, typeof matches>();
  for (const m of matches) {
    const list = roundsMap.get(m.round) ?? [];
    list.push(m);
    roundsMap.set(m.round, list);
  }
  const rounds = [...roundsMap.entries()].sort((a, b) => a[0] - b[0]);
  const confirmedSignUps = session.signUps.filter((s) => s.status === "CONFIRMED");

  // Pool eligible for placing into matches: everyone confirmed, plus
  // waitlisted people who actually showed up (checked in).
  const swappablePool = session.signUps
    .filter((s) => s.status === "CONFIRMED" || (s.status === "WAITLIST" && s.checkedInAt != null))
    .map((s) => ({
      id: s.id,
      name: s.name,
      skillLevel: s.skillLevel,
      waitlist: s.status === "WAITLIST",
    }));

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
    const playingIds = new Set(
      roundMatchInfos.flatMap((m) => [...m.team1, ...m.team2].map((p) => p.id))
    );
    const substitutes = swappablePool.filter((s) => !playingIds.has(s.id));
    const usedCourts = new Set(roundMatchInfos.map((m) => m.court));
    const emptyCourts = [1, 2, 3, 4, 5, 6].filter((c) => !usedCourts.has(c));
    return { round, matches: roundMatchInfos, substitutes, emptyCourts };
  });

  const everPlayedIds = new Set(
    matches.flatMap((m) => m.players.map((p) => p.signUpId))
  );
  const neverPlayed = swappablePool.filter((s) => !everPlayedIds.has(s.id));

  // Live board: current game per court (latest unfinished), waiting queue, and
  // the most recently finished games with their recorded winners.
  const activeByCourt = new Map<number, (typeof matches)[number]>();
  for (const m of matches) {
    if (m.finishedAt != null) continue;
    const cur = activeByCourt.get(m.court);
    if (!cur || m.round > cur.round) activeByCourt.set(m.court, m);
  }
  const liveMatches: LiveMatch[] = [...activeByCourt.values()].map((m) => ({
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
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-sm text-gray-500 hover:underline">
          ← กลับไปแผงแอดมิน
        </Link>
        <Link
          href={`/session/${id}`}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 text-gray-600 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 hover:text-brand-700"
        >
          🧑 ดูหน้า User
        </Link>
      </div>
      <h1 className="text-xl font-bold">
        แอดมิน: {session.venue}{" "}
        {session.status === "CLOSED" && (
          <span className="text-xs rounded-full bg-gray-200 text-gray-600 px-2 py-0.5 align-middle">
            ปิดแล้ว
          </span>
        )}
      </h1>
      {session.status === "OPEN" && (
        <RegistrationToggle sessionId={id} registrationClosed={session.registrationClosedAt != null} />
      )}

      {session.status === "OPEN" && (
        <CourtCountEditor
          sessionId={id}
          courtsEarly={session.courtsEarly}
          courtsLate={session.courtsLate}
        />
      )}

      <CheckInList
        sessionId={id}
        signUps={session.signUps.map((s) => ({
          id: s.id,
          name: s.name,
          skillLevel: s.skillLevel,
          status: s.status as "CONFIRMED" | "WAITLIST",
          checkedInAt: s.checkedInAt ? s.checkedInAt.toISOString() : null,
        }))}
      />

      <AdminPanel
        sessionId={id}
        status={session.status}
        confirmedSignUps={confirmedSignUps.map((s) => ({
          id: s.id,
          name: s.name,
          skillLevel: s.skillLevel,
          fixedPartnerId: s.fixedPartnerId,
          checkedIn: s.checkedInAt != null,
        }))}
        courtRates={courtRates}
        shuttlecockTypes={shuttlecockTypes}
        closedSummary={
          session.status === "CLOSED"
            ? {
                courtCost: session.courtCost,
                shuttlecockCost: session.shuttlecockCost,
                totalCost: session.totalCost,
              }
            : null
        }
        hasMatches={matches.length > 0}
        sessionCourts={session.courtsLate}
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
    </main>
  );
}
