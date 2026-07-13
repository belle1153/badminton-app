import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { deriveCourtState } from "@/lib/queue";
import { type SkillLevel } from "@/lib/matching";
import SelfCourtBanner from "../../../SelfCourtBanner";
import CourtGrid from "../../../CourtGrid";
import QueueList from "../../../QueueList";

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
  const courts = Array.from({ length: session.courtsLate }, (_, i) => {
    const court = i + 1;
    const cur = liveState.currentByCourt.get(court);
    const ups = (liveState.upcomingByCourt.get(court) ?? []).slice(0, 2);
    return {
      court,
      match: cur ? toTeamMatch(matchById.get(cur.id)!) : null,
      upcoming: ups.map((g) => toTeamMatch(matchById.get(g.id)!)),
    };
  });

  const queue = liveState.queue.map((q) => ({ id: q.id, name: q.name }));

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
          <h2 className="font-semibold">คิวรอลงสนาม</h2>
          <span className="text-sm text-gray-400">พักนานสุดได้ลงก่อน</span>
        </div>
        <QueueList sessionId={id} queue={queue} />
      </section>
    </>
  );
}
