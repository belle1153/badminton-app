import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { bookFoursome, fillCourt } from "@/lib/queue";
import { openCourtNumbers } from "@/lib/billing";

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
  const closeCourt = body.closeCourt === true; // "จบแล้วปิดคอร์ท" — don't refill

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

  // "จบแล้วปิดคอร์ท": end the game and stop the court — no refill — so the four
  // become free and can check out. Used to wind courts down at end of day. Close
  // it by dropping this court from the open set (switches to an explicit set).
  if (closeCourt) {
    const session = await prisma.session.findUnique({ where: { id } });
    if (session) {
      const nextOpen = openCourtNumbers(session).filter((c) => c !== match.court);
      await prisma.session.update({ where: { id }, data: { openCourts: nextOpen.join(",") } });
    }
    return NextResponse.json({ ok: true, court: match.court, filled: false, closed: true });
  }

  // A pre-queued game slides up to become the court's current game by itself;
  // only auto-fill from the waiting queue when nothing is queued on this court.
  const hasUpcoming = await prisma.match.findFirst({
    where: { sessionId: id, court: match.court, finishedAt: null },
    select: { id: true },
  });
  if (hasUpcoming) {
    return NextResponse.json({ ok: true, court: match.court, filled: false, nextQueued: true });
  }

  // Drop the front-most ready คู่เตรียม (PendingPair) onto this just-freed court
  // automatically — no prompt. The admin built the คู่เตรียม queue on purpose,
  // so finishing a game just runs the next one. "Ready" = every member free and
  // checked in (never drop one with a ยังไม่มา player). Falls back to auto-fill
  // from the waiting queue when no คู่เตรียม is ready.
  const pendings = await prisma.pendingPair.findMany({
    where: { sessionId: id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (pendings.length > 0) {
    const unfinished = await prisma.match.findMany({
      where: { sessionId: id, finishedAt: null },
      include: { players: { select: { signUpId: true } } },
    });
    const reserved = new Set(unfinished.flatMap((m) => m.players.map((p) => p.signUpId)));
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
      const booked = await bookFoursome(id, ready.team1Ids, ready.team2Ids, match.court);
      if (booked.ok) {
        await prisma.pendingPair.delete({ where: { id: ready.id } });
        return NextResponse.json({ ok: true, court: match.court, filled: true, fromPending: true });
      }
      // Booking a stale คู่เตรียม failed — leave it and fall through to auto-fill.
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
