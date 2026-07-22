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
    orderBy: [{ createdAt: "asc" }, { court: "asc" }],
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

  // Global game numbering 1..N across the whole day (chronological), not per
  // court, so the log reads เกม 1, 2, 3 … like the club's paper sheet.
  const games: HistoryGame[] = matches.map((m, i) => ({
    id: m.id,
    seq: i + 1,
    court: m.court,
    status: m.finishedAt != null ? "finished" : currentIds.has(m.id) ? "playing" : "upcoming",
    winnerTeam: m.winnerTeam,
    team1: m.players.filter((p) => p.team === 1).map((p) => ({ id: p.signUp.id, name: p.signUp.name })),
    team2: m.players.filter((p) => p.team === 2).map((p) => ({ id: p.signUp.id, name: p.signUp.name })),
  }));

  // รอบตีรายคน — how many games each player has actually finished today, so the
  // admin can see at a glance who has had few turns and who has had plenty.
  const played = new Map<string, { name: string; count: number }>();
  for (const m of matches) {
    if (m.finishedAt == null) continue;
    for (const p of m.players) {
      const e = played.get(p.signUp.id) ?? { name: p.signUp.name, count: 0 };
      e.count++;
      played.set(p.signUp.id, e);
    }
  }
  const rounds = [...played.entries()]
    .map(([pid, v]) => ({ id: pid, ...v }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const finishedGames = matches.filter((m) => m.finishedAt != null).length;
  const maxRounds = rounds[0]?.count ?? 0;

  return (
    <>
      <h1 className="font-semibold text-lg">ประวัติแมตซ์</h1>
      <p className="text-sm text-gray-500 -mt-3">
        บันทึกทุกเกมพร้อมผล เรียงตามเวลา · แก้ตัวผู้เล่นได้ที่หน้า &quot;จัดการแมตซ์ → สนามสด&quot; ·
        เกมที่รอคิวยกเลิกได้
      </p>

      {rounds.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">รอบตีรายคน</h2>
            <span className="text-xs text-gray-400">
              เล่นจบแล้ว {finishedGames} เกม · {rounds.length} คน
            </span>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {rounds.map((r) => (
              <li
                key={r.id}
                className={`text-sm rounded-full px-3 py-1 border ${
                  r.count === maxRounds
                    ? "bg-brand-600 text-white border-brand-600 font-medium"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                {r.name}
                <span className={r.count === maxRounds ? "text-white/70 ml-1" : "text-gray-400 ml-1"}>
                  {r.count} รอบ
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <MatchHistory
        sessionId={id}
        games={games}
        players={session.signUps
          .map((s) => ({ id: s.id, name: s.name }))
          .sort((a, b) => a.name.localeCompare(b.name, "th"))}
        readOnly={session.status === "CLOSED"}
      />
    </>
  );
}
