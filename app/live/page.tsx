import Link from "next/link";
import { prisma } from "@/lib/db";
import { deriveCourtState } from "@/lib/queue";
import { activeCourtCount } from "@/lib/billing";
import { balanceTeams, type Player, type SkillLevel } from "@/lib/matching";
import AutoRefresh from "../session/AutoRefresh";
import QueuePairs, { type QueueMatchup } from "../session/QueuePairs";

export const dynamic = "force-dynamic";

/**
 * "สนามที่กำลังเล่น" — the full court board for every open day, inline and day
 * by day, so players see live courts + who's up next without opening each day's
 * own page. One section per open session, ordered by date.
 */
export default async function LiveAllPage() {
  const sessions = await prisma.session.findMany({
    where: { status: "OPEN" },
    orderBy: { date: "asc" },
    include: {
      signUps: { where: { status: { not: "WITHDRAWN" } } },
      matches: { include: { players: { include: { signUp: true } } } },
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
    const matchById = new Map(s.matches.map((m) => [m.id, m]));
    const names = (id: string, team: number) =>
      matchById.get(id)!.players.filter((p) => p.team === team).map((p) => p.signUp.name);

    const highest = [...state.currentByCourt.keys()].reduce((mx, c) => Math.max(mx, c), activeCourtCount(s));
    const courts = Array.from({ length: highest }, (_, i) => {
      const court = i + 1;
      const g = state.currentByCourt.get(court);
      const next = (state.upcomingByCourt.get(court) ?? [])[0];
      return {
        court,
        round: g ? matchById.get(g.id)!.round : null,
        team1: g ? names(g.id, 1) : [],
        team2: g ? names(g.id, 2) : [],
        nextNames: next ? [...names(next.id, 1), ...names(next.id, 2)] : [],
      };
    });

    // คู่เตรียม: split the waiting queue (in wait order) into balanced matchups.
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

    return {
      id: s.id,
      venue: s.venue,
      dayLabel: new Date(s.date).toLocaleDateString("th-TH", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      queue: state.queue.length,
      courts,
      matchups,
      hasGames: state.currentByCourt.size > 0,
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
        <section key={b.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">
              {b.dayLabel} <span className="text-sm font-normal text-gray-400">· {b.venue}</span>
            </h2>
            <Link href={`/session/${b.id}/courts`} className="text-xs text-brand-700 shrink-0">
              เปิดหน้าวัน →
            </Link>
          </div>

          {!b.hasGames ? (
            <p className="text-sm text-gray-400">ยังไม่เริ่มเล่น</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {b.courts.map((c) => (
                <div key={c.court} className="rounded-lg overflow-hidden border border-gray-200">
                  <div className="bg-slate-800 text-white text-center text-xs font-semibold py-1">
                    สนาม {c.court}
                    {c.round != null && <span className="text-white/60 font-normal"> — เกม {c.round}</span>}
                  </div>
                  {c.team1.length === 0 ? (
                    <div className="bg-gradient-to-b from-blue-500 to-blue-700 py-4 text-center text-white/50 text-xs">
                      ว่าง
                    </div>
                  ) : (
                    <div className="bg-gradient-to-b from-blue-500 to-blue-700 p-2 flex flex-col items-center gap-1 text-white text-xs">
                      <span className="font-medium text-center">{c.team1.join(" + ")}</span>
                      <span className="text-white/70 text-[10px] font-bold">VS</span>
                      <span className="font-medium text-center">{c.team2.join(" + ")}</span>
                      {c.nextNames.length > 0 && (
                        <span className="text-white/60 text-[10px] text-center mt-0.5 truncate max-w-full">
                          ⏭ {c.nextNames.join(", ")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-600">คู่เตรียม</span>
              <span className="text-xs text-gray-400">คิว {b.queue} คน</span>
            </div>
            <QueuePairs sessionId={b.id} matchups={b.matchups} />
          </div>
        </section>
      ))}
    </main>
  );
}
