import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import SelfCourtBanner from "../../SelfCourtBanner";
import CourtGrid from "../../CourtGrid";

export default async function SessionCourtsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, admin] = await Promise.all([
    prisma.session.findUnique({
      where: { id },
      include: {
        matches: {
          include: { players: { include: { signUp: true } } },
          orderBy: { round: "asc" },
        },
        signUps: { where: { status: "CONFIRMED" } },
      },
    }),
    isAdmin(),
  ]);

  if (!session) notFound();

  const toTeamMatch = (m: (typeof session.matches)[number]) => ({
    id: m.id,
    round: m.round,
    court: m.court,
    team1: m.players.filter((p) => p.team === 1).map((p) => ({ id: p.signUp.id, name: p.signUp.name })),
    team2: m.players.filter((p) => p.team === 2).map((p) => ({ id: p.signUp.id, name: p.signUp.name })),
  });

  const allMatches = session.matches.map(toTeamMatch);

  const matchesByCourt = new Map<number, ReturnType<typeof toTeamMatch>[]>();
  for (const m of allMatches) {
    const list = matchesByCourt.get(m.court) ?? [];
    list.push(m);
    matchesByCourt.set(m.court, list);
  }

  const playingByRound = new Map<number, Set<string>>();
  for (const m of session.matches) {
    const set = playingByRound.get(m.round) ?? new Set<string>();
    for (const p of m.players) set.add(p.signUpId);
    playingByRound.set(m.round, set);
  }
  const confirmedPlayers = session.signUps.map((s) => ({ id: s.id, name: s.name }));

  const allCourts = Array.from({ length: 6 }, (_, i) => {
    const court = i + 1;
    const entries = matchesByCourt.get(court) ?? [];
    const next = entries.length >= 2 ? entries[entries.length - 1] : null;
    const current = entries.length >= 2 ? entries[entries.length - 2] : (entries[0] ?? null);
    const nextSubstitutes = next
      ? confirmedPlayers.filter((p) => !playingByRound.get(next.round)?.has(p.id))
      : [];
    return { court, current, next, nextSubstitutes };
  });

  const hasAnyMatch = allCourts.some((c) => c.current != null);

  return (
    <>
      <SelfCourtBanner matches={allMatches} />

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{hasAnyMatch ? "สนามทั้งหมด" : "ยังไม่มีการจับคู่"}</h2>
        <CourtGrid sessionId={id} isAdmin={admin} courts={allCourts} />
      </section>
    </>
  );
}
