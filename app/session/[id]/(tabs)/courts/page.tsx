import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { deriveCourtState, previewFoursomes } from "@/lib/queue";
import { openCourtNumbers } from "@/lib/billing";
import { balanceTeams, type Player, type SkillLevel } from "@/lib/matching";
import SelfCourtBanner from "../../../SelfCourtBanner";
import CourtGrid from "../../../CourtGrid";
import QueuePairs, { type QueueMatchup } from "../../../QueuePairs";

export const dynamic = "force-dynamic";

export default async function SessionCourtsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      signUps: { where: { status: { not: "WITHDRAWN" } } },
      matches: {
        include: {
          players: {
            include: { signUp: { include: { athlete: { select: { photoUrl: true } } } } },
          },
        },
        orderBy: { round: "asc" },
      },
    },
  });

  if (!session) notFound();

  // Per-court flow: current game = lowest-numbered unfinished match on that
  // court; the rest are pre-queued upcoming games.
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
    session.matches.map((m) => ({
      id: m.id,
      round: m.round,
      court: m.court,
      finishedAt: m.finishedAt,
      players: m.players.map((p) => ({ signUpId: p.signUpId })),
    }))
  );
  const activeIds = new Set([...liveState.currentByCourt.values()].map((g) => g.id));

  const toTeamMatch = (m: (typeof session.matches)[number]) => ({
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

  // All matches feed the "which court am I on?" search; the board shows each
  // court's current game plus up to two pre-queued next games.
  const allMatches = session.matches.map(toTeamMatch);
  const matchById = new Map(session.matches.map((m) => [m.id, m]));
  // Show the courts open right now (admin's open set, or the clock default),
  // plus any court that still has a live/queued game so it's never hidden.
  const occupied = new Set<number>([
    ...liveState.currentByCourt.keys(),
    ...liveState.upcomingByCourt.keys(),
  ]);
  const courtNums = [...new Set([...openCourtNumbers(session), ...occupied])].sort((a, b) => a - b);
  const courts = courtNums.map((court) => {
    const cur = liveState.currentByCourt.get(court);
    return { court, match: cur ? toTeamMatch(matchById.get(cur.id)!) : null };
  });

  // Show the queue as prepared pairs: each block of four (in wait order) is
  // split into its two balanced teams, so people see who they'll pair with.
  const signUpById = new Map(session.signUps.map((s) => [s.id, s]));
  const queuePlayers: Player[] = liveState.queue.map((q) => {
    const s = signUpById.get(q.id)!;
    return { id: s.id, name: s.name, skillLevel: s.skillLevel as SkillLevel, fixedPartnerId: s.fixedPartnerId };
  });
  // Up to 3 upcoming matchups, chosen by the SAME picker fillCourt uses so the
  // preview matches the games that actually run (closest skill, then queue).
  const finishedSets = session.matches
    .filter((m) => m.finishedAt != null)
    .map((m) => new Set(m.players.map((p) => p.signUp.id)));
  const matchups: QueueMatchup[] = previewFoursomes(queuePlayers, finishedSets, 3).map((four, i) => {
    const { team1, team2 } = balanceTeams(four);
    return {
      key: `m-${i}`,
      teamA: team1.map((p) => ({ id: p.id, name: p.name })),
      teamB: team2.map((p) => ({ id: p.id, name: p.name })),
    };
  });

  // Read-only game log per court (finished games with results).
  const finished = session.matches
    .filter((m) => m.finishedAt != null)
    .sort((a, b) => a.court - b.court || a.round - b.round);
  const historyCourts = [...new Set(finished.map((m) => m.court))];

  return (
    <>
      <SelfCourtBanner matches={allMatches} />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">สนามทั้งหมด</h2>
          <span className="text-sm text-gray-400">กำลังเล่นตอนนี้</span>
        </div>

        {session.matches.length === 0 ? (
          <p className="text-gray-500 text-sm">ยังไม่มีการจับคู่</p>
        ) : (
          <CourtGrid sessionId={id} courts={courts} />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">คู่เตรียม</h2>
          <span className="text-sm text-gray-400">คิว {queuePlayers.length} คน</span>
        </div>
        <QueuePairs sessionId={id} matchups={matchups} />
      </section>

      {finished.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">ประวัติเกม</h2>
          {historyCourts.map((court) => (
            <div key={court} className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-gray-600">สนาม {court}</h3>
              <ul className="flex flex-col divide-y divide-gray-100 border border-gray-100 rounded-md">
                {finished
                  .filter((m) => m.court === court)
                  .map((m) => {
                    const t1 = m.players.filter((p) => p.team === 1).map((p) => p.signUp.name);
                    const t2 = m.players.filter((p) => p.team === 2).map((p) => p.signUp.name);
                    return (
                      <li key={m.id} className="px-2.5 py-1.5 text-sm flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-400 shrink-0 w-12">เกม {m.round}</span>
                        <span className={m.winnerTeam === 1 ? "font-semibold text-brand-700" : "text-gray-600"}>
                          {t1.join(" + ")}
                          {m.winnerTeam === 1 && " ✓"}
                        </span>
                        <span className="text-gray-300 text-xs">vs</span>
                        <span className={m.winnerTeam === 2 ? "font-semibold text-brand-700" : "text-gray-600"}>
                          {t2.join(" + ")}
                          {m.winnerTeam === 2 && " ✓"}
                        </span>
                        {m.winnerTeam == null && (
                          <span className="text-[10px] rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5">
                            🤝 เสมอ
                          </span>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
