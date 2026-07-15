import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { deriveCourtState } from "@/lib/queue";
import { openCourtNumbers } from "@/lib/billing";
import { type SkillLevel } from "@/lib/matching";
import { buildCourtBoard } from "@/lib/courtBoard";
import SelfCourtBanner from "../../../SelfCourtBanner";
import CourtGrid from "../../../CourtGrid";
import QueuePairs from "../../../QueuePairs";

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
      pendingPairs: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  });

  if (!session) notFound();

  const signUps = session.signUps.map((s) => ({
    id: s.id,
    name: s.name,
    skillLevel: s.skillLevel as SkillLevel,
    fixedPartnerId: s.fixedPartnerId,
    checkedInAt: s.checkedInAt,
    createdAt: s.createdAt,
    status: s.status,
  }));

  // Per-court flow: current game = lowest-numbered unfinished match on that
  // court; the rest are pre-queued upcoming games. Needed here (in addition
  // to buildCourtBoard below) only to flag which matches are "active" for the
  // "which court am I on?" search, which covers ALL matches — not just the
  // current-per-court board buildCourtBoard returns.
  const liveState = deriveCourtState(
    signUps,
    session.matches.map((m) => ({
      id: m.id,
      round: m.round,
      court: m.court,
      finishedAt: m.finishedAt,
      players: m.players.map((p) => ({ signUpId: p.signUpId })),
    }))
  );
  const activeIds = new Set([...liveState.currentByCourt.values()].map((g) => g.id));
  const allMatches = session.matches.map((m) => ({
    round: m.round,
    court: m.court,
    active: activeIds.has(m.id),
    team1: m.players.filter((p) => p.team === 1).map((p) => ({ id: p.signUp.id, name: p.signUp.name })),
    team2: m.players.filter((p) => p.team === 2).map((p) => ({ id: p.signUp.id, name: p.signUp.name })),
  }));

  const board = buildCourtBoard(
    signUps,
    session.matches,
    openCourtNumbers(session),
    session.pendingPairs
  );

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
          <CourtGrid sessionId={id} courts={board.courts} />
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">คู่เตรียม</h2>
          <span className="text-sm text-gray-400">คิว {board.queueCount} คน</span>
        </div>
        <QueuePairs sessionId={id} matchups={board.matchups} />
      </section>

      {board.finished.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">ประวัติเกม</h2>
          {board.historyCourts.map((court) => (
            <div key={court} className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-gray-600">สนาม {court}</h3>
              <ul className="flex flex-col divide-y divide-gray-100 border border-gray-100 rounded-md">
                {board.finished
                  .filter((m) => m.court === court)
                  .map((m) => {
                    const t1 = m.team1.map((p) => p.name);
                    const t2 = m.team2.map((p) => p.name);
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
