import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import SelfCourtBanner from "../../../SelfCourtBanner";
import CourtGrid from "../../../CourtGrid";
import RoundTabs from "../../../RoundTabs";

export default async function SessionCourtsPage({
  params,
  searchParams,
  basePath,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ round?: string }>;
  basePath?: string;
}) {
  const { id } = await params;
  const { round: roundParam } = await searchParams;

  const [session, admin] = await Promise.all([
    prisma.session.findUnique({
      where: { id },
      include: {
        matches: {
          include: { players: { include: { signUp: true } } },
          orderBy: { round: "asc" },
        },
        signUps: { where: { status: { not: "WITHDRAWN" } } },
      },
    }),
    isAdmin(),
  ]);

  if (!session) notFound();

  const toTeamMatch = (m: (typeof session.matches)[number]) => ({
    id: m.id,
    round: m.round,
    court: m.court,
    team1: m.players
      .filter((p) => p.team === 1)
      .map((p) => ({ id: p.signUp.id, name: p.signUp.name, skillLevel: p.signUp.skillLevel })),
    team2: m.players
      .filter((p) => p.team === 2)
      .map((p) => ({ id: p.signUp.id, name: p.signUp.name, skillLevel: p.signUp.skillLevel })),
  });

  const allMatches = session.matches.map(toTeamMatch);
  const roundNumbers = [...new Set(allMatches.map((m) => m.round))].sort((a, b) => a - b);
  const latestRound = roundNumbers.length > 0 ? roundNumbers[roundNumbers.length - 1] : null;

  const requestedRound = roundParam ? Number(roundParam) : null;
  const selectedRound =
    requestedRound != null && roundNumbers.includes(requestedRound) ? requestedRound : latestRound;

  const matchesForRound = selectedRound != null ? allMatches.filter((m) => m.round === selectedRound) : [];
  const matchByCourt = new Map(matchesForRound.map((m) => [m.court, m]));

  const courts = Array.from({ length: 6 }, (_, i) => {
    const court = i + 1;
    return { court, match: matchByCourt.get(court) ?? null };
  });

  const isLatestRound = selectedRound != null && selectedRound === latestRound && session.status === "OPEN";
  const playingInSelectedRound = new Set(
    matchesForRound.flatMap((m) => [...m.team1, ...m.team2].map((p) => p.id))
  );
  // Confirmed players plus waitlisted people who checked in can be placed into courts.
  const substitutes = isLatestRound
    ? session.signUps
        .filter(
          (s) =>
            (s.status === "CONFIRMED" || (s.status === "WAITLIST" && s.checkedInAt != null)) &&
            !playingInSelectedRound.has(s.id)
        )
        .map((s) => ({
          id: s.id,
          name: s.name,
          skillLevel: s.skillLevel,
          waitlist: s.status === "WAITLIST",
        }))
    : [];

  const path = basePath ?? `/session/${id}/courts`;

  return (
    <>
      <SelfCourtBanner matches={allMatches} />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">สนามทั้งหมด</h2>
          {selectedRound != null && <span className="text-sm text-gray-400">รอบที่ {selectedRound}</span>}
        </div>

        {roundNumbers.length > 0 && <RoundTabs base={path} rounds={roundNumbers} selected={selectedRound!} />}

        {roundNumbers.length === 0 ? (
          <p className="text-gray-500 text-sm">ยังไม่มีการจับคู่</p>
        ) : (
          <CourtGrid
            sessionId={id}
            isAdmin={admin}
            editable={isLatestRound}
            courts={courts}
            substitutes={substitutes}
          />
        )}
      </section>
    </>
  );
}
