import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

/** Fix a finished game's result (admin mistyped the winner). Body
 *  { winnerTeam: 1 | 2 | 0 } — 0 = เสมอ. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }
  const { id, matchId } = await params;
  const body = await req.json().catch(() => ({}));
  const winnerTeam = Number(body.winnerTeam);
  if (winnerTeam !== 0 && winnerTeam !== 1 && winnerTeam !== 2) {
    return NextResponse.json({ error: "ต้องเลือกทีมที่ชนะ หรือเสมอ" }, { status: 400 });
  }
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.sessionId !== id) {
    return NextResponse.json({ error: "ไม่พบแมทช์นี้" }, { status: 404 });
  }
  await prisma.match.update({
    where: { id: matchId },
    // Editing a result implies the game is over; mark it finished if it wasn't.
    data: { winnerTeam: winnerTeam === 0 ? null : winnerTeam, finishedAt: match.finishedAt ?? new Date() },
  });
  return NextResponse.json({ ok: true });
}

/** Delete one match — e.g. cancel a pre-queued game or remove a mistake. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id, matchId } = await params;
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.sessionId !== id) {
    return NextResponse.json({ error: "ไม่พบแมทช์นี้" }, { status: 404 });
  }

  await prisma.match.delete({ where: { id: matchId } });
  return NextResponse.json({ ok: true });
}
