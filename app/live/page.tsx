import Link from "next/link";
import { prisma } from "@/lib/db";
import { deriveCourtState } from "@/lib/queue";
import { openCourtNumbers } from "@/lib/billing";
import { balanceTeams, type Player, type SkillLevel } from "@/lib/matching";
import AutoRefresh from "../session/AutoRefresh";
import CourtGrid from "../session/CourtGrid";
import QueuePairs, { type QueueMatchup } from "../session/QueuePairs";

export const dynamic = "force-dynamic";

type MatchRow = {
  id: string;
  round: number;
  court: number;
  finishedAt: Date | null;
  winnerTeam: number | null;
  players: {
    team: number;
    signUp: { id: string; name: string; skillLevel: string; athlete: { photoUrl: string | null } | null };
  }[];
};

/**
 * "สนามที่กำลังเล่น" — the full court board (same as each day's own page: face
 * avatars, current + next games, คู่เตรียม, game history) for every open day,
 * inline and day by day, so players don't have to open each day one at a time.
 */
export default async function LiveAllPage() {
  const sessions = await prisma.session.findMany({
    where: { status: "OPEN" },
    orderBy: { date: "asc" },
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

  const boards = sessions.map((s) => {
    const state = deriveCourtState(
      s.signUps.map((x) => ({
        id: x.id,
        name: x.name,
        skillLevel: x.skillLevel as SkillLevel,
        fixedPartnerId: x.fixedPartnerId,
        checkedInAt: x.checkedInAt,
        createdAt: x.createdAt,
        status: x.status,
      })),
      s.matches.map((m) => ({
        id: m.id,
        round: m.round,
        court: m.court,
        finishedAt: m.finishedAt,
        players: m.players.map((p) => ({ signUpId: p.signUpId })),
      }))
    );

    const matchById = new Map(s.matches.map((m) => [m.id, m as MatchRow]));
    const activeIds = new Set([...state.currentByCourt.values()].map((g) => g.id));
    const toTeamMatch = (m: MatchRow) => ({
      id: m.id,
      round: m.round,
      active: activeIds.has(m.id),
      team1: m.players
        .filter((p) => p.team === 1)
        .map((p) => ({ id: p.signUp.id, name: p.signUp.name, skillLevel: p.signUp.skillLevel, photoUrl: p.signUp.athlete?.photoUrl ?? null })),
      team2: m.players
        .filter((p) => p.team === 2)
        .map((p) => ({ id: p.signUp.id, name: p.signUp.name, skillLevel: p.signUp.skillLevel, photoUrl: p.signUp.athlete?.photoUrl ?? null })),
    });

    const occupied = new Set<number>([...state.currentByCourt.keys(), ...state.upcomingByCourt.keys()]);
    const courtNums = [...new Set([...openCourtNumbers(s), ...occupied])].sort((a, b) => a - b);
    const courts = courtNums.map((court) => {
      const cur = state.currentByCourt.get(court);
      const ups = (state.upcomingByCourt.get(court) ?? []).slice(0, 2);
      return {
        court,
        match: cur ? toTeamMatch(matchById.get(cur.id)!) : null,
        upcoming: ups.map((g) => toTeamMatch(matchById.get(g.id)!)),
      };
    });

    // คู่เตรียม: split the waiting queue (wait order) into balanced matchups.
    const signUpById = new Map(s.signUps.map((x) => [x.id, x]));
    const queuePlayers: Player[] = state.queue.map((q) => {
      const x = signUpById.get(q.id)!;
      return { id: x.id, name: x.name, skillLevel: x.skillLevel as SkillLevel, fixedPartnerId: x.fixedPartnerId };
    });
    const matchups: QueueMatchup[] = [];
    for (let i = 0; i + 4 <= queuePlayers.length && matchups.length < 3; i += 4) {
      const { team1, team2 } = balanceTeams(queuePlayers.slice(i, i + 4));
      matchups.push({
        key: `${s.id}-${i}`,
        teamA: team1.map((p) => ({ id: p.id, name: p.name })),
        teamB: team2.map((p) => ({ id: p.id, name: p.name })),
      });
    }

    const finished = (s.matches as MatchRow[])
      .filter((m) => m.finishedAt != null)
      .sort((a, b) => a.court - b.court || a.round - b.round);
    const historyCourts = [...new Set(finished.map((m) => m.court))];

    return {
      id: s.id,
      venue: s.venue,
      dayLabel: new Date(s.date).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" }),
      queue: state.queue.length,
      courts,
      matchups,
      hasGames: s.matches.length > 0,
      finished,
      historyCourts,
    };
  });

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <AutoRefresh />
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← กลับหน้าแรก
      </Link>
      <h1 className="text-xl font-bold">🏸 สนามที่กำลังเล่น</h1>

      {boards.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีรอบเล่นเปิดอยู่</p>}

      {boards.map((b) => (
        <section key={b.id} className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold text-lg">
              {b.dayLabel} <span className="text-sm font-normal text-gray-400">· {b.venue}</span>
            </h2>
            <Link href={`/session/${b.id}/courts`} className="text-xs text-brand-700 shrink-0">
              เปิดหน้าวัน →
            </Link>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">สนามทั้งหมด</h3>
              <span className="text-xs text-gray-400">กำลังเล่นตอนนี้</span>
            </div>
            {!b.hasGames ? (
              <p className="text-gray-500 text-sm">ยังไม่มีการจับคู่</p>
            ) : (
              <CourtGrid sessionId={b.id} courts={b.courts} />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">คู่เตรียม</h3>
              <span className="text-xs text-gray-400">คิว {b.queue} คน</span>
            </div>
            <QueuePairs sessionId={b.id} matchups={b.matchups} />
          </div>

          {b.finished.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-sm">ประวัติเกม</h3>
              {b.historyCourts.map((court) => (
                <div key={court} className="flex flex-col gap-1">
                  <h4 className="text-sm font-medium text-gray-600">สนาม {court}</h4>
                  <ul className="flex flex-col divide-y divide-gray-100 border border-gray-100 rounded-md">
                    {b.finished
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
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
