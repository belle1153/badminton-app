import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import PinGate from "@/app/admin/PinGate";
import AdminPanel from "./AdminPanel";
import MatchEditor from "./MatchEditor";
import CheckInList from "./CheckInList";

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
  const latestRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;

  const latestRoundMatches = latestRound
    ? latestRound[1].map((m) => ({
        id: m.id,
        court: m.court,
        team1: m.players
          .filter((p) => p.team === 1)
          .map((p) => ({ id: p.signUp.id, name: p.signUp.name, skillLevel: p.signUp.skillLevel })),
        team2: m.players
          .filter((p) => p.team === 2)
          .map((p) => ({ id: p.signUp.id, name: p.signUp.name, skillLevel: p.signUp.skillLevel })),
      }))
    : [];
  const playingIds = new Set(
    latestRoundMatches.flatMap((m) => [...m.team1, ...m.team2].map((p) => p.id))
  );
  const confirmedSignUps = session.signUps.filter((s) => s.status === "CONFIRMED");
  const substitutes = confirmedSignUps
    .filter((s) => !playingIds.has(s.id))
    .map((s) => ({ id: s.id, name: s.name, skillLevel: s.skillLevel }));

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
        registrationClosed={session.registrationClosedAt != null}
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
      />

      {latestRound && session.status === "OPEN" && (
        <MatchEditor
          sessionId={id}
          round={latestRound[0]}
          matches={latestRoundMatches}
          substitutes={substitutes}
        />
      )}

      {rounds.length > 0 && (
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
