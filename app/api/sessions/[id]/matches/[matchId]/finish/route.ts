import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { bookFoursome, fillCourt } from "@/lib/queue";

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

  // Prefer a prepared คู่เตรียม (PendingPair): drop the front-most one whose
  // four players are all free now onto this just-freed court. This is what
  // makes "จบเกม" pull the คู่เตรียม the admin lined up (edits included) instead
  // of a freshly auto-computed foursome. Falls back to auto-fill when no
  // คู่เตรียม is ready.
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
    const ready = pendings.find((p) =>
      [...p.team1Ids, ...p.team2Ids].every((pid) => !reserved.has(pid))
    );
    if (ready) {
      const booked = await bookFoursome(id, ready.team1Ids, ready.team2Ids, match.court);
      if (booked.ok) {
        await prisma.pendingPair.delete({ where: { id: ready.id } });
        return NextResponse.json({
          ok: true,
          court: match.court,
          filled: true,
          fromPending: true,
        });
      }
      // Booking a stale คู่เตรียม failed (e.g. someone withdrew) — leave it in
      // the list for the admin and fall through to auto-fill this court.
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
