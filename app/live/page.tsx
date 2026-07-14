import Link from "next/link";
import { prisma } from "@/lib/db";
import { deriveCourtState } from "@/lib/queue";
import { type SkillLevel } from "@/lib/matching";
import AutoRefresh from "../session/AutoRefresh";

export const dynamic = "force-dynamic";

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
    const highest = [...state.currentByCourt.keys()].reduce((mx, c) => Math.max(mx, c), s.courtsLate);
    const courts = Array.from({ length: highest }, (_, i) => {
      const g = state.currentByCourt.get(i + 1);
      const m = g ? matchById.get(g.id)! : null;
      return {
        court: i + 1,
        round: m?.round ?? null,
        team1: m ? m.players.filter((p) => p.team === 1).map((p) => p.signUp.name) : [],
        team2: m ? m.players.filter((p) => p.team === 2).map((p) => p.signUp.name) : [],
      };
    });
    return {
      id: s.id,
      venue: s.venue,
      dayLabel: new Date(s.date).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "short" }),
      queue: state.queue.length,
      courts,
      hasGames: state.currentByCourt.size > 0,
    };
  });

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-5">
      <AutoRefresh />
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← กลับหน้าแรก
      </Link>
      <h1 className="text-xl font-bold">🏸 สนามที่กำลังเล่น</h1>

      {boards.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีรอบเล่นเปิดอยู่</p>}

      {boards.map((b) => (
        <section key={b.id} className="flex flex-col gap-2">
          <Link href={`/session/${b.id}/courts`} className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">
              {b.venue} <span className="text-sm font-normal text-gray-400">· {b.dayLabel}</span>
            </h2>
            <span className="text-xs text-brand-700">คิว {b.queue} · ดูเต็ม →</span>
          </Link>
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
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
