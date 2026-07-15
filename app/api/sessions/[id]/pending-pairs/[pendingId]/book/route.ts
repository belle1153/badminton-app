import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { bookFoursome, loadCourtState } from "@/lib/queue";

/**
 * Promote a คู่เตรียม onto a court. Refuses while any of the four is still
 * mid-game (they must finish and leave the court first) — that's the whole
 * point of earmarking someone who's currently playing instead of booking
 * them immediately.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; pendingId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id, pendingId } = await params;
  const pending = await prisma.pendingPair.findUnique({ where: { id: pendingId } });
  if (!pending || pending.sessionId !== id) {
    return NextResponse.json({ error: "ไม่พบคู่เตรียมนี้" }, { status: 404 });
  }

  const playerIds = [...pending.team1Ids, ...pending.team2Ids];
  const state = await loadCourtState(id);
  const stillBusy = playerIds.filter((pid) => state.reservedIds.has(pid));
  if (stillBusy.length > 0) {
    const signUps = await prisma.signUp.findMany({ where: { id: { in: stillBusy } } });
    const names = stillBusy.map((pid) => signUps.find((s) => s.id === pid)?.name ?? pid);
    return NextResponse.json(
      { error: `รอ ${names.join(", ")} จบเกมก่อนถึงจะลงสนามได้` },
      { status: 400 }
    );
  }

  const result = await bookFoursome(id, pending.team1Ids, pending.team2Ids);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await prisma.pendingPair.delete({ where: { id: pendingId } });
  return NextResponse.json({ ok: true, matchId: result.matchId, round: result.round, court: result.court });
}
