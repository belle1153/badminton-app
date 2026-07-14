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

  const fill = await fillCourt(id, match.court);

  return NextResponse.json({
    ok: true,
    court: match.court,
    filled: fill.ok,
    reason: fill.ok ? undefined : fill.reason,
  });
}
