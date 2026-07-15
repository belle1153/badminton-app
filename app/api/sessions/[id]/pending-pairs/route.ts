import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { bookFoursome, loadCourtState } from "@/lib/queue";

/**
 * Create a คู่เตรียม (pending pair): four hand-picked players, some of whom
 * may still be mid-game right now — they're just earmarked for the next
 * court, and can't actually play until everyone in the foursome is free
 * (see the [pendingId]/book route). If all four are already free and a
 * court is open right now, there's nothing to wait for, so this books the
 * match immediately instead of parking it in คู่เตรียม first.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const team1: string[] = Array.isArray(body.team1) ? body.team1 : [];
  const team2: string[] = Array.isArray(body.team2) ? body.team2 : [];
  const playerIds = [...team1, ...team2];

  if (team1.length !== 2 || team2.length !== 2 || new Set(playerIds).size !== 4) {
    return NextResponse.json({ error: "ต้องเลือกผู้เล่น 4 คนไม่ซ้ำกัน (ทีมละ 2 คน)" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "รอบนี้ปิดแล้ว" }, { status: 400 });
  }

  const signUps = await prisma.signUp.findMany({ where: { id: { in: playerIds } } });
  for (const pid of playerIds) {
    const s = signUps.find((x) => x.id === pid);
    if (!s || s.sessionId !== id || s.status === "WITHDRAWN") {
      return NextResponse.json({ error: "มีผู้เล่นที่เลือกไม่ถูกต้อง" }, { status: 400 });
    }
  }

  // Someone already earmarked in another คู่เตรียม can't be double-booked.
  const existingPending = await prisma.pendingPair.findMany({ where: { sessionId: id } });
  const alreadyPending = new Set(existingPending.flatMap((p) => [...p.team1Ids, ...p.team2Ids]));
  for (const pid of playerIds) {
    if (alreadyPending.has(pid)) {
      const s = signUps.find((x) => x.id === pid)!;
      return NextResponse.json({ error: `${s.name} อยู่ในคู่เตรียมอื่นอยู่แล้ว` }, { status: 400 });
    }
  }

  // Everybody free right now? Try booking straight onto a court instead of
  // parking it in คู่เตรียม for no reason.
  const state = await loadCourtState(id);
  const anyBusy = playerIds.some((pid) => state.reservedIds.has(pid));
  if (!anyBusy) {
    const result = await bookFoursome(id, team1, team2);
    if (result.ok) {
      return NextResponse.json({
        ok: true,
        booked: true,
        matchId: result.matchId,
        round: result.round,
        court: result.court,
      });
    }
    // A real validation error (e.g. someone withdrawn) should surface right
    // away; "no free court" (409) just means it goes into คู่เตรียม instead.
    if (result.status !== 409) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
  }

  const created = await prisma.pendingPair.create({
    data: { sessionId: id, team1Ids: team1, team2Ids: team2 },
  });
  return NextResponse.json({ ok: true, booked: false, pendingId: created.id });
}
