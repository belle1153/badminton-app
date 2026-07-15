import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { fillCourt } from "@/lib/queue";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id, matchId } = await params;
  const body = await req.json();
  const winnerTeam = Number(body.winnerTeam); // 1 | 2 | 0 = เสมอ (draw)

  if (winnerTeam !== 1 && winnerTeam !== 2 && winnerTeam !== 0) {
    return NextResponse.json({ error: "ต้องเลือกทีมที่ชนะ หรือเสมอ" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.sessionId !== id) {
    return NextResponse.json({ error: "ไม่พบแมทช์นี้" }, { status: 404 });
  }
  if (match.finishedAt != null) {
    return NextResponse.json({ error: "แมทช์นี้จบไปแล้ว" }, { status: 400 });
  }

  await prisma.match.update({
    where: { id: matchId },
    data: { finishedAt: new Date(), winnerTeam: winnerTeam === 0 ? null : winnerTeam },
  });

  // A pre-queued game slides up to become the court's current game by itself;
  // only auto-fill from the waiting queue when nothing is queued on this court.
  const hasUpcoming = await prisma.match.findFirst({
    where: { sessionId: id, court: match.court, finishedAt: null },
    select: { id: true },
  });
  if (hasUpcoming) {
    return NextResponse.json({ ok: true, court: match.court, filled: false, nextQueued: true });
  }

  // If the admin has a prepared คู่เตรียม (PendingPair) that's ready right now
  // (all four players free), don't fill automatically — the court stays empty
  // and we hand the ready คู่เตรียม back so the client can ASK whether to drop
  // it onto this court or just run the normal auto-fill. This keeps the admin
  // in control of the timing instead of the คู่เตรียม dropping by itself.
  const pendings = await prisma.pendingPair.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "asc" },
  });
  if (pendings.length > 0) {
    // Reserved = anyone still in an unfinished match (this court is now free,
    // so its just-finished four don't count).
    const unfinished = await prisma.match.findMany({
      where: { sessionId: id, finishedAt: null },
      include: { players: { select: { signUpId: true } } },
    });
    const reserved = new Set(unfinished.flatMap((m) => m.players.map((p) => p.signUpId)));
    // Present = checked in. A คู่เตรียม is only "ready" when every member is
    // free AND actually here — never offer to drop one with a ยังไม่มา player.
    const allMembers = pendings.flatMap((p) => [...p.team1Ids, ...p.team2Ids]);
    const present = await prisma.signUp.findMany({
      where: { id: { in: allMembers }, checkedInAt: { not: null } },
      select: { id: true },
    });
    const presentIds = new Set(present.map((s) => s.id));
    const ready = pendings.find((p) =>
      [...p.team1Ids, ...p.team2Ids].every((pid) => !reserved.has(pid) && presentIds.has(pid))
    );
    if (ready) {
      const ids = [...ready.team1Ids, ...ready.team2Ids];
      const sus = await prisma.signUp.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      const nameOf = (pid: string) => sus.find((s) => s.id === pid)?.name ?? pid;
      return NextResponse.json({
        ok: true,
        court: match.court,
        filled: false,
        readyPending: {
          id: ready.id,
          team1: ready.team1Ids.map(nameOf),
          team2: ready.team2Ids.map(nameOf),
        },
      });
    }
  }

  const fill = await fillCourt(id, match.court);

  return NextResponse.json({
    ok: true,
    court: match.court,
    filled: fill.ok,
    reason: fill.ok ? undefined : fill.reason,
  });
}
