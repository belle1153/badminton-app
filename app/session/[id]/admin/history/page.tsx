import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { deriveCourtState } from "@/lib/queue";
import { type SkillLevel } from "@/lib/matching";
import MatchHistory, { type HistoryGame } from "../MatchHistory";

export const dynamic = "force-dynamic";

export default async function SessionMatchHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await isAdmin())) return null; // layout renders the PIN gate

  const session = await prisma.session.findUnique({
    where: { id },
    include: { signUps: { where: { status: { not: "WITHDRAWN" } } } },
  });
  if (!session) return null;

  const matches = await prisma.match.findMany({
    where: { sessionId: id },
    include: { players: { include: { signUp: true } } },
    orderBy: [{ court: "asc" }, { round: "asc" }],
  });

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

  const currentIds = new Set([...state.currentByCourt.values()].map((g) => g.id));

  const games: HistoryGame[] = matches.map((m) => ({
    id: m.id,
    court: m.court,
    round: m.round,
    status: m.finishedAt != null ? "finished" : currentIds.has(m.id) ? "playing" : "upcoming",
    winnerTeam: m.winnerTeam,
    team1: m.players.filter((p) => p.team === 1).map((p) => ({ id: p.signUp.id, name: p.signUp.name })),
    team2: m.players.filter((p) => p.team === 2).map((p) => ({ id: p.signUp.id, name: p.signUp.name })),
  }));

  // Swap pool: anyone present who isn't booked in an unfinished game.
  const substitutes = session.signUps
    .filter(
      (s) =>
        (s.status === "CONFIRMED" || (s.status === "WAITLIST" && s.checkedInAt != null)) &&
        !state.reservedIds.has(s.id)
    )
    .map((s) => ({
      id: s.id,
      name: s.name,
      skillLevel: s.skillLevel,
      waitlist: s.status === "WAITLIST",
    }));

  return (
    <>
      <h1 className="font-semibold text-lg">ประวัติแมท (ต่อสนาม)</h1>
      <p className="text-sm text-gray-500 -mt-3">
        กดชื่อ (✎) ในเกมที่ยังไม่จบเพื่อสลับตัว · เกมที่รอคิวยกเลิกได้
      </p>
      <MatchHistory
        sessionId={id}
        games={games}
        substitutes={substitutes}
        readOnly={session.status === "CLOSED"}
      />
    </>
  );
}
