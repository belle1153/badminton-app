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
        include: { players: { include: { signUp: true } } },
        orderBy: { round: "asc" },
      },
    },
  });

  if (!session) notFound();

  // The game "on court now" is each court's latest match that hasn't finished.
  const activeByCourt = new Map<number, (typeof session.matches)[number]>();
  for (const m of session.matches) {
    if (m.finishedAt != null) continue;
    const cur = activeByCourt.get(m.court);
    if (!cur || m.round > cur.round) activeByCourt.set(m.court, m);
  }
  const activeIds = new Set([...activeByCourt.values()].map((m) => m.id));

  const toTeamMatch = (m: (typeof session.matches)[number]) => ({
    id: m.id,
    round: m.round,
    court: m.court,
    active: activeIds.has(m.id),
    team1: m.players
      .filter((p) => p.team === 1)
      .map((p) => ({ id: p.signUp.id, name: p.signUp.name, skillLevel: p.signUp.skillLevel })),
    team2: m.players
      .filter((p) => p.team === 2)
      .map((p) => ({ id: p.signUp.id, name: p.signUp.name, skillLevel: p.signUp.skillLevel })),
  });

  // All matches feed the "which court am I on?" search; the board shows only
  // each court's current game.
  const allMatches = session.matches.map(toTeamMatch);
  const courts = Array.from({ length: session.courtsLate }, (_, i) => {
    const court = i + 1;
    const m = activeByCourt.get(court);
    return { court, match: m ? toTeamMatch(m) : null };
  });

  // Waiting queue (longest-waiting first) so players can see who's up next.
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
