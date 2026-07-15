import Link from "next/link";
import { prisma } from "@/lib/db";
import { openCourtNumbers } from "@/lib/billing";
import { type SkillLevel } from "@/lib/matching";
import { buildCourtBoard } from "@/lib/courtBoard";
import AutoRefresh from "../session/AutoRefresh";
import CourtGrid from "../session/CourtGrid";
import QueuePairs from "../session/QueuePairs";

export const dynamic = "force-dynamic";

/**
 * "สนามที่กำลังเล่น" — the full court board (same as each day's own page: face
 * avatars, current + next games, คู่เตรียม, game history) for every open day,
 * inline and day by day, so players don't have to open each day one at a time.
 */
export default async function LiveAllPage() {
  // Only today's play (ICT). Session dates are stored at UTC midnight of the
  // intended local date, so match against today's ICT date at UTC midnight.
  const nowIct = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayMidnight = new Date(
    Date.UTC(nowIct.getUTCFullYear(), nowIct.getUTCMonth(), nowIct.getUTCDate())
  );

  const sessions = await prisma.session.findMany({
    where: { status: "OPEN", date: todayMidnight },
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
      pendingPairs: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  });

  const boards = sessions.map((s) => {
    const signUps = s.signUps.map((x) => ({
      id: x.id,
      name: x.name,
      skillLevel: x.skillLevel as SkillLevel,
      fixedPartnerId: x.fixedPartnerId,
      checkedInAt: x.checkedInAt,
      createdAt: x.createdAt,
      status: x.status,
    }));
    const board = buildCourtBoard(signUps, s.matches, openCourtNumbers(s), s.pendingPairs, `${s.id}-`);

    return {
      id: s.id,
      venue: s.venue,
      dayLabel: new Date(s.date).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" }),
      hasGames: s.matches.length > 0,
      ...board,
    };
  });

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <AutoRefresh />
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← กลับหน้าแรก
      </Link>
      <h1 className="text-xl font-bold">🏸 สนามที่กำลังเล่น</h1>

      {boards.length === 0 && <p className="text-sm text-gray-400">วันนี้ยังไม่มีรอบเล่น</p>}

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
              <span className="text-xs text-gray-400">คิว {b.queueCount} คน</span>
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
                        const t1 = m.team1.map((p) => p.name);
                        const t2 = m.team2.map((p) => p.name);
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
