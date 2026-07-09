import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import SelfCourtBanner from "../../SelfCourtBanner";
import CourtGrid from "../../CourtGrid";

export default async function SessionCourtsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      matches: {
        include: { players: { include: { signUp: true } } },
        orderBy: { round: "asc" },
      },
    },
  });

  if (!session) notFound();

  const toTeamMatch = (m: (typeof session.matches)[number]) => ({
    round: m.round,
    court: m.court,
    team1: m.players.filter((p) => p.team === 1).map((p) => ({ id: p.signUp.id, name: p.signUp.name })),
    team2: m.players.filter((p) => p.team === 2).map((p) => ({ id: p.signUp.id, name: p.signUp.name })),
  });

  const matchesByCourt = new Map<number, ReturnType<typeof toTeamMatch>[]>();
  for (const m of session.matches) {
    const list = matchesByCourt.get(m.court) ?? [];
    list.push(toTeamMatch(m));
    matchesByCourt.set(m.court, list);
  }

  const allCourts = Array.from({ length: 6 }, (_, i) => {
    const court = i + 1;
    const entries = matchesByCourt.get(court) ?? [];
    const next = entries.length >= 2 ? entries[entries.length - 1] : null;
    const current = entries.length >= 2 ? entries[entries.length - 2] : (entries[0] ?? null);
    return { court, current, next };
  });

  const currentMatches = allCourts.filter((c) => c.current != null).map((c) => c.current!);
  const hasAnyMatch = currentMatches.length > 0;

  return (
    <>
      <SelfCourtBanner sessionId={id} matches={currentMatches} />

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{hasAnyMatch ? "สนามทั้งหมด" : "ยังไม่มีการจับคู่"}</h2>
        <CourtGrid
          sessionId={id}
          courts={allCourts.map((c) => ({ court: c.court, current: c.current, next: c.next }))}
        />
      </section>
    </>
  );
}
